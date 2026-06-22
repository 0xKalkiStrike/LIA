"""Coder Agent — JARVIS writes code and opens it in your editor.

This is the REAL version of "control my laptop": a browser tab cannot do it,
but JARVIS runs locally, so THIS Python process genuinely can write files to
disk and launch VS Code / Notepad on the same machine.

Flow:
  user says "write a snake game in python"
    -> detect language + filename
    -> Ollama writes the code (with an internet research hint if available)
    -> save to ~/JarvisProjects/<file>
    -> open in VS Code (`code <file>`), else OS default editor / Notepad
"""
import json
import os
import platform
import re
import shutil
import subprocess
import urllib.request
from pathlib import Path

from core.config import setting

PROJECTS = Path.home() / "JarvisProjects"
PROJECTS.mkdir(exist_ok=True)

EXT = {
    "python": "py", "javascript": "js", "typescript": "ts", "html": "html",
    "css": "css", "java": "java", "c": "c", "cpp": "cpp", "c++": "cpp",
    "go": "go", "rust": "rs", "bash": "sh", "shell": "sh", "sql": "sql",
    "json": "json", "react": "jsx", "php": "php", "ruby": "rb", "kotlin": "kt",
    "swift": "swift", "csharp": "cs", "c#": "cs", "dart": "dart",
}

CODE_TRIGGERS = ("write code", "write a", "create a", "make a", "build a",
                 "generate", "open vs code", "open notepad", "code for",
                 "script", "program", "function", "app for", "game")


def looks_like_code_request(message: str) -> bool:
    low = message.lower()
    if any(t in low for t in ("vs code", "notepad", "code editor")):
        return True
    return any(t in low for t in CODE_TRIGGERS) and any(
        w in low for w in ("code", "script", "program", "function", "game",
                           "app", "website", "python", "javascript", "html",
                           "java", "react", "api", "bot", "tool", "snake",
                           "calculator", "scraper"))


def _detect_language(message: str) -> str:
    low = message.lower()
    for lang in EXT:
        if lang in low:
            return lang
    if "website" in low or "web page" in low:
        return "html"
    return "python"  # sensible default


def _filename(message: str, lang: str) -> str:
    # try to name it after the thing requested
    m = re.search(r"(?:a|an)\s+([a-z0-9 ]{3,40}?)(?:\s+(?:in|using|with|for)\b|$)", message.lower())
    base = (m.group(1).strip() if m else "jarvis_code")
    base = re.sub(r"[^a-z0-9]+", "_", base).strip("_")[:40] or "jarvis_code"
    return f"{base}.{EXT.get(lang, 'txt')}"


def _ollama_code(message: str, lang: str) -> str | None:
    system = (
        f"You are an expert {lang} developer. Write COMPLETE, runnable {lang} code "
        f"for the user's request. Output ONLY the raw code — no markdown fences, no "
        f"explanation, no commentary. Include brief inline comments and make it "
        f"production-quality and self-contained."
    )
    try:
        payload = json.dumps({
            "model": setting("ollama_model", "llama3.2"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as resp:
            out = json.loads(resp.read())["message"]["content"]
        # strip accidental ``` fences
        out = re.sub(r"^```[a-zA-Z]*\n?", "", out.strip())
        out = re.sub(r"\n?```$", "", out.strip())
        return out.strip()
    except Exception:
        return None


def _gemini_code(message: str, lang: str) -> str | None:
    """Write code using Google Gemini API as a fallback if Ollama is offline."""
    api_key = os.environ.get("GEMINI_API_KEY") or setting("gemini_api_key")
    if not api_key:
        return None
    system = (
        f"You are an expert {lang} developer. Write COMPLETE, runnable {lang} code "
        f"for the user's request. Output ONLY the raw code — no markdown fences, no "
        f"explanation, no commentary. Include brief inline comments and make it "
        f"production-quality and self-contained."
    )
    try:
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": message}]}
            ],
            "systemInstruction": {
                "parts": [{"text": system}]
            }
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                out = parts[0].get("text", "")
                # strip accidental ``` fences
                out = re.sub(r"^```[a-zA-Z]*\n?", "", out.strip())
                out = re.sub(r"\n?```$", "", out.strip())
                return out.strip()
        return None
    except Exception:
        return None


def _open_in_editor(path: Path) -> str:
    """Try VS Code first, then Notepad (Windows) / default editor."""
    code_bin = shutil.which("code")
    if code_bin:
        try:
            subprocess.Popen([code_bin, str(path)])
            return "VS Code"
        except Exception:
            pass
    system = platform.system()
    try:
        if system == "Windows":
            subprocess.Popen(["notepad.exe", str(path)])
            return "Notepad"
        elif system == "Darwin":
            subprocess.Popen(["open", "-t", str(path)])
            return "the default editor"
        else:
            subprocess.Popen(["xdg-open", str(path)])
            return "the default editor"
    except Exception:
        return "saved (open it manually)"


def write_and_open(message: str) -> dict:
    lang = _detect_language(message)
    fname = _filename(message, lang)
    path = PROJECTS / fname

    code = _ollama_code(message, lang)
    if code is None:
        code = _gemini_code(message, lang)

    if code is None:
        return {
            "ok": False,
            "spoken": ("I need Ollama running or a Gemini API key configured to write code. "
                       "Start Ollama or set GEMINI_API_KEY in settings.json, then ask me again."),
            "path": None,
        }

    path.write_text(code, encoding="utf-8")
    editor = _open_in_editor(path)
    return {
        "ok": True,
        "spoken": (f"Done! I wrote your {lang} code and opened it in {editor}. "
                   f"The file is saved as {fname}."),
        "path": str(path),
        "filename": fname,
        "language": lang,
        "editor": editor,
        "code_preview": code[:1200],
    }



