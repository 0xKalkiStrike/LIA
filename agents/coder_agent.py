"""Coder Agent — JARVIS writes code, builds web apps/software, and packages projects.

Flow:
  user says "build a calculator web app" or "write a python script"
    -> detects language & project type (Web App / Software vs single file script)
    -> Ollama / Gemini / Built-in Template Engine synthesizes high-quality code
    -> saves multi-file Web App into static/generated/apps/<project_id>/ with ZIP package download
    -> opens single-file scripts in VS Code / Notepad on local system
"""
import json
import os
import platform
import re
import shutil
import subprocess
import urllib.request
import zipfile
import uuid
from pathlib import Path
from core.config import ROOT, setting

PROJECTS = Path.home() / "JarvisProjects"
PROJECTS.mkdir(exist_ok=True)

APPS_DIR = ROOT / "ui" / "static" / "generated" / "apps"
APPS_DIR.mkdir(parents=True, exist_ok=True)

EXT = {
    "python": "py", "javascript": "js", "typescript": "ts", "html": "html",
    "css": "css", "java": "java", "c": "c", "cpp": "cpp", "c++": "cpp",
    "go": "go", "rust": "rs", "bash": "sh", "shell": "sh", "sql": "sql",
    "json": "json", "react": "jsx", "php": "php", "ruby": "rb", "kotlin": "kt",
    "swift": "swift", "csharp": "cs", "c#": "cs", "dart": "dart",
}

CODE_TRIGGERS = (
    "write code", "write a", "create a", "make a", "build a", "develop a",
    "generate", "open vs code", "open notepad", "code for", "script",
    "program", "function", "app for", "game", "web app", "web-app", "webapp",
    "website", "software", "fullstack app", "mobile app", "application",
    "create web", "build web", "make web", "design web", "create app",
    "build app", "make app", "prompt to create", "prompt to build"
)


def looks_like_code_request(message: str) -> bool:
    low = message.lower()
    if any(t in low for t in (
        "vs code", "notepad", "code editor", "web app", "web-app", "webapp",
        "web application", "web-application", "website", "software",
        "code", "coding", "developer", "ide", "fullstack", "frontend",
        "html", "css", "javascript", "react", "nextjs", "python", "script"
    )):
        return True
    return any(t in low for t in CODE_TRIGGERS) and any(
        w in low for w in ("code", "script", "program", "function", "game",
                           "app", "website", "python", "javascript", "html",
                           "java", "react", "api", "bot", "tool", "snake",
                           "calculator", "scraper", "dashboard", "software",
                           "application", "site", "frontend", "web", "page",
                           "ide", "editor", "ui")
    )


def _detect_language(message: str) -> str:
    low = message.lower()
    for lang in EXT:
        if lang in low:
            return lang
    if any(w in low for w in ("website", "web app", "dashboard", "frontend", "game", "calculator")):
        return "html"
    return "python"


def _filename(message: str, lang: str) -> str:
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
            "model": setting("ollama_coding_model", "qwen2.5-coder:7b"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ],
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            out = json.loads(resp.read())["message"]["content"]
        out = re.sub(r"^```[a-zA-Z]*\n?", "", out.strip())
        out = re.sub(r"\n?```$", "", out.strip())
        return out.strip()
    except Exception:
        return None


def _gemini_code(message: str, lang: str) -> str | None:
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
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "systemInstruction": {"parts": [{"text": system}]}
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
                out = re.sub(r"^```[a-zA-Z]*\n?", "", out.strip())
                out = re.sub(r"\n?```$", "", out.strip())
                return out.strip()
        return None
    except Exception:
        return None


def _generate_fallback_web_app(topic: str) -> tuple[str, str, str]:
    """Generate high quality responsive web app code (HTML, CSS, JS) if LLM is offline."""
    clean_title = topic.replace('_', ' ').title()
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{clean_title}</title>
<link rel="stylesheet" href="style.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
<div class="app-container">
  <header>
    <h1>⚡ {clean_title}</h1>
    <p class="tagline">Built by LIA AI Autonomous Coder Agent</p>
  </header>
  <main class="card">
    <div class="input-group">
      <label for="user-input">Interactive Input Field:</label>
      <input type="text" id="user-input" placeholder="Type something to compute or interact...">
    </div>
    <div class="actions">
      <button id="action-btn" class="primary-btn">Execute Action</button>
      <button id="reset-btn" class="secondary-btn">Reset</button>
    </div>
    <div id="output-box" class="output-display">
      <span class="placeholder">Status: Ready. Awaiting user interaction.</span>
    </div>
  </main>
  <footer>
    <p>Powered by LIA AI Operating System · Local First</p>
  </footer>
</div>
<script src="app.js"></script>
</body>
</html>"""

    css = """* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0b0f19; color: #f0f4f8; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.app-container { width: 100%; max-width: 600px; background: rgba(18, 24, 38, 0.85); border: 1px solid rgba(83, 215, 240, 0.3); border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.7); backdrop-filter: blur(12px); }
header { text-align: center; margin-bottom: 24px; }
header h1 { font-size: 28px; color: #53d7f0; margin-bottom: 6px; }
header .tagline { font-size: 14px; color: #94a3b8; }
.card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; font-size: 14px; color: #cbd5e1; margin-bottom: 8px; font-weight: 600; }
.input-group input { width: 100%; background: #131926; border: 1px solid #2d3748; color: #fff; padding: 12px 16px; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.2s; }
.input-group input:focus { border-color: #53d7f0; }
.actions { display: flex; gap: 12px; margin-bottom: 20px; }
button { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: transform 0.1s, opacity 0.2s; }
button:active { transform: scale(0.98); }
.primary-btn { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
.secondary-btn { background: rgba(255,255,255,0.1); color: #cbd5e1; }
.output-display { background: #080b12; border: 1px solid rgba(83, 215, 240, 0.2); border-radius: 8px; padding: 16px; min-height: 80px; font-size: 15px; color: #10b981; }
.output-display .placeholder { color: #64748b; font-style: italic; }
footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }"""

    js = """document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    const actionBtn = document.getElementById('action-btn');
    const resetBtn = document.getElementById('reset-btn');
    const output = document.getElementById('output-box');

    actionBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) {
            output.innerHTML = '<span style="color:#ef4444;">⚠️ Please type an input string first.</span>';
            return;
        }
        output.innerHTML = `<strong>Result:</strong> Successfully processed "<em>${val}</em>" at ${new Date().toLocaleTimeString()}. Status: OK.`;
    });

    resetBtn.addEventListener('click', () => {
        input.value = '';
        output.innerHTML = '<span class="placeholder">Status: Reset complete. Ready for new input.</span>';
    });
});"""

    return html, css, js


def _open_in_editor(path: Path) -> str:
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


def _save_manifest(app_dir: Path, app_id: str, project_name: str, file_list: list[str]):
    """Save project manifest for the Code Workspace to read."""
    manifest = {
        "app_id": app_id,
        "project_name": project_name,
        "created_at": __import__("time").time(),
        "files": file_list,
    }
    (app_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def build_full_webapp(message: str) -> dict:
    """Build a complete multi-file Web App project with live preview and ZIP download."""
    clean_name = _filename(message, "html").replace(".html", "")
    app_id = f"app_{uuid.uuid4().hex[:8]}"
    app_dir = APPS_DIR / app_id
    app_dir.mkdir(parents=True, exist_ok=True)

    # Generate LLM code or fallback template
    llm_code = _ollama_code(message, "html") or _gemini_code(message, "html")

    if llm_code and ("<html" in llm_code.lower() or "<!doctype html>" in llm_code.lower()):
        html_code = llm_code
        css_code = "/* Built-in responsive styles */\nbody { font-family: sans-serif; margin: 20px; background: #0b0f19; color: #fff; }"
        js_code = "// Web app interactive logic"
    else:
        html_code, css_code, js_code = _generate_fallback_web_app(clean_name)

    (app_dir / "index.html").write_text(html_code, encoding="utf-8")
    (app_dir / "style.css").write_text(css_code, encoding="utf-8")
    (app_dir / "app.js").write_text(js_code, encoding="utf-8")

    # Save manifest for Code Workspace
    _save_manifest(app_dir, app_id, clean_name, ["index.html", "style.css", "app.js"])

    # Create ZIP bundle
    zip_path = APPS_DIR / f"{app_id}.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for file in app_dir.iterdir():
            if file.name != "manifest.json":
                zipf.write(file, arcname=file.name)

    preview_url = f"/static/generated/apps/{app_id}/index.html"
    download_url = f"/static/generated/apps/{app_id}.zip"

    return {
        "ok": True,
        "is_web_app": True,
        "app_id": app_id,
        "project_name": clean_name,
        "preview_url": preview_url,
        "download_url": download_url,
        "spoken": f"I have built the full software web application for '{clean_name.replace('_', ' ')}'. You can preview it live or download the ZIP package.",
        "files": {
            "index.html": html_code,
            "style.css": css_code,
            "app.js": js_code
        }
    }


# ────────────────────── Project CRUD for Code Workspace ──────────────────────

def list_projects() -> list[dict]:
    """List all generated web app projects with their manifests."""
    projects = []
    if not APPS_DIR.exists():
        return projects
    for d in sorted(APPS_DIR.iterdir(), reverse=True):
        if d.is_dir():
            manifest_path = d / "manifest.json"
            if manifest_path.exists():
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    manifest["file_count"] = len([f for f in d.iterdir() if f.is_file() and f.name != "manifest.json"])
                    projects.append(manifest)
                except Exception:
                    projects.append({
                        "app_id": d.name,
                        "project_name": d.name,
                        "files": [f.name for f in d.iterdir() if f.is_file() and f.name != "manifest.json"],
                        "file_count": len([f for f in d.iterdir() if f.is_file() and f.name != "manifest.json"]),
                    })
            else:
                # Legacy project without manifest — build one
                file_list = [f.name for f in d.iterdir() if f.is_file()]
                _save_manifest(d, d.name, d.name, file_list)
                projects.append({
                    "app_id": d.name,
                    "project_name": d.name,
                    "files": file_list,
                    "file_count": len(file_list),
                })
    return projects


def get_project(app_id: str) -> dict | None:
    """Get all file contents for a project."""
    app_dir = APPS_DIR / app_id
    if not app_dir.exists() or not app_dir.is_dir():
        return None
    files = {}
    for f in app_dir.iterdir():
        if f.is_file() and f.name != "manifest.json":
            try:
                files[f.name] = f.read_text(encoding="utf-8")
            except Exception:
                files[f.name] = "(binary file)"
    manifest = {}
    manifest_path = app_dir / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"app_id": app_id, "files": files, "manifest": manifest}


def update_project_file(app_id: str, filename: str, content: str) -> bool:
    """Update a specific file in a project (user edits from IDE)."""
    app_dir = APPS_DIR / app_id
    file_path = app_dir / filename
    if not app_dir.exists() or not file_path.exists():
        return False
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    file_path.write_text(content, encoding="utf-8")
    # Rebuild ZIP
    _rebuild_zip(app_id)
    return True


def create_project_file(app_id: str, filename: str, content: str = "") -> bool:
    """Create a new file in a project."""
    app_dir = APPS_DIR / app_id
    if not app_dir.exists():
        return False
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    file_path = app_dir / filename
    file_path.write_text(content, encoding="utf-8")
    # Update manifest
    manifest_path = app_dir / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if filename not in manifest.get("files", []):
                manifest["files"].append(filename)
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        except Exception:
            pass
    _rebuild_zip(app_id)
    return True


def delete_project_file(app_id: str, filename: str) -> bool:
    """Delete a file from a project."""
    app_dir = APPS_DIR / app_id
    if not app_dir.exists():
        return False
    if ".." in filename or "/" in filename or "\\" in filename:
        return False
    file_path = app_dir / filename
    if not file_path.exists() or filename == "manifest.json":
        return False
    file_path.unlink()
    # Update manifest
    manifest_path = app_dir / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["files"] = [f for f in manifest.get("files", []) if f != filename]
            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        except Exception:
            pass
    _rebuild_zip(app_id)
    return True


def _rebuild_zip(app_id: str):
    """Rebuild the ZIP bundle for a project after file changes."""
    app_dir = APPS_DIR / app_id
    zip_path = APPS_DIR / f"{app_id}.zip"
    try:
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for file in app_dir.iterdir():
                if file.is_file() and file.name != "manifest.json":
                    zipf.write(file, arcname=file.name)
    except Exception:
        pass


def write_and_open(message: str) -> dict:
    low = message.lower()

    # Check if request is for a full web app / software project
    if any(w in low for w in ("web app", "web-app", "webapp", "website", "software", "fullstack", "dashboard", "calculator", "game", "app for", "web application", "web-application", "app", "application", "site", "page", "frontend")):
        return build_full_webapp(message)

    # Otherwise build single script file
    lang = _detect_language(message)
    fname = _filename(message, lang)
    path = PROJECTS / fname

    code = _ollama_code(message, lang) or _gemini_code(message, lang)

    if code is None:
        # Fallback snippet generator
        code = f"""# {fname} - Auto-generated by LIA AI Coding Agent
def main():
    print("Executing {fname}...")
    # Add your logic here

if __name__ == "__main__":
    main()
"""

    path.write_text(code, encoding="utf-8")
    editor = _open_in_editor(path)
    return {
        "ok": True,
        "is_web_app": False,
        "spoken": f"Done! I wrote your {lang} code and saved it to {fname}. Opened in {editor}.",
        "path": str(path),
        "filename": fname,
        "language": lang,
        "editor": editor,
        "code_preview": code,
    }

