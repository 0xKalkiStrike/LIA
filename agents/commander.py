"""Commander Agent — the central brain.

Pipeline:  message -> language detection -> memory recall -> system prompt
           -> Ollama (local LLM)  ->  reply  ->  memory write.

If Ollama is not running, a built-in offline responder keeps JARVIS alive.
"""
import datetime
import json
import urllib.request
import re

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


# ------------------------------------------------------- offline fallback ---
_OFFLINE = {
    "english_gujarati": {
        "hello": "Kem cho! Hu ready chu — bolo su karvu che?",
        "time": "Atyare time che {time}.",
        "thanks": "Tamaru swagat che, {name}!",
        "default": ("Hu atyare offline brain par chalu chu. Ollama start karo "
                    "(`ollama serve` + `ollama pull llama3.2`) etle hu full "
                    "power ma aavi jaish! Tame je kahyu te me yaad rakhyu che."),
    },
    "english_hindi": {
        "hello": "Kaise ho! Main ready hoon — boliye kya karna hai?",
        "time": "Abhi time hai {time}.",
        "thanks": "Aapka swagat hai, {name}!",
        "default": ("Main abhi offline brain par chal raha hoon. Ollama start "
                    "kijiye (`ollama serve` + `ollama pull llama3.2`) phir main "
                    "full power me aa jaunga! Aapki baat maine yaad rakh li hai."),
    },
    "english": {
        "hello": "Hello! I am ready — what shall we do?",
        "time": "It is {time} right now.",
        "thanks": "You are most welcome, {name}.",
        "default": ("I am running on my offline brain right now. Start Ollama "
                    "(`ollama serve`, then `ollama pull llama3.2`) and I will "
                    "switch to full intelligence automatically. I have noted "
                    "what you said."),
    },
}


def _offline_reply(message: str, mode: str, name: str) -> str:
    pack = _OFFLINE.get(mode, _OFFLINE["english"])
    low = message.lower()
    t = datetime.datetime.now().strftime("%I:%M %p")
    if any(w in low for w in ("hello", "hi ", "hey", "kem cho", "kaise ho", "namaste")):
        return pack["hello"]
    if "time" in low or "samay" in low:
        return pack["time"].format(time=t)
    if any(w in low for w in ("thank", "dhanyavad", "aabhar")):
        return pack["thanks"].format(name=name)
    if device_agent and any(w in low for w in ("cpu", "ram", "battery", "system", "status")):
        return device_agent.status_text()
    return pack["default"]


# ----------------------------------------------------------------- public ---
def handle_message(user_id: str, message: str) -> dict:
    profile = get_profile(user_id)
    mode = profile.get("language_mode", "auto")
    detected = language_agent.detect_language(message)

    memory_agent.save_turn(user_id, "user", message, detected)
    memory_agent.auto_extract(user_id, message)

    low_msg = message.lower().strip()
    task = None

    # Offline Desktop Command Heuristics
    if "open notepad" in low_msg:
        task = {"type": "launch_app", "app": "notepad"}
    elif "open calculator" in low_msg or "open calc" in low_msg:
        task = {"type": "launch_app", "app": "calculator"}
    elif "open explorer" in low_msg:
        task = {"type": "launch_app", "app": "explorer"}
    elif "open paint" in low_msg:
        task = {"type": "launch_app", "app": "paint"}
    elif "list files" in low_msg or "show files" in low_msg or "browse files" in low_msg:
        task = {"type": "list_files"}
    elif "run command" in low_msg or "execute command" in low_msg or "run shell" in low_msg:
        cmd_parts = re.split(r"run command\s+|execute command\s+|run shell\s+", low_msg)
        if len(cmd_parts) > 1:
            task = {"type": "execute_command", "command": cmd_parts[1].strip()}

    # ── route: is this a "write code / open VS Code" request? ──
    if coder_agent and coder_agent.looks_like_code_request(message):
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

    memories = memory_agent.recall(user_id)
    system = language_agent.system_prompt_for(
        mode, profile.get("char_name", "JARVIS"), profile.get("display_name", "Commander")
    )
    
    # Instruct local LLM how to trigger desktop actions
    system += (
        "\n\nDesktop Integration Tools:\n"
        "You can launch apps or run terminal commands. To request a task, embed one of these tags in your response:\n"
        "- [COMMAND: launch_app notepad]\n"
        "- [COMMAND: run_command dir]\n"
        "- [COMMAND: list_files]\n"
        "Remember, all commands require user approval on their UI before executing."
    )
    
    if memories:
        system += "\n\nWhat you remember about your commander:\n- " + "\n- ".join(memories)

    messages = [{"role": "system", "content": system}]
    messages += memory_agent.recent_turns(user_id, limit=10)

    reply = _ollama_chat(messages)
    engine = "ollama"
    if reply is None:
        reply = _offline_reply(message, mode, profile.get("display_name", "Commander"))
        engine = "offline"
    else:
        # Extract commands from LLM tags if online
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
            # Clean reply of the tags
            reply = re.sub(r"\[COMMAND:[^\]]+\]", "", reply).strip()

    memory_agent.save_turn(user_id, "assistant", reply, detected)
    emotion = detect_emotion(reply)
    
    return {
        "reply": reply,
        "language_detected": detected,
        "engine": engine,
        "emotion": emotion,
        "task": task
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

