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
from . import language_agent, memory_agent
from .auth_agent import get_profile

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


# ---------------------------------------------------------------- Emotion ---
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
    """Call local Ollama. Returns None if unreachable so caller can fall back."""
    try:
        payload = json.dumps({
            "model": setting("ollama_model", "llama3.2"),
            "messages": messages,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
        return data.get("message", {}).get("content")
    except Exception:
        return None


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


# ------------------------------------------------------- offline fallback ---
_OFFLINE = {
    "english_gujarati": {
        "hello": "કેમ છો! હું તૈયાર છું — બોલો શું કરવું છે?",
        "time": "અત્યારે સમય {time} થયો છે.",
        "thanks": "તમારું સ્વાગત છે, {name}!",
        "who_are_you": "હું {char_name} છું, તમારું પર્સનલ એઆઈ આસિસ્ટન્ટ. અત્યારે હું ઑફલાઇન છું, પણ તમારી મદદ કરવા તૈયાર છું!",
        "how_are_you": "બહુ સારું છે. પૂછવા માટે આભાર, કમાન્ડર!",
        "joke": "કોમ્પ્યુટરને ડૉક્ટર પાસે કેમ જવું પડ્યું? કેમ કે તેમાં વાયરસ હતો!",
        "weather": "મારી પાસે અત્યારે લાઈવ હવામાનનો ડેટા નથી કેમ કે મારું ક્લાઉડ બ્રેઈન ઑફલાઇન છે.",
        "default": "હું અત્યારે ઑફલાઇન બ્રેઈન પર ચાલું છું. કૃપા કરીને ઓલામા ચાલુ કરો જેથી હું સંપૂર્ણ શક્તિમાં આવી શકું! તમે જે કહ્યું તે મેં યાદ રાખ્યું છે.",
    },
    "english_hindi": {
        "hello": "Kaise ho! Main ready hoon — boliye kya karna hai?",
        "time": "Abhi time hai {time}.",
        "thanks": "Aapka swagat hai, {name}!",
        "who_are_you": "Main {char_name} hoon, aapka personal AI assistant. Abhi main offline chalu hoon, par aapki madad ke liye taiyar hoon!",
        "how_are_you": "Sab badhiya hai. Poochhne ke liye dhanyavad, commander!",
        "joke": "Computer ko doctor ke paas kyun jana pada? Kyunki usme virus tha!",
        "weather": "Mere paas abhi live weather data nahi hai kyunki mera cloud brain offline hai.",
        "default": ("Main abhi offline brain par chal raha hoon. Ollama start "
                    "kijiye (`ollama serve` + `ollama pull llama3.2`) phir main "
                    "full power me aa jaunga! Aapki baat maine yaad rakh li hai."),
    },
    "english": {
        "hello": "Hello! I am ready — what shall we do?",
        "time": "It is {time} right now.",
        "thanks": "You are most welcome, {name}.",
        "who_are_you": "I am {char_name}, your personal AI assistant. I am currently running offline, but ready to assist you!",
        "how_are_you": "All systems are running within normal parameters. Thank you for asking, commander!",
        "joke": "Why did the computer go to the doctor? Because it had a virus!",
        "weather": "I don't have access to live weather data right now because my cloud brain is offline, but it's always a good day to code!",
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

    has_krishna = any(w in clean for w in ("krishna", "krishnaa", "krisna"))
    has_kem_cho = any(w in clean for w in ("kem cho", "kem chho", "kemcho", "kemchho"))
    has_jai_shree = any(w in clean for w in ("jai shree", "jay shree", "jai shri", "jay shri", "pranam", "jai shree krishna", "jay shree krishna"))

    # Case 1: Kem cho, Jai Shree Krishna!
    if has_kem_cho and (has_krishna or has_jai_shree):
        if mode == "english_gujarati" or (mode == "auto" and detected_lang == "gujarati"):
            return f"જય શ્રી કૃષ્ણ, {name}! હું મજામાં છું. તમે કેમ છો?"
        elif mode == "english_hindi" or (mode == "auto" and detected_lang == "hindi"):
            return f"जय श्री कृष्ण, {name}! मैं ठीक हूँ। आप कैसे हैं?"
        else:
            return f"Jai Shree Krishna, {name}! I am doing great. How are you?"

    # Case 2: Jai Shree Krishna! / Pranam / Hare Krishna
    if has_krishna or has_jai_shree:
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

    memory_agent.save_turn(user_id, "user", message, detected)
    memory_agent.auto_extract(user_id, message)



    low_msg = message.lower().strip()
    task = None

    search_query = None
    search_results = []

    # Check direct browser / url / search heuristics first
    task = _detect_browser_url_search_task(message)

    # Check direct search heuristics if no browser task detected
    if not task:
        search_match = re.match(r"^(?:search\s+for|google|web\s*search)\s+(.+)$", low_msg)
    if search_match:
        search_query = search_match.group(1).strip()
        try:
            from . import search_agent
            search_results = search_agent.web_search(search_query)
        except Exception as e:
            print(f"[Commander] Search failed: {e}")

    # Offline Desktop Command Heuristics
    open_match = re.match(r"^(?:open|launch|start)\s+([a-zA-Z0-9_\s\.\-]+)$", low_msg)
    if open_match:
        app = open_match.group(1).strip()
        task = {"type": "launch_app", "app": app}
    elif "list files" in low_msg or "show files" in low_msg or "browse files" in low_msg:
        task = {"type": "list_files"}
    else:
        run_match = re.match(r"^(?:run|execute|shell|run command|execute command|run shell)\s+(.+)$", low_msg)
        if run_match:
            cmd = run_match.group(1).strip()
            task = {"type": "execute_command", "command": cmd}

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

    # ── route: is this a "write code / open VS Code" request? ──
    if task is None and coder_agent and coder_agent.looks_like_code_request(message):
        result = coder_agent.write_and_open(message)
        memory_agent.save_turn(user_id, "assistant", result["spoken"], detected)
        emotion = detect_emotion(result["spoken"])
        return {
            "reply": result["spoken"],
            "language_detected": detected,
            "engine": "coder",
            "code": result.get("code_preview"),
            "filename": result.get("filename"),
            "path": result.get("path"),
            "emotion": emotion,
            "task": task
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
    system = language_agent.system_prompt_for(
        mode, profile.get("char_name", "JARVIS"), profile.get("display_name", "Commander"), detected_lang=detected
    )
    
    # Inject current date and time for temporal awareness
    now_dt = datetime.datetime.now()
    system += (
        f"\n\nCurrent System Context:\n"
        f"- Date: {now_dt.strftime('%A, %B %d, %Y')}\n"
        f"- Time: {now_dt.strftime('%I:%M %p')}\n"
    )
    
    # Instruct local LLM how to trigger desktop actions
    system += (
        "\n\nDesktop Integration Tools:\n"
        "You can launch apps or run terminal commands. To request a task, embed one of these tags in your response:\n"
        "- [COMMAND: launch_app notepad]\n"
        "- [COMMAND: run_command dir]\n"
        "- [COMMAND: run_command start https://www.google.com] (to open websites/searches in the browser)\n"
        "- [COMMAND: list_files]\n"
        "Remember, all commands require user approval on their UI before executing."
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

    # Route: is this a search tag request generated dynamically by LLM?
    if reply and "[SEARCH:" in reply:
        search_match_tag = re.search(r"\[SEARCH:\s*([^\]]+)\]", reply)
        if search_match_tag:
            search_query = search_match_tag.group(1).strip()
            try:
                from . import search_agent
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
            char_name = profile.get("char_name", "JARVIS")
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
                reply = f"I apologize, commander. My cloud brain is currently offline, so I cannot perform a web search for '{search_query}' right now."
        else:
            reply = _offline_reply(message, mode, profile.get("display_name", "Commander"), profile.get("char_name", "JARVIS"))
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

