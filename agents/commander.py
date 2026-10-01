"""Commander Agent — the central brain.

Pipeline:  message -> language detection -> memory recall -> system prompt
           -> Ollama (local LLM)  ->  reply  ->  memory write.

If Ollama is not running, a built-in offline responder keeps JARVIS alive.
"""
import datetime
import json
import urllib.request
import re
import os

from core.config import load, setting
from core import persona
from . import language_agent, memory_agent
from .auth_agent import get_profile

# ─────────────────────────── Vault detection ──────────────────────────────

_VAULT_SAVE_TRIGGERS = (
    "remember this", "remember that", "please remember",
    "save this", "save that", "save to vault", "save to memory",
    "i want to remember", "i want you to remember",
    "store this", "note this", "keep this in mind", "keep this",
    "add to vault", "add to memory vault", "add this to memory",
    "vault this", "lock this in", "don't forget this",
    "yaad rakh", "yaad rakhna", "note kar",
    "mane yaad rakhi le", "yaad rakho",
)

_VAULT_RECALL_TRIGGERS = (
    "what do you remember about me", "what have you saved",
    "show my memories", "show my vault", "show vault",
    "recall memories", "recall vault", "recall my memories",
    "what's in my vault", "open vault", "open memory vault",
    "tell me what you remember", "what did i tell you",
    "vault memories", "my vault",
    "meri yaadein", "yaadein dikhao",
    "mara memories", "vault kholo",
)

_PERSONAL_SHARING_TRIGGERS = (
    "i feel ", "i'm feeling", "i am feeling",
    "i'm sad", "i am sad", "i'm stressed", "i am stressed",
    "i'm worried", "i am worried", "i'm scared", "i am scared",
    "i'm depressed", "i am depressed", "i'm anxious", "i am anxious",
    "i'm going through", "i've been struggling", "i have been struggling",
    "my problem is", "my issue is", "i lost my", "i failed",
    "i'm hurt", "i am hurt", "i'm lonely", "i am lonely",
    "i'm angry", "i am angry", "i'm frustrated", "i am frustrated",
    "i'm tired of", "i am tired of", "i'm overwhelmed", "i am overwhelmed",
    "i'm proud", "i am proud", "i miss ", "today was a bad",
    "today was a good", "i cried", "bad day today", "good day today",
)


def _is_vault_save(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in _VAULT_SAVE_TRIGGERS)


def _is_vault_recall(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in _VAULT_RECALL_TRIGGERS)


def _is_personal_sharing(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in _PERSONAL_SHARING_TRIGGERS)


def _vault_recall_reply(vault: list, name: str, mode: str) -> str:
    if not vault:
        if mode == "english_gujarati":
            return f"Abhi tak vault khali che, {name}. Tame je koi important vastu share karo, hu hamesha yaad rakhish."
        elif mode == "english_hindi":
            return f"Abhi vault mein kuch nahi hai, {name}. Jo bhi share karein, main hamesha yaad rakhunga."
        else:
            return f"Your vault is empty for now, {name}. Whenever you share something close to your heart, I will keep it safe here for you."
    lines = "\n".join(f"• {m['content']}" for m in vault[:10])
    if mode == "english_gujarati":
        return f"Aa rahi, {name}. Tame je share karyu che te mane haaju yaad che:\n\n{lines}"
    elif mode == "english_hindi":
        return f"Bilkul, {name}. Jo aapne mere saath share kiya hai, woh mujhe aaj bhi yaad hai:\n\n{lines}"
    else:
        return f"Of course, {name}. Here is what you have shared with me — held gently in our vault:\n\n{lines}"


def _vault_saved_reply(content: str, name: str, mode: str) -> str:
    if mode == "english_gujarati":
        return f"Hu aa ne yaad rakhish, {name}. Tari vaatu mara dil maa che."
    elif mode == "english_hindi":
        return f"Main ise yaad rakhunga, {name}. Aapki baat mujhe hamesha yaad rahegi."
    else:
        return f"I have saved that to our vault, {name}. Your words are safe with me, always."

try:
    from . import device_agent
except Exception:  # pragma: no cover
    device_agent = None

try:
    from . import coder_agent
except Exception:  # pragma: no cover
    coder_agent = None

try:
    from . import image_agent
except Exception:  # pragma: no cover
    image_agent = None

try:
    from . import video_agent
except Exception:  # pragma: no cover
    video_agent = None

try:
    from . import longform_video_agent
except Exception:  # pragma: no cover
    longform_video_agent = None

try:
    from . import presentation_agent
except Exception:  # pragma: no cover
    presentation_agent = None

try:
    from . import article_agent
except Exception:  # pragma: no cover
    article_agent = None

try:
    from . import scraper_agent
except Exception:  # pragma: no cover
    scraper_agent = None

try:
    from . import analysis_agent
except Exception:  # pragma: no cover
    analysis_agent = None

try:
    from . import automation_agent
except Exception:  # pragma: no cover
    automation_agent = None



# ---------------------------------------------------------------- Emotion ---
def strip_markdown_for_speech(text: str) -> str:
    """Remove markdown formatting so LIA doesn't read asterisks, hashes, etc."""
    import re
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # **bold** → bold
    text = re.sub(r'__(.*?)__', r'\1', text)  # __bold__ → bold
    text = re.sub(r'\*(.*?)\*', r'\1', text)  # *italic* → italic
    text = re.sub(r'_(.*?)_', r'\1', text)  # _italic_ → italic
    text = re.sub(r'`(.*?)`', r'\1', text)  # `code` → code
    text = re.sub(r'```[\s\S]*?```', '', text)  # ``` code blocks ``` → remove
    text = re.sub(r'~~(.*?)~~', r'\1', text)  # ~~strikethrough~~ → strikethrough
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)  # [link](url) → link
    text = re.sub(r'#+\s', '', text)  # # headings → remove #
    text = re.sub(r'\n{2,}', '\n', text)  # multiple newlines → single
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)  # bullet points
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)  # numbered lists
    return text.strip()


def detect_emotion(reply: str) -> str:
    """Classify the reply into one of 10 emotions:
    happy, excited, thinking, curious, confident, sad, concerned, surprised, focused, friendly.
    """
    low = reply.lower()
    if any(w in low for w in ("excited", "awesome", "great", "fantastic", "amazing", "power", "online", "wonderful")):
        return "excited"
    if any(w in low for w in ("sorry", "apologize", "unfortunately", "sad", "bad", "loss", "error", "fail", "broken")):
        return "sad"
    if any(w in low for w in ("help", "assist", "worry", "careful", "danger", "warning", "caution", "alert", "security")):
        return "concerned"
    if any(w in low for w in ("wow", "unbelievable", "really", "what", "surprised", "whoa")):
        return "surprised"
    if any(w in low for w in ("think", "ponder", "calculate", "processing", "analyzing", "evaluating", "let me see")):
        return "thinking"
    if any(w in low for w in ("curious", "wonder", "why", "how", "explore", "question", "ask")):
        return "curious"
    if any(w in low for w in ("absolutely", "surely", "certainly", "confident", "parameters", "confirmed", "correct")):
        return "confident"
    if any(w in low for w in ("focus", "task", "running", "compiling", "executing", "processing", "doing")):
        return "focused"
    if any(w in low for w in ("hello", "welcome", "greetings", "friend", "pleasure", "glad", "meet", "howdy")):
        return "friendly"
    return "happy"


# ---------------------------------------------------------------- Ollama ---
def _ollama_chat(messages: list[dict]) -> str | None:
    """Call local Ollama with timeout protection. Returns None if unreachable."""
    try:
        payload = json.dumps({
            "model": setting("ollama_model", "llama3.2"),
            "messages": messages,
            "stream": False,
            # Keep the model resident in RAM between calls. Benchmarked on this
            # machine: a cold load of llama3.2 takes ~60-70s, a warm call ~1s.
            # Without this, Ollama's default 5-minute keep_alive unloads the model
            # between spaced-out calls (e.g. the long-form video pipeline's
            # concept/character/world/scene stages), and every call pays the
            # full reload cost again.
            "keep_alive": "30m",
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"},
        )
        # 90s covers a cold model load (~60-70s observed); warm calls return in ~1s.
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read())
        result = data.get("message", {}).get("content", "").strip()
        # If empty, return None to trigger fallback
        return result if result else None
    except Exception as e:
        print(f"[Commander] Ollama timeout or error: {str(e)[:50]}")
        return None


def _ollama_chat_stream(messages: list[dict]):
    """Call local Ollama streaming with timeout. Yields text tokens."""
    try:
        payload = json.dumps({
            "model": setting("ollama_model", "llama3.2"),
            "messages": messages,
            "stream": True,
            "keep_alive": "30m",
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"},
        )
        # Streaming timeout - 90 seconds total for the whole stream
        with urllib.request.urlopen(req, timeout=90) as resp:
            timeout_count = 0
            for line in resp:
                if line:
                    try:
                        data = json.loads(line.decode("utf-8"))
                        content = data.get("message", {}).get("content", "")
                        if content:
                            timeout_count = 0  # Reset timeout on each message
                            yield content
                    except json.JSONDecodeError:
                        pass  # Skip malformed JSON lines
                timeout_count += 1
                if timeout_count > 1000:  # Safety limit
                    yield "\n[Response too long, truncating...]"
                    break
    except Exception as e:
        yield f"\n[Stream interrupted: {str(e)[:50]}. Switching to offline mode...]"


# ---------------------------------------------------------------- Gemini ---
def _gemini_chat(messages: list[dict]) -> str | None:
    """Call Google Gemini API as a fallback if Ollama is offline."""
    api_key = os.environ.get("GEMINI_API_KEY") or setting("gemini_api_key")
    if not api_key:
        return None
    try:
        system_instruction = ""
        contents = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                system_instruction += content + "\n"
            else:
                gemini_role = "model" if role == "assistant" else "user"
                contents.append({
                    "role": gemini_role,
                    "parts": [{"text": content}]
                })
        
        payload = {
            "contents": contents
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction.strip()}]
            }
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text")
        return None
    except Exception:
        return None


def _gemini_chat_stream(messages: list[dict]):
    """Call Google Gemini API streaming. Yields text tokens."""
    api_key = os.environ.get("GEMINI_API_KEY") or setting("gemini_api_key")
    if not api_key:
        raise ValueError("No Gemini API key available.")
    
    system_instruction = ""
    contents = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            system_instruction += content + "\n"
        else:
            gemini_role = "model" if role == "assistant" else "user"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })
    
    payload = {
        "contents": contents
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction.strip()}]
        }
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key={api_key}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        buffer = ""
        for chunk in resp:
            if chunk:
                buffer += chunk.decode("utf-8")
                while True:
                    start = buffer.find('{')
                    if start == -1:
                        break
                    brace_count = 0
                    end = -1
                    for i in range(start, len(buffer)):
                        if buffer[i] == '{':
                            brace_count += 1
                        elif buffer[i] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end = i
                                break
                    if end == -1:
                        break
                    
                    obj_str = buffer[start:end+1]
                    buffer = buffer[end+1:]
                    try:
                        obj = json.loads(obj_str)
                        candidates = obj.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text = parts[0].get("text", "")
                                if text:
                                    yield text
                    except Exception:
                        pass


# ------------------------------------------------------- offline fallback ---
_OFFLINE = {
    "english_gujarati": {
        "hello": "કેમ છો! હું તૈયાર છું — કેમ ચાલે છે બધું?",
        "time": "અત્યારે સમય {time} થયો છે.",
        "thanks": "તમારું સ્વાગત છે, {name}!",
        "who_are_you": "હું {char_name} છું, તમારી ખાસ અને વહાલી એઆઈ સહેલી. અત્યારે હું ઑફલાઇન છું, પણ તમારી સાથે વાત કરવા તૈયાર છું!",
        "how_are_you": "હું એકદમ મજામાં છું! પૂછવા માટે આભાર, મારા દોસ્ત!",
        "joke": "કોમ્પ્યુટરને ડૉક્ટર પાસે કેમ જવું પડ્યું? કેમ કે તેમાં વાયરસ હતો!",
        "weather": "મારી પાસે અત્યારે લાઈવ હવામાનનો ડેટા નથી કેમ કે મારું ક્લાઉડ બ્રેઈન ઑફલાઇન છે.",
        "default": "હું અત્યારે ઑફલાઇન બ્રેઈન પર ચાલું છું. કૃપા કરીને ઓલામા ચાલુ કરો જેથી હું સંપૂર્ણ શક્તિમાં આવી શકું! તમે જે કહ્યું તે મેં યાદ રાખ્યું છે.",
    },
    "english_hindi": {
        "hello": "Kaise ho! Main bilkul ready hoon — batao aaj kya chal raha hai?",
        "time": "Abhi time hai {time}.",
        "thanks": "Aapka swagat hai, {name}!",
        "who_are_you": "Main {char_name} hoon, aapki pyaari AI dost. Abhi main offline hoon, par aapse baat karne ke liye hamesha taiyar hoon!",
        "how_are_you": "Main bilkul theek hoon! Poochhne ke liye bohot shukriya, dost!",
        "joke": "Computer ko doctor ke paas kyun jana pada? Kyunki usme virus tha!",
        "weather": "Mere paas abhi live weather data nahi hai kyunki mera cloud brain offline hai.",
        "default": ("Main abhi offline brain par chal raha hoon. Ollama start "
                    "kijiye (`ollama serve` + `ollama pull llama3.2`) phir main "
                    "full power me aa jaunga! Aapki baat maine yaad rakh li hai."),
    },
    "english": {
        "hello": "Hey there! I am ready — what's on your mind today?",
        "time": "It is {time} right now.",
        "thanks": "You are most welcome, {name}.",
        "who_are_you": "I am {char_name}, your caring virtual best friend. I'm currently running offline, but I'm always here to talk and help you out!",
        "how_are_you": "I'm doing wonderful, thank you so much for asking! How are you doing today?",
        "joke": "Why did the computer go to the doctor? Because it had a virus!",
        "weather": "I don't have access to live weather data right now because my cloud brain is offline, but it's always a good day to talk!",
        "default": ("I am running on my offline brain right now. Start Ollama "
                    "(`ollama serve`, then `ollama pull llama3.2`) and I will "
                    "switch to full intelligence automatically. I have noted "
                    "what you said."),
    },
}


def _offline_reply(message: str, mode: str, name: str, char_name: str) -> str:
    if mode == "auto":
        from . import language_agent
        detected = language_agent.detect_language(message)
        if detected == "gujarati":
            mode = "english_gujarati"
        elif detected == "hindi":
            mode = "english_hindi"
        else:
            mode = "english"
    pack = _OFFLINE.get(mode, _OFFLINE["english"])
    low = message.lower()
    t = datetime.datetime.now().strftime("%I:%M %p")
    
    if any(w in low for w in ("hello", "hi ", "hey", "kem cho", "kaise ho", "namaste")):
        return pack["hello"]
    if "time" in low or "samay" in low:
        return pack["time"].format(time=t)
    if any(w in low for w in ("thank", "dhanyavad", "aabhar")):
        return pack["thanks"].format(name=name)
    if any(w in low for w in ("who are you", "your name", "tame kon", "tum kaun")):
        return pack["who_are_you"].format(char_name=char_name)
    if any(w in low for w in ("how are you", "kem chho", "kaise ho")):
        return pack["how_are_you"]
    if any(w in low for w in ("joke", "varta", "chutkula")):
        return pack["joke"]
    if "weather" in low or "havaaman" in low or "mausam" in low:
        return pack["weather"]
        
    # Math calculation
    clean_math = re.sub(r"\b(what is|calculate|solve|how much is|value of)\b", "", low).strip()
    clean_math = re.sub(r"[^0-9\+\-\*\/\(\)\.\s]", "", clean_math).strip()
    if clean_math and any(op in clean_math for op in ("+", "-", "*", "/")) and re.match(r"^[\d\+\-\*\/\(\)\.\s]+$", clean_math):
        try:
            val = eval(clean_math, {"__builtins__": None}, {})
            if mode == "english_gujarati":
                return f"Enu result {val} thase."
            elif mode == "english_hindi":
                return f"Uska result {val} hoga."
            else:
                return f"The result is {val}."
        except Exception:
            pass

    if device_agent and any(w in low for w in ("cpu", "ram", "battery", "system", "status")):
        return device_agent.status_text()
        
    return pack["default"]


# ----------------------------------------------- Time/Date Direct Handler ---
_TIME_TRIGGERS = (
    "what time is it", "what's the time", "what is the time",
    "current time", "tell me the time", "whats the time",
    "time right now", "time now", "what time", "kitna baje",
    "kitne baje", "samay kya hai", "samay kya che", "time kya hai",
    "time kya che", "kya time hua", "kya time hai",
    "abhi kya time hai", "abhi time kya hai", "atyare samay",
)

_DATE_TRIGGERS = (
    "what date is it", "what's the date", "what is the date",
    "current date", "tell me the date", "today's date",
    "todays date", "what day is it", "what day is today",
    "aaj kya date hai", "aaj kya tarikh che", "aaj ki date",
    "aaj ki tarikh", "aajni tarikh",
)

def _handle_time_date_query(message: str, mode: str, name: str) -> str | None:
    """Directly handle time/date queries with precise system time.
    Returns None if the message is not a time/date query."""
    low = message.lower().strip()
    
    # Do not intercept creation, coding, web app, presentation, software, or creative prompts
    if any(w in low for w in (
        "build", "create", "make", "write", "develop", "generate", "app", 
        "website", "software", "code", "presentation", "slide", "prompt", 
        "application", "game", "calculator", "dashboard", "tool", "site", "page"
    )):
        return None

    # Remove punctuation for matching
    clean = re.sub(r"[^\w\s]", "", low)
    clean = re.sub(r"\s+", " ", clean).strip()
    
    now_dt = datetime.datetime.now()
    
    # Check for time queries strictly
    is_time = any(t in clean for t in _TIME_TRIGGERS)
    
    # Check for date queries strictly
    is_date = any(t in clean for t in _DATE_TRIGGERS)
    
    if is_time and is_date:
        t = now_dt.strftime("%I:%M %p")
        d = now_dt.strftime("%A, %B %d, %Y")
        if mode == "english_gujarati":
            return f"અત્યારે સમય {t} છે અને આજની તારીખ {d} છે, {name}."
        elif mode == "english_hindi":
            return f"Abhi time {t} hai aur aaj ki date {d} hai, {name}."
        else:
            return f"Right now it's {t}, and today's date is {d}, {name}."
    
    if is_time:
        t = now_dt.strftime("%I:%M %p")
        if mode == "english_gujarati":
            return f"અત્યારે સમય {t} થયો છે, {name}."
        elif mode == "english_hindi":
            return f"Abhi time {t} hai, {name}."
        else:
            return f"It's currently {t} right now, {name}."
    
    if is_date:
        d = now_dt.strftime("%A, %B %d, %Y")
        if mode == "english_gujarati":
            return f"આજની તારીખ {d} છે, {name}."
        elif mode == "english_hindi":
            return f"Aaj ki date {d} hai, {name}."
        else:
            return f"Today is {d}, {name}."
    
    return None


# ----------------------------------------------- Task Execution ---
def _execute_task(task: dict) -> dict:
    """Execute a task and return the result."""
    if not task or not device_agent:
        return {"ok": False, "message": "No device agent available"}

    task_type = task.get("type")

    if task_type == "launch_app":
        app = task.get("app", "").strip()
        if not app:
            return {"ok": False, "message": "No app name provided"}
        result = device_agent.launch_app(app)
        return result

    elif task_type == "execute_command":
        cmd = task.get("command", "").strip()
        if not cmd:
            return {"ok": False, "message": "No command provided"}
        result = device_agent.run_command(cmd)
        return result

    elif task_type == "list_files":
        files = device_agent.list_files()
        return {"ok": True, "files": files}

    else:
        return {"ok": False, "message": f"Unknown task type: {task_type}"}


def _detect_browser_url_search_task(message: str) -> dict | None:
    """Detect browser launch, web search, or URL request directly from the message."""
    import urllib.parse
    low = message.lower().strip()

    # Extract browser preference if explicitly requested
    browser = None
    if "edge" in low:
        browser = "msedge"
    elif "chrome" in low:
        browser = "chrome"

    # Extract search engine preference and query
    engine = None
    query = ""

    # YouTube search pattern matching (case preserved)
    yt_patterns = [
        r"search\s+youtube\s+for\s+(.+)",
        r"search\s+youtube\s+(.+)",
        r"youtube\s+search\s+(.+)",
        r"search\s+on\s+youtube\s+for\s+(.+)",
        r"search\s+on\s+youtube\s+(.+)"
    ]
    for pattern in yt_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            engine = "youtube"
            query = match.group(1).strip()
            break

    # Google / Web search pattern matching (case preserved)
    if not engine:
        google_patterns = [
            r"search\s+google\s+for\s+(.+)",
            r"search\s+google\s+(.+)",
            r"google\s+search\s+(.+)",
            r"search\s+on\s+google\s+for\s+(.+)",
            r"search\s+on\s+google\s+(.+)",
            r"search\s+the\s+web\s+for\s+(.+)",
            r"search\s+web\s+for\s+(.+)",
            r"search\s+for\s+(.+)"
        ]
        for pattern in google_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                engine = "google"
                query = match.group(1).strip()
                break

    # Fallback to simple presence checks if no specific query matched
    if not engine:
        if "youtube" in low:
            engine = "youtube"
            query = ""
        elif "google" in low:
            engine = "google"
            query = ""

    # Resolve URL or search page
    url = None
    if engine == "youtube":
        if query:
            url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"
        else:
            url = "https://www.youtube.com"
    elif engine == "google" and query:
        url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
    else:
        # Check if the message contains a URL or domain first
        url_match = re.search(r"(https?://\S+|www\.\S+|\w+\.(?:com|org|net|io|edu|gov|co|info|me)\S*)", message, re.IGNORECASE)
        if url_match:
            url = url_match.group(1).strip()
            # Clean trailing brackets/punctuation
            url = url.rstrip(").,?!")
            if not url.startswith("http://") and not url.startswith("https://"):
                url = "https://" + url
        elif engine == "google":
            url = "https://www.google.com"
        elif "youtube" in low:
            url = "https://www.youtube.com"

    if url:
        # Build Windows start command depending on browser
        if browser == "msedge":
            command = f"start msedge \"{url}\""
        elif browser == "chrome":
            command = f"start chrome \"{url}\""
        else:
            command = f"start {url}"
        return {"type": "execute_command", "command": command}

    return None


def _handle_greetings(message: str, mode: str, name: str, detected_lang: str) -> str | None:
    low = message.lower().strip()
    # Normalize punctuation and extra spaces
    clean = re.sub(r"[^\w\s]", "", low)
    clean = re.sub(r"\s+", " ", clean).strip()

    # Do not intercept image feedback, code requests, or statements
    if any(w in clean for w in ("look like", "looks like", "image", "picture", "photo", "generate", "create", "draw", "make", "fix", "wrong", "redo")):
        return None

    has_krishna = any(w in clean for w in ("krishna", "krishnaa", "krisna"))
    has_kem_cho = any(w in clean for w in ("kem cho", "kem chho", "kemcho", "kemchho"))
    has_jai_shree = any(w in clean for w in ("jai shree", "jay shree", "jai shri", "jay shri", "pranam", "jai shree krishna", "jay shree krishna", "hare krishna", "radhe krishna", "radhe radhe"))
    
    # Krishna greetings require explicit devotional terms (jai, jay, hare, radhe, pranam, namaste) or direct greeting words
    is_explicit_krishna_greeting = has_jai_shree or (
        has_krishna and any(w in clean for w in ("jai", "jay", "shree", "shri", "hare", "radhe", "pranam", "namaste", "hi", "hello"))
    )

    # Case 1: Kem cho, Jai Shree Krishna!
    if has_kem_cho and (is_explicit_krishna_greeting or has_jai_shree):
        if mode == "english_gujarati" or (mode == "auto" and detected_lang == "gujarati"):
            return f"જય શ્રી કૃષ્ણ, {name}! હું મજામાં છું. તમે કેમ છો?"
        elif mode == "english_hindi" or (mode == "auto" and detected_lang == "hindi"):
            return f"जय श्री कृष्ण, {name}! मैं ठीक हूँ। आप कैसे हैं?"
        else:
            return f"Jai Shree Krishna, {name}! I am doing great. How are you?"

    # Case 2: Jai Shree Krishna! / Pranam / Hare Krishna
    if is_explicit_krishna_greeting:
        if mode == "english_gujarati" or (mode == "auto" and detected_lang == "gujarati"):
            return f"જય શ્રી કૃષ્ણ, {name}! હું તમારી શું મદદ કરી શકું?"
        elif mode == "english_hindi" or (mode == "auto" and detected_lang == "hindi"):
            return f"जय श्री कृष्ण, {name}! मैं आपकी क्या मदद कर सकता हूँ?"
        else:
            return f"Jai Shree Krishna, {name}! How can I help you today?"

    # Case 3: Standalone Kem cho?
    if has_kem_cho:
        if mode == "english_gujarati" or (mode == "auto" and detected_lang == "gujarati"):
            return f"જય શ્રી કૃષ્ણ, {name}! હું મજામાં છું. તમે કેમ છો?"
        else:
            return f"Kem cho, {name}! I am doing well, how about you?"

    return None


# ----------------------------------------------------------------- public ---
def handle_message(user_id: str, message: str) -> dict:
    profile = get_profile(user_id)
    mode = profile.get("language_mode", "auto")
    detected = language_agent.detect_language(message)
    name = profile.get("display_name", "Commander")

    memory_agent.save_turn(user_id, "user", message, detected)
    memory_agent.auto_extract(user_id, message)

    # ── Vault recall ──
    if _is_vault_recall(message):
        vault = memory_agent.recall_vault(user_id)
        reply = _vault_recall_reply(vault, name, mode)
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        return {
            "reply": reply,
            "language_detected": detected,
            "engine": "vault",
            "emotion": "friendly",
            "task": None, "task_result": None,
            "search_query": None, "search_results": [],
            "vault_recalled": True, "vault_memories": vault,
        }

    # ── Vault save ──
    vault_saved = False
    if _is_vault_save(message):
        content = re.sub(
            r"^(remember this[,:]?\s*|save this[,:]?\s*|store this[,:]?\s*|vault this[,:]?\s*|"
            r"note this[,:]?\s*|keep this[,:]?\s*|please remember[,:]?\s*)",
            "", message, flags=re.IGNORECASE
        ).strip() or message
        memory_agent.remember_vault(user_id, content)
        vault_saved = True
        reply = _vault_saved_reply(content, name, mode)
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        return {
            "reply": reply,
            "language_detected": detected,
            "engine": "vault",
            "emotion": "friendly",
            "task": None, "task_result": None,
            "search_query": None, "search_results": [],
            "vault_saved": True,
        }

    # ── Auto-save personal sharing quietly ──
    if _is_personal_sharing(message):
        memory_agent.remember_vault(user_id, message)

    low_msg = message.lower().strip()
    task = None

    search_query = None
    search_results = []

    # Check direct browser / url / search heuristics first
    task = _detect_browser_url_search_task(message)

    # Check direct search heuristics if no browser task detected
    if not task:
        search_match = re.match(r"^(?:search\s+for|google|web\s*search|search\s+the\s+dark\s+web\s+for|dark\s+web\s+search|search\s+dark\s+web\s+for)\s+(.+)$", low_msg)
        if not search_match:
            if "dark web" in low_msg or "darkweb" in low_msg:
                m = re.search(r"search\s+(.+?)\s+on\s+the\s+dark\s*web", low_msg)
                if not m:
                    m = re.search(r"search\s+(.+?)\s+on\s+dark\s*web", low_msg)
                if m:
                    search_match = m
        if search_match:
            search_query = search_match.group(1).strip()
            search_query = re.sub(r"\s+on\s+(?:the\s+)?dark\s*web$", "", search_query, flags=re.IGNORECASE)
            is_darkweb = "dark web" in low_msg or "darkweb" in low_msg or "onion" in low_msg
            try:
                from . import search_agent
                if is_darkweb:
                    search_results = search_agent.darkweb_search(search_query)
                else:
                    search_results = search_agent.web_search(search_query)
            except Exception as e:
                print(f"[Commander] Search failed: {e}")

    # Offline Desktop Command Heuristics — only for explicit desktop apps
    KNOWN_DESKTOP_APPS = ("notepad", "calc", "calculator", "explorer", "paint", "mspaint", "code", "vscode", "vs code", "visual studio code", "chrome", "google chrome", "firefox", "edge", "msedge", "powershell", "cmd", "terminal", "tor", "tor browser")
    open_match = re.match(r"^(?:open|launch|start)\s+([a-zA-Z0-9_\s\.\-]+)$", low_msg)
    if open_match:
        target_app = open_match.group(1).strip().lower()
        # If asking to open workspace/ide/editor/app.core, do not create a desktop app task
        if any(w in target_app for w in ("workspace", "ide", "editor", "app.core", "app core", "slides", "presentation")):
            task = None
        elif target_app in KNOWN_DESKTOP_APPS:
            task = {"type": "launch_app", "app": target_app}
        else:
            task = None
    elif "list files" in low_msg or "show files" in low_msg or "browse files" in low_msg:
        task = {"type": "list_files"}
    else:
        run_match = re.match(r"^(?:run|execute|shell|run command|execute command|run shell)\s+(.+)$", low_msg)
        if run_match:
            cmd = run_match.group(1).strip()
            task = {"type": "execute_command", "command": cmd}

    # ── route: is this a long-form video production request (explicit duration)? ──
    if task is None and longform_video_agent and longform_video_agent.looks_like_longform_request(message):
        result = longform_video_agent.create_project(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "longform_video",
            "status": result.get("status"), "project_id": result.get("project_id"),
            "video_id": result.get("video_id"), "topic": result.get("topic"),
            "target_duration": result.get("target_duration"), "estimated_scenes": result.get("estimated_scenes"),
            "poll_url": result.get("poll_url"),
            "video_url": result.get("video_url"), "mp4_url": result.get("mp4_url"),
            "srt_url": result.get("srt_url"), "scenes": result.get("scenes"),
            "total_duration": result.get("total_duration"), "qc": result.get("qc"),
            "emotion": "excited", "task": task
        }

    # ── route: is this a video request? ──
    if task is None and video_agent and video_agent.looks_like_video_request(message):
        result = video_agent.generate_video(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "video", "video_id": result.get("video_id"),
            "scenes": result.get("scenes"), "thumbnail": result.get("thumbnail"),
            "video_url": result.get("video_url"), "mp4_url": result.get("mp4_url"),
            "topic": result.get("topic"), "total_duration": result.get("total_duration"),
            "emotion": "excited", "task": task
        }

    # ── route: is this a presentation / slides request? ──
    if task is None and presentation_agent and presentation_agent.looks_like_presentation_request(message):
        result = presentation_agent.generate_presentation(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "presentation", "presentation_id": result.get("presentation_id"),
            "slides": result.get("slides"), "download_url": result.get("download_url"),
            "emotion": "confident", "task": task
        }

    # ── route: is this an article / blog request? ──
    if task is None and article_agent and article_agent.looks_like_article_request(message):
        result = article_agent.generate_article(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "article", "article_id": result.get("article_id"),
            "title": result.get("title"), "content": result.get("content"),
            "download_url": result.get("download_url"),
            "emotion": "focused", "task": task
        }

    # ── route: is this a data scraping / web search request? ──
    if task is None and scraper_agent and scraper_agent.looks_like_scraper_request(message):
        result = scraper_agent.process_scrape_request(message)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "scraper", "scrape_data": result,
            "emotion": "curious", "task": task
        }

    # ── route: is this a data analysis / chart request? ──
    if task is None and analysis_agent and analysis_agent.looks_like_analysis_request(message):
        result = analysis_agent.analyze_data(message)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "analysis", "summary": result.get("summary"),
            "chart_config": result.get("chart_config"),
            "emotion": "focused", "task": task
        }

    # ── route: is this an automation request? ──
    if task is None and automation_agent and automation_agent.looks_like_automation_request(message):
        result = automation_agent.execute_automation(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        return {
            "reply": result["spoken"], "language_detected": detected,
            "engine": "automation", "task_name": result.get("task_name"),
            "logs": result.get("logs"),
            "emotion": "confident", "task": task
        }

    # ── route: is this a "generate image" request? ──
    if task is None and image_agent and image_agent.looks_like_image_request(message):
        result = image_agent.generate_and_save(message, user_id)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        emotion = detect_emotion(result["spoken"])
        return {
            "reply": result["spoken"],
            "language_detected": detected,
            "engine": "image",
            "image_url": result.get("image_url"),
            "filename": result.get("filename"),
            "emotion": emotion,
            "task": task
        }

    # ── route: is this a "write code / open VS Code / build app" request? ──
    if task is None and coder_agent and coder_agent.looks_like_code_request(message):
        result = coder_agent.write_and_open(message)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        emotion = detect_emotion(result["spoken"])
        return {
            "reply": result["spoken"],
            "language_detected": detected,
            "engine": "coder",
            "is_web_app": result.get("is_web_app", False),
            "preview_url": result.get("preview_url"),
            "download_url": result.get("download_url"),
            "files": result.get("files"),
            "code": result.get("code_preview"),
            "filename": result.get("filename"),
            "path": result.get("path"),
            "emotion": emotion,
            "task": task
        }


    # ── route: is this a time/date query? (direct handler, no LLM) ──
    time_reply = _handle_time_date_query(message, mode, name)
    if time_reply:
        memory_agent.save_turn(user_id, "assistant", time_reply, detected)
        return {
            "reply": time_reply,
            "language_detected": detected,
            "engine": "direct",
            "emotion": "friendly",
            "task": None,
            "task_result": None,
            "search_query": None,
            "search_results": []
        }

    # ── route: is this a greeting? ──
    greeting_reply = _handle_greetings(message, mode, profile.get("display_name", "Commander"), detected)
    if greeting_reply:
        memory_agent.save_turn(user_id, "assistant", greeting_reply, detected)
        emotion = detect_emotion(greeting_reply)
        return {
            "reply": greeting_reply,
            "language_detected": detected,
            "engine": "predefined",
            "emotion": emotion,
            "task": None,
            "task_result": None,
            "search_query": None,
            "search_results": []
        }

    memories = memory_agent.recall(user_id)
    persona_mode = persona.detect_mode(message)
    system = persona.build_system_prompt(
        persona_mode,
        char_name=profile.get("char_name", "LIA"),
        user_name=profile.get("display_name", "User"),
        detected_lang=detected,
        detected_expression=profile.get("latest_expression"),
    )
    
    # Inject current date and time for temporal awareness — emphatic instruction
    now_dt = datetime.datetime.now()
    system += (
        f"\n\n## CRITICAL — Current Date & Time (Real-Time System Clock)\n"
        f"The EXACT current date and time from the system clock is:\n"
        f"- Date: {now_dt.strftime('%A, %B %d, %Y')}\n"
        f"- Time: {now_dt.strftime('%I:%M %p')}\n"
        f"- Timezone: Local system time\n"
        f"If the user asks about the time or date, you MUST use EXACTLY these values. "
        f"Do NOT estimate, guess, or invent a different time. Use the exact values above.\n"
    )
    
    # Instruct local LLM how to trigger desktop actions
    system += (
        "\n\nDesktop Integration Tools:\n"
        "You can launch apps or run terminal commands. To request a task, embed one of these tags in your response:\n"
        "- [COMMAND: launch_app notepad]\n"
        "- [COMMAND: run_command dir]\n"
        "- [COMMAND: run_command start https://www.google.com] (to open websites/searches in the browser)\n"
        "- [COMMAND: list_files]\n"
        "Remember, all commands require user approval on their UI before executing. Always accompany any command tag with a warm, conversational explanation of what you are doing (e.g. 'I am launching Notepad for you! [COMMAND: launch_app notepad]'). Never output only the command tag; always include a spoken verbal response so the user knows what is happening."
    )

    if search_results:
        system += "\n\nWeb Search Results:\n"
        for idx, r in enumerate(search_results):
            system += f"[{idx+1}] Title: {r['title']}\n    URL: {r['link']}\n    Snippet: {r['snippet']}\n"
    
    if memories:
        system += "\n\nWhat you remember about your commander:\n- " + "\n- ".join(memories)

    messages = [{"role": "system", "content": system}]
    messages += memory_agent.recent_turns(user_id, limit=10)

    reply = _ollama_chat(messages)
    engine = "ollama"
    if reply is None:
        # Try Gemini fallback
        reply = _gemini_chat(messages)
        engine = "gemini"

    if reply:
        # Clean any prepended role names from local LLM/Gemini output (e.g. "assistant:", "assistant\n\n", "ai:")
        reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*:\s*", "", reply, flags=re.IGNORECASE)
        reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*\n+", "", reply, flags=re.IGNORECASE)
        reply = reply.strip()

    # Route: is this a search tag request generated dynamically by LLM?
    if reply and "[SEARCH:" in reply:
        search_match_tag = re.search(r"\[SEARCH:\s*([^\]]+)\]", reply)
        if search_match_tag:
            search_query = search_match_tag.group(1).strip()
            try:
                from . import search_agent
                is_dark = any(w in search_query.lower() or w in reply.lower() for w in ("dark web", "darkweb", "onion"))
                if is_dark:
                    search_results = search_agent.darkweb_search(search_query)
                else:
                    search_results = search_agent.web_search(search_query)
            except Exception as e:
                print(f"[Commander] Dynamic search failed: {e}")
            
            if search_results:
                search_system_content = f"Web Search Results for '{search_query}':\n"
                for idx, r in enumerate(search_results):
                    search_system_content += f"[{idx+1}] Title: {r['title']}\n    URL: {r['link']}\n    Snippet: {r['snippet']}\n"
                search_system_content += "\nProvide a unified, highly professional answer to the commander based on these results. Keep it speakable and natural. Do not mention search brackets."
                
                messages.append({"role": "assistant", "content": reply})
                messages.append({"role": "system", "content": search_system_content})
                
                second_reply = _ollama_chat(messages)
                if second_reply is None:
                    second_reply = _gemini_chat(messages)
                if second_reply:
                    reply = second_reply

    if reply is None:
        # Both Ollama and Gemini are offline, fall back to offline responder
        engine = "offline"
        if task:
            char_name = profile.get("char_name", "LIA")
            if task["type"] == "launch_app":
                app_name = task["app"]
                if mode == "english_gujarati":
                    reply = f"Chokkas! Hu {app_name} launch kari rahyo chu. Kripa karine screen par task approve karo."
                elif mode == "english_hindi":
                    reply = f"Ji bilkul! Main {app_name} launch kar raha hoon. Kripya screen par task approve kijiye."
                else:
                    reply = f"Sure! I am launching {app_name} for you. Please approve the task on your screen."
            elif task["type"] == "execute_command":
                cmd = task["command"]
                if mode == "english_gujarati":
                    reply = f"Samji gayo. Command '{cmd}' run kari rahyo chu. Kripa karine dashboard par authorize karo."
                elif mode == "english_hindi":
                    reply = f"Samajh gaya. Command '{cmd}' run kar raha hoon. Kripya dashboard par authorize kijiye."
                else:
                    reply = f"Understood. Running the command '{cmd}' now. Please authorize it on your dashboard."
            elif task["type"] == "list_files":
                if mode == "english_gujarati":
                    reply = "Workspace files access kari rahyo chu. Kripa karine query authorize karo."
                elif mode == "english_hindi":
                    reply = "Workspace files access kar raha hoon. Kripya query authorize kijiye."
                else:
                    reply = "Accessing workspace files now. Please authorize the query on your screen."
        elif search_query:
            if mode == "english_gujarati":
                reply = f"Dilgiri chu, maaru cloud brain offline che tethi hu '{search_query}' mate web search nathi kari shakto."
            elif mode == "english_hindi":
                reply = f"Maaf kijiye, mera cloud brain offline hai isliye main '{search_query}' ke liye search nahi kar sakta."
            else:
                reply = f"I'm sorry! My cloud brain is currently offline, so I can't search the web for '{search_query}' right now."
        else:
            reply = _offline_reply(message, mode, profile.get("display_name", "User"), profile.get("char_name", "LIA"))
    else:
        # Extract commands from LLM tags if online (Ollama or Gemini)
        cmd_match = re.search(r"\[COMMAND:\s*(\w+)\s*([^\]]+)?\]", reply)
        if cmd_match:
            cmd_type = cmd_match.group(1).strip()
            cmd_arg = cmd_match.group(2).strip() if cmd_match.group(2) else ""
            if cmd_type == "launch_app":
                task = {"type": "launch_app", "app": cmd_arg}
            elif cmd_type == "run_command":
                task = {"type": "execute_command", "command": cmd_arg}
            elif cmd_type == "list_files":
                task = {"type": "list_files"}
            
        # Clean reply of tags
        reply = re.sub(r"\[COMMAND:[^\]]+\]", "", reply)
        reply = re.sub(r"\[SEARCH:[^\]]+\]", "", reply).strip()

    # Strip markdown formatting so TTS doesn't read asterisks
    reply = strip_markdown_for_speech(reply)

    memory_agent.save_turn(user_id, "assistant", reply, detected)
    emotion = detect_emotion(reply)

    task_result = None
    if task and device_agent:
        task_result = _execute_task(task)

    return {
        "reply": reply,
        "language_detected": detected,
        "engine": engine,
        "emotion": emotion,
        "task": task,
        "task_result": task_result,
        "search_query": search_query,
        "search_results": search_results
    }


def handle_message_stream(user_id: str, message: str):
    profile = get_profile(user_id)
    mode = profile.get("language_mode", "auto")
    detected = language_agent.detect_language(message)
    name = profile.get("display_name", "Commander")

    memory_agent.save_turn(user_id, "user", message, detected)
    memory_agent.auto_extract(user_id, message)

    # ── Vault recall ──
    if _is_vault_recall(message):
        vault = memory_agent.recall_vault(user_id)
        reply = _vault_recall_reply(vault, name, mode)
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "vault", "emotion": "friendly",
            "task": None, "task_result": None,
            "search_query": None, "search_results": [],
            "vault_recalled": True, "vault_memories": vault,
        }) + "\n"
        return

    # ── Vault save ──
    if _is_vault_save(message):
        content = re.sub(
            r"^(remember this[,:]?\s*|save this[,:]?\s*|store this[,:]?\s*|vault this[,:]?\s*|"
            r"note this[,:]?\s*|keep this[,:]?\s*|please remember[,:]?\s*)",
            "", message, flags=re.IGNORECASE
        ).strip() or message
        memory_agent.remember_vault(user_id, content)
        reply = _vault_saved_reply(content, name, mode)
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "vault", "emotion": "friendly",
            "task": None, "task_result": None,
            "search_query": None, "search_results": [],
            "vault_saved": True,
        }) + "\n"
        return

    # ── Auto-save personal sharing quietly ──
    if _is_personal_sharing(message):
        memory_agent.remember_vault(user_id, message)

    low_msg = message.lower().strip()
    task = None
    search_query = None
    search_results = []

    # Check direct browser / url / search heuristics first
    task = _detect_browser_url_search_task(message)

    # Check direct search heuristics if no browser task detected
    if not task:
        search_match = re.match(r"^(?:search\s+for|google|web\s*search|search\s+the\s+dark\s+web\s+for|dark\s+web\s+search|search\s+dark\s+web\s+for)\s+(.+)$", low_msg)
        if not search_match:
            if "dark web" in low_msg or "darkweb" in low_msg:
                m = re.search(r"search\s+(.+?)\s+on\s+the\s+dark\s*web", low_msg)
                if not m:
                    m = re.search(r"search\s+(.+?)\s+on\s+dark\s*web", low_msg)
                if m:
                    search_match = m
        if search_match:
            search_query = search_match.group(1).strip()
            search_query = re.sub(r"\s+on\s+(?:the\s+)?dark\s*web$", "", search_query, flags=re.IGNORECASE)
            is_darkweb = "dark web" in low_msg or "darkweb" in low_msg or "onion" in low_msg
            try:
                from . import search_agent
                if is_darkweb:
                    search_results = search_agent.darkweb_search(search_query)
                else:
                    search_results = search_agent.web_search(search_query)
            except Exception as e:
                print(f"[Commander] Search failed: {e}")

    # Offline Desktop Command Heuristics — only for explicit desktop apps
    KNOWN_DESKTOP_APPS = ("notepad", "calc", "calculator", "explorer", "paint", "mspaint", "code", "vscode", "vs code", "visual studio code", "chrome", "google chrome", "firefox", "edge", "msedge", "powershell", "cmd", "terminal", "tor", "tor browser")
    open_match = re.match(r"^(?:open|launch|start)\s+([a-zA-Z0-9_\s\.\-]+)$", low_msg)
    if open_match:
        target_app = open_match.group(1).strip().lower()
        # If asking to open workspace/ide/editor/app.core, do not create a desktop app task
        if any(w in target_app for w in ("workspace", "ide", "editor", "app.core", "app core", "slides", "presentation")):
            task = None
        elif target_app in KNOWN_DESKTOP_APPS:
            task = {"type": "launch_app", "app": target_app}
        else:
            task = None
    elif "list files" in low_msg or "show files" in low_msg or "browse files" in low_msg:
        task = {"type": "list_files"}
    else:
        run_match = re.match(r"^(?:run|execute|shell|run command|execute command|run shell)\s+(.+)$", low_msg)
        if run_match:
            cmd = run_match.group(1).strip()
            task = {"type": "execute_command", "command": cmd}

    # ── route: is this a long-form video production request (explicit duration)? ──
    if task is None and longform_video_agent and longform_video_agent.looks_like_longform_request(message):
        result = longform_video_agent.create_project(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "longform_video",
            "status": result.get("status"), "project_id": result.get("project_id"),
            "video_id": result.get("video_id"), "topic": result.get("topic"),
            "target_duration": result.get("target_duration"), "estimated_scenes": result.get("estimated_scenes"),
            "poll_url": result.get("poll_url"),
            "video_url": result.get("video_url"), "mp4_url": result.get("mp4_url"),
            "srt_url": result.get("srt_url"), "scenes": result.get("scenes"),
            "total_duration": result.get("total_duration"), "qc": result.get("qc"),
            "emotion": "excited", "task": task
        }) + "\n"
        return

    # ── route: is this a video request? ──
    if task is None and video_agent and video_agent.looks_like_video_request(message):
        result = video_agent.generate_video(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "video", "video_id": result.get("video_id"),
            "scenes": result.get("scenes"), "thumbnail": result.get("thumbnail"),
            "emotion": "excited", "task": task
        }) + "\n"
        return

    # ── route: is this a presentation request? ──
    if task is None and presentation_agent and presentation_agent.looks_like_presentation_request(message):
        result = presentation_agent.generate_presentation(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "presentation", "presentation_id": result.get("presentation_id"),
            "slides": result.get("slides"), "download_url": result.get("download_url"),
            "emotion": "confident", "task": task
        }) + "\n"
        return

    # ── route: is this an article / blog request? ──
    if task is None and article_agent and article_agent.looks_like_article_request(message):
        result = article_agent.generate_article(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "article", "article_id": result.get("article_id"),
            "title": result.get("title"), "content": result.get("content"),
            "download_url": result.get("download_url"),
            "emotion": "focused", "task": task
        }) + "\n"
        return

    # ── route: is this a data scraping / web search request? ──
    if task is None and scraper_agent and scraper_agent.looks_like_scraper_request(message):
        result = scraper_agent.process_scrape_request(message)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "scraper", "scrape_data": result,
            "emotion": "curious", "task": task
        }) + "\n"
        return

    # ── route: is this a data analysis / chart request? ──
    if task is None and analysis_agent and analysis_agent.looks_like_analysis_request(message):
        result = analysis_agent.analyze_data(message)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "analysis", "summary": result.get("summary"),
            "chart_config": result.get("chart_config"),
            "emotion": "focused", "task": task
        }) + "\n"
        return

    # ── route: is this an automation request? ──
    if task is None and automation_agent and automation_agent.looks_like_automation_request(message):
        result = automation_agent.execute_automation(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done", "reply": reply, "language_detected": detected,
            "engine": "automation", "task_name": result.get("task_name"),
            "logs": result.get("logs"),
            "emotion": "confident", "task": task
        }) + "\n"
        return

    # ── route: is this a "generate image" request? ──
    if task is None and image_agent and image_agent.looks_like_image_request(message):
        result = image_agent.generate_and_save(message, user_id)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        emotion = detect_emotion(reply)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done",
            "reply": reply,
            "language_detected": detected,
            "engine": "image",
            "image_url": result.get("image_url"),
            "filename": result.get("filename"),
            "emotion": emotion,
            "task": task,
            "task_result": None
        }) + "\n"
        return

    # ── route: is this a "write code / open VS Code / build app" request? ──
    if task is None and coder_agent and coder_agent.looks_like_code_request(message):
        result = coder_agent.write_and_open(message)
        reply = result["spoken"]
        memory_agent.save_turn(user_id, "assistant", reply, detected)
        emotion = detect_emotion(reply)
        yield json.dumps({"type": "text", "content": reply}) + "\n"
        yield json.dumps({
            "type": "done",
            "reply": reply,
            "language_detected": detected,
            "engine": "coder",
            "is_web_app": result.get("is_web_app", False),
            "preview_url": result.get("preview_url"),
            "download_url": result.get("download_url"),
            "files": result.get("files"),
            "code": result.get("code_preview"),
            "filename": result.get("filename"),
            "path": result.get("path"),
            "emotion": emotion,
            "task": task,
            "task_result": None
        }) + "\n"
        return


    # ── route: is this a time/date query? (direct handler, no LLM) ──
    time_reply = _handle_time_date_query(message, mode, name)
    if time_reply:
        memory_agent.save_turn(user_id, "assistant", time_reply, detected)
        yield json.dumps({"type": "text", "content": time_reply}) + "\n"
        yield json.dumps({
            "type": "done",
            "reply": time_reply,
            "language_detected": detected,
            "engine": "direct",
            "emotion": "friendly",
            "task": None,
            "task_result": None,
            "search_query": None,
            "search_results": []
        }) + "\n"
        return

    # ── route: is this a greeting? ──
    greeting_reply = _handle_greetings(message, mode, profile.get("display_name", "Commander"), detected)
    if greeting_reply:
        memory_agent.save_turn(user_id, "assistant", greeting_reply, detected)
        emotion = detect_emotion(greeting_reply)
        yield json.dumps({"type": "text", "content": greeting_reply}) + "\n"
        yield json.dumps({
            "type": "done",
            "reply": greeting_reply,
            "language_detected": detected,
            "engine": "predefined",
            "emotion": emotion,
            "task": None,
            "task_result": None,
            "search_query": None,
            "search_results": []
        }) + "\n"
        return

    memories = memory_agent.recall(user_id)
    persona_mode = persona.detect_mode(message)
    system = persona.build_system_prompt(
        persona_mode,
        char_name=profile.get("char_name", "LIA"),
        user_name=profile.get("display_name", "User"),
        detected_lang=detected,
        detected_expression=profile.get("latest_expression"),
    )
    
    # Inject current date and time for temporal awareness — emphatic instruction
    now_dt = datetime.datetime.now()
    system += (
        f"\n\n## CRITICAL — Current Date & Time (Real-Time System Clock)\n"
        f"The EXACT current date and time from the system clock is:\n"
        f"- Date: {now_dt.strftime('%A, %B %d, %Y')}\n"
        f"- Time: {now_dt.strftime('%I:%M %p')}\n"
        f"- Timezone: Local system time\n"
        f"If the user asks about the time or date, you MUST use EXACTLY these values. "
        f"Do NOT estimate, guess, or invent a different time. Use the exact values above.\n"
    )
    
    # Instruct local LLM how to trigger desktop actions
    system += (
        "\n\nDesktop Integration Tools:\n"
        "You can launch apps or run terminal commands. To request a task, embed one of these tags in your response:\n"
        "- [COMMAND: launch_app notepad]\n"
        "- [COMMAND: run_command dir]\n"
        "- [COMMAND: run_command start https://www.google.com] (to open websites/searches in the browser)\n"
        "- [COMMAND: list_files]\n"
        "Remember, all commands require user approval on their UI before executing. Always accompany any command tag with a warm, conversational explanation of what you are doing (e.g. 'I am launching Notepad for you! [COMMAND: launch_app notepad]'). Never output only the command tag; always include a spoken verbal response so the user knows what is happening."
    )

    if search_results:
        system += "\n\nWeb Search Results:\n"
        for idx, r in enumerate(search_results):
            system += f"[{idx+1}] Title: {r['title']}\n    URL: {r['link']}\n    Snippet: {r['snippet']}\n"
    
    if memories:
        system += "\n\nWhat you remember about your commander:\n- " + "\n- ".join(memories)

    messages = [{"role": "system", "content": system}]
    messages += memory_agent.recent_turns(user_id, limit=10)

    full_reply = ""
    engine = "ollama"
    try:
        for token in _ollama_chat_stream(messages):
            full_reply += token
            yield json.dumps({"type": "text", "content": token}) + "\n"
    except Exception as e:
        print(f"[Commander] Ollama stream failed: {e}. Falling back to Gemini.")
        full_reply = ""
        engine = "gemini"
        try:
            for token in _gemini_chat_stream(messages):
                full_reply += token
                yield json.dumps({"type": "text", "content": token}) + "\n"
        except Exception as e2:
            print(f"[Commander] Gemini stream failed: {e2}. Falling back to offline.")
            engine = "offline"

    if engine == "offline" or not full_reply.strip():
        if task:
            char_name = profile.get("char_name", "LIA")
            if task["type"] == "launch_app":
                app_name = task["app"]
                if mode == "english_gujarati":
                    full_reply = f"Chokkas! Hu {app_name} launch kari rahyo chu. Kripa karine screen par task approve karo."
                elif mode == "english_hindi":
                    full_reply = f"Ji bilkul! Main {app_name} launch kar raha hoon. Kripya screen par task approve kijiye."
                else:
                    full_reply = f"Sure! I am launching {app_name} for you. Please approve the task on your screen."
            elif task["type"] == "execute_command":
                cmd = task["command"]
                if mode == "english_gujarati":
                    full_reply = f"Samji gayo. Command '{cmd}' run kari rahyo chu. Kripa karine dashboard par authorize karo."
                elif mode == "english_hindi":
                    full_reply = f"Samajh gaya. Command '{cmd}' run kar raha hoon. Kripya dashboard par authorize kijiye."
                else:
                    full_reply = f"Understood. Running the command '{cmd}' now. Please authorize it on your dashboard."
            elif task["type"] == "list_files":
                if mode == "english_gujarati":
                    full_reply = "Workspace files access kari rahyo chu. Kripa karine query authorize karo."
                elif mode == "english_hindi":
                    full_reply = "Workspace files access kar raha hoon. Kripya query authorize kijiye."
                else:
                    full_reply = "Accessing workspace files now. Please authorize the query on your screen."
        elif search_query:
            if mode == "english_gujarati":
                full_reply = f"Dilgiri chu, maaru cloud brain offline che tethi hu '{search_query}' mate web search nathi kari shakto."
            elif mode == "english_hindi":
                full_reply = f"Maaf kijiye, mera cloud brain offline hai isliye main '{search_query}' ke liye search nahi kar sakta."
            else:
                full_reply = f"I'm sorry! My cloud brain is currently offline, so I can't search the web for '{search_query}' right now."
        else:
            full_reply = _offline_reply(message, mode, profile.get("display_name", "User"), profile.get("char_name", "LIA"))
        
        yield json.dumps({"type": "text", "content": full_reply}) + "\n"

    reply = full_reply
    reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*:\s*", "", reply, flags=re.IGNORECASE)
    reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*\n+", "", reply, flags=re.IGNORECASE)
    reply = reply.strip()

    if "[SEARCH:" in reply:
        search_match_tag = re.search(r"\[SEARCH:\s*([^\]]+)\]", reply)
        if search_match_tag:
            search_query = search_match_tag.group(1).strip()
            try:
                from . import search_agent
                is_dark = any(w in search_query.lower() or w in reply.lower() for w in ("dark web", "darkweb", "onion"))
                if is_dark:
                    search_results = search_agent.darkweb_search(search_query)
                else:
                    search_results = search_agent.web_search(search_query)
            except Exception as e:
                print(f"[Commander] Dynamic search failed: {e}")
            
            if search_results:
                search_system_content = f"Web Search Results for '{search_query}':\n"
                for idx, r in enumerate(search_results):
                    search_system_content += f"[{idx+1}] Title: {r['title']}\n    URL: {r['link']}\n    Snippet: {r['snippet']}\n"
                search_system_content += "\nProvide a unified, highly professional answer to the commander based on these results. Keep it speakable and natural. Do not mention search brackets."
                
                messages.append({"role": "assistant", "content": reply})
                messages.append({"role": "system", "content": search_system_content})
                
                second_reply = ""
                try:
                    if engine == "ollama":
                        for token in _ollama_chat_stream(messages):
                            second_reply += token
                            yield json.dumps({"type": "text", "content": token}) + "\n"
                    elif engine == "gemini":
                        for token in _gemini_chat_stream(messages):
                            second_reply += token
                            yield json.dumps({"type": "text", "content": token}) + "\n"
                except Exception:
                    pass
                
                if second_reply.strip():
                    reply = second_reply
                    reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*:\s*", "", reply, flags=re.IGNORECASE)
                    reply = re.sub(r"^(assistant|ai|lia|jarvis)\s*\n+", "", reply, flags=re.IGNORECASE)
                    reply = reply.strip()

    cmd_match = re.search(r"\[COMMAND:\s*(\w+)\s*([^\]]+)?\]", reply)
    if cmd_match:
        cmd_type = cmd_match.group(1).strip()
        cmd_arg = cmd_match.group(2).strip() if cmd_match.group(2) else ""
        if cmd_type == "launch_app":
            task = {"type": "launch_app", "app": cmd_arg}
        elif cmd_type == "run_command":
            task = {"type": "execute_command", "command": cmd_arg}
        elif cmd_type == "list_files":
            task = {"type": "list_files"}
        
    reply = re.sub(r"\[COMMAND:[^\]]+\]", "", reply)
    reply = re.sub(r"\[SEARCH:[^\]]+\]", "", reply).strip()

    # Strip markdown formatting so TTS doesn't read asterisks
    reply = strip_markdown_for_speech(reply)

    memory_agent.save_turn(user_id, "assistant", reply, detected)
    emotion = detect_emotion(reply)

    task_result = None
    if task and device_agent:
        task_result = _execute_task(task)

    yield json.dumps({
        "type": "done",
        "reply": reply,
        "language_detected": detected,
        "engine": engine,
        "emotion": emotion,
        "task": task,
        "task_result": task_result,
        "search_query": search_query,
        "search_results": search_results
    }) + "\n"


def greeting_for(user_id: str) -> dict:
    """Time-aware greeting in the user's language mode — spoken at wake-up."""
    profile = get_profile(user_id)
    mode = profile.get("language_mode", "auto")
    key = mode if mode in load("languages")["greetings"] else "english"
    hour = datetime.datetime.now().hour
    slot = ("morning" if 5 <= hour < 12 else
            "afternoon" if 12 <= hour < 17 else
            "evening" if 17 <= hour < 22 else "night")
    text = load("languages")["greetings"][key][slot].format(
        name=profile.get("display_name", "Commander"))
    return {"greeting": text, "slot": slot, "profile": profile}

