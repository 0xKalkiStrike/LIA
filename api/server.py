"""JARVIS AI — FastAPI server.

Routes
------
GET  /api/state            -> first-run check (no users => onboarding)
POST /api/signup           -> character + voice + language + account creation
POST /api/login            -> name + secret word  ->  session token
POST /api/logout
GET  /api/greeting         -> wake-up greeting (character animation trigger)
GET  /api/profile          -> avatar + voice + language config
POST /api/profile          -> update character / voice / language
POST /api/chat             -> talk to the Commander Agent
GET  /api/memories         -> what JARVIS remembers about you
POST /api/memories         -> teach JARVIS something
GET  /api/device           -> system status
POST /api/vision/explain   -> upload image  ->  object/product intelligence
POST /api/ocr              -> upload image  ->  text reading
Static UI served at /
"""
import io
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from pydantic import BaseModel

from core.config import ROOT, load
from core.database import init_db, db, new_id, now
from core.security import resolve_session, end_session
from agents import auth_agent, commander, memory_agent, device_agent, coder_agent

app = FastAPI(title="JARVIS AI", version="1.0.0")
init_db()

STATIC = ROOT / "ui" / "static"


# ------------------------------------------------------------------ helpers
def require_user(authorization: str | None) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = resolve_session(token)
    if not user_id:
        raise HTTPException(401, "Session expired — please log in again.")
    return user_id


# ------------------------------------------------------------------- models
class SignupBody(BaseModel):
    username: str
    display_name: str = ""
    secret_word: str
    profile: dict = {}


class LoginBody(BaseModel):
    username: str
    secret_word: str


class ChatBody(BaseModel):
    message: str


class MemoryBody(BaseModel):
    content: str
    category: str = "fact"


class ExecuteBody(BaseModel):
    task_type: str
    target: str


class TelemetryBody(BaseModel):
    event: str
    meta: str = ""


# -------------------------------------------------------------------- auth
@app.get("/api/state")
def state():
    return {
        "has_users": auth_agent.has_users(),
        "voices": load("voices")["personas"],
        "language_modes": load("languages")["modes"],
        "tts_lang": load("languages")["tts_lang"],
    }


@app.post("/api/signup")
def signup(body: SignupBody):
    try:
        user_id, token = auth_agent.create_account(
            body.username, body.display_name, body.secret_word, body.profile)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"token": token, "profile": auth_agent.get_profile(user_id)}


@app.post("/api/login")
def login(body: LoginBody):
    try:
        user_id, token = auth_agent.login(body.username, body.secret_word)
    except ValueError as e:
        raise HTTPException(401, str(e))
    return {"token": token, "profile": auth_agent.get_profile(user_id)}


@app.post("/api/logout")
def logout(authorization: str | None = Header(default=None)):
    end_session((authorization or "").removeprefix("Bearer ").strip())
    return {"ok": True}


# ----------------------------------------------------------- profile & wake
@app.get("/api/greeting")
def greeting(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    return commander.greeting_for(user_id)


@app.get("/api/profile")
def get_profile(authorization: str | None = Header(default=None)):
    return auth_agent.get_profile(require_user(authorization))


@app.post("/api/profile")
def set_profile(changes: dict, authorization: str | None = Header(default=None)):
    return auth_agent.update_profile(require_user(authorization), changes)


# -------------------------------------------------------------------- chat
@app.post("/api/chat")
def chat(body: ChatBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    if not body.message.strip():
        raise HTTPException(400, "Empty message.")
    return commander.handle_message(user_id, body.message.strip())


# ------------------------------------------------------------------ memory
@app.get("/api/memories")
def memories(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        rows = conn.execute(
            "SELECT category, content, created_at FROM Memories "
            "WHERE user_id=? ORDER BY created_at DESC LIMIT 100", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/memories")
def add_memory(body: MemoryBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    memory_agent.remember(user_id, body.content, body.category, importance=2)
    return {"ok": True}


# ------------------------------------------------------------------ device
@app.get("/api/device")
def device(authorization: str | None = Header(default=None)):
    require_user(authorization)
    return device_agent.status()


@app.get("/api/device/processes")
def device_processes(authorization: str | None = Header(default=None)):
    require_user(authorization)
    import psutil
    proc = []
    if psutil:
        try:
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                proc.append(p.info)
        except Exception:
            pass
    return {"processes": proc[:50]} # Top 50 processes


# ------------------------------------------------------------------ desktop
@app.get("/api/desktop/files")
def desktop_files(path: str | None = None, authorization: str | None = Header(default=None)):
    require_user(authorization)
    return {"files": device_agent.list_files(path)}


@app.post("/api/desktop/execute")
def desktop_execute(body: ExecuteBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    if body.task_type == "launch_app":
        return device_agent.launch_app(body.target)
    elif body.task_type == "execute_command":
        return device_agent.run_command(body.target)
    elif body.task_type == "list_files":
        return {"ok": True, "files": device_agent.list_files()}
    raise HTTPException(400, "Invalid task type.")


@app.post("/api/vision/telemetry")
def vision_telemetry(body: TelemetryBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        conn.execute(
            "INSERT INTO Detections VALUES (?,?,?,?,?,?,?)",
            (new_id(), user_id, "telemetry", body.event, 1.0, body.meta, now())
        )
    
    reply = None
    if body.event == "hand_wave":
        reply = "I see you waving! Hello there, commander!"
    elif body.event == "smile":
        reply = "Looking happy! That's what I like to see."
    elif body.event == "presence_lost":
        reply = "Commander has walked away."
    elif body.event == "presence_gain":
        reply = "Welcome back, commander. Ready when you are."
        
    return {"ok": True, "reply": reply}


# ----------------------------------------------------------- vision & OCR
def _save_upload(file: UploadFile) -> str:
    suffix = Path(file.filename or "img.jpg").suffix or ".jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    with tmp as out:
        shutil.copyfileobj(file.file, out)
    return tmp.name


@app.post("/api/vision/explain")
def vision_explain(file: UploadFile = File(...),
                   question: str = Form("What is this?"),
                   authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    from agents import vision_agent
    path = _save_upload(file)
    return {"answer": vision_agent.explain(path, question, user_id)}


@app.post("/api/ocr")
def ocr(file: UploadFile = File(...),
        authorization: str | None = Header(default=None)):
    require_user(authorization)
    from agents import ocr_agent
    path = _save_upload(file)
    try:
        return {"text": ocr_agent.read_text(path)}
    except RuntimeError as e:
        raise HTTPException(501, str(e))


# ---------------------------------------------------------------------- TTS
@app.get("/api/tts")
def tts(text: str = Query(...), voice: str = Query("friday"),
        authorization: str | None = Header(default=None)):
    """Generate speech audio via Piper TTS. Returns WAV audio stream."""
    require_user(authorization)
    from agents import voice_agent
    try:
        audio_bytes = voice_agent.synthesize(text, voice)
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"Cache-Control": "no-cache", "X-Voice": voice}
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/api/tts/status")
def tts_status(authorization: str | None = Header(default=None)):
    """Check whether Piper TTS is available."""
    require_user(authorization)
    from agents import voice_agent
    return voice_agent.tts_status()


@app.post("/api/tts/install")
def tts_install(authorization: str | None = Header(default=None)):
    """Install piper-tts and download the default female voice model."""
    require_user(authorization)
    from agents import voice_agent
    result = voice_agent.install_piper()
    return result


# ------------------------------------------------------------------ AVATAR
_VRM_DIR = STATIC
_VRM_DIR.mkdir(exist_ok=True)


@app.post("/api/avatar/upload")
def upload_vrm(file: UploadFile = File(...),
               authorization: str | None = Header(default=None)):
    """Upload a custom VRM avatar. Stores as user_{id}.vrm in static/."""
    user_id = require_user(authorization)
    if not (file.filename or "").lower().endswith(".vrm"):
        raise HTTPException(400, "Only .vrm files are accepted.")
    dest = _VRM_DIR / f"user_{user_id}.vrm"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    vrm_url = f"/static/user_{user_id}.vrm"
    from agents import auth_agent
    auth_agent.update_profile(user_id, {"vrm_path": vrm_url, "avatar_type": "custom"})
    return {"ok": True, "vrm_url": vrm_url}


@app.delete("/api/avatar/custom")
def delete_custom_vrm(authorization: str | None = Header(default=None)):
    """Remove custom VRM and revert to LIA default."""
    user_id = require_user(authorization)
    dest = _VRM_DIR / f"user_{user_id}.vrm"
    if dest.exists():
        dest.unlink()
    from agents import auth_agent
    auth_agent.update_profile(user_id, {"vrm_path": "", "avatar_type": "lia"})
    return {"ok": True}


# ---------------------------------------------------------------------- UI
@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


import mimetypes


# Serve static files with no-cache headers so JS changes take effect immediately
@app.get("/static/{path:path}")
def static_files(path: str, request: Request):
    file_path = STATIC / path
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "Not found")
    mime = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=mime,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
