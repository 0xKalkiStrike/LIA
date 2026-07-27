"""JARVIS/LIA AI — FastAPI backend server.

Now upgraded to support:
- WebSockets for real-time streaming, chat, telemetry, and collaboration debates
- Notes, Tasks, Calendar, and Reminders CRUD API endpoints
- Voice clip uploading and voice settings updates
- Memory exporting and clearing
- Static proxy serving for custom user voice uploads
"""
import io
import json
import os
import shutil
import tempfile
import mimetypes
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, UploadFile, File, Form, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel

from core.config import ROOT, load
from core.database import init_db, db, new_id, now
from core.security import resolve_session, end_session
from fastapi.middleware.cors import CORSMiddleware
from agents import auth_agent, commander, memory_agent, device_agent, coder_agent, productivity, collaboration, voice_cloning

app = FastAPI(title="LIA AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

STATIC = ROOT / "ui" / "static"
CUSTOM_VOICES = ROOT / "data" / "custom_voices"
CUSTOM_VOICES.mkdir(parents=True, exist_ok=True)

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
    stream: bool = False
    collaborate: bool = False

class MemoryBody(BaseModel):
    content: str
    category: str = "fact"

class ExecuteBody(BaseModel):
    task_type: str
    target: str

class TelemetryBody(BaseModel):
    event: str
    meta: str = ""

# Productivity Models
class NoteBody(BaseModel):
    title: str
    content: str = ""
    tags: str = "[]"

class TaskBody(BaseModel):
    title: str
    status: str = "pending"
    due_at: float | None = None

class CalendarBody(BaseModel):
    title: str
    description: str = ""
    start_time: float
    end_time: float

class ReminderBody(BaseModel):
    title: str
    trigger_at: float

class VoiceSettingsBody(BaseModel):
    voice_id: str = "friday"
    accent: str = "us"
    pitch: float = 1.0
    speed: float = 1.0
    style: str = "default"
    emotional_speech: bool = False
    custom_voice_path: str = ""
    legal_authorized: bool = False

# -------------------------------------------------------------------- auth
@app.get("/api/state")
def state():
    return {
        "has_users": auth_agent.has_users(),
        "voices": load("voices")["personas"],
        "accents": load("voices").get("accents", {}),
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
    if body.stream:
        return StreamingResponse(
            commander.handle_message_stream(user_id, body.message.strip()),
            media_type="text/event-stream"
        )
    return commander.handle_message(user_id, body.message.strip())

# ------------------------------------------------------------------ memory
@app.get("/api/memories")
def memories(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        rows = conn.execute(
            "SELECT category, content, created_at FROM Memories "
            "WHERE user_id=? AND category != 'vault' ORDER BY created_at DESC LIMIT 100", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/memories")
def add_memory(body: MemoryBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    memory_agent.remember(user_id, body.content, body.category, importance=2)
    return {"ok": True}

@app.get("/api/memories/export")
def export_memories(
    authorization: str | None = Header(default=None),
    # Browser downloads (window.open / <a download>) can't set an Authorization
    # header, so also accept the token as an ?authorization=Bearer <token> query.
    authorization_q: str | None = Query(default=None, alias="authorization"),
):
    user_id = require_user(authorization or authorization_q)
    with db() as conn:
        memories = [dict(r) for r in conn.execute("SELECT * FROM Memories WHERE user_id=?", (user_id,)).fetchall()]
        chats = [dict(r) for r in conn.execute("SELECT * FROM Conversations WHERE user_id=?", (user_id,)).fetchall()]
    return JSONResponse(
        content={"memories": memories, "chat_history": chats},
        headers={"Content-Disposition": "attachment; filename=lia_brain_export.json"}
    )

@app.delete("/api/memories/clear")
def clear_memories(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        conn.execute("DELETE FROM Memories WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM Conversations WHERE user_id=?", (user_id,))
    return {"ok": True, "message": "All memories and chat logs cleared successfully."}

# ------------------------------------------------------------------ vault
@app.get("/api/vault")
def get_vault(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    return memory_agent.recall_vault(user_id)

class VaultBody(BaseModel):
    content: str

@app.post("/api/vault")
def add_vault(body: VaultBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    memory_agent.remember_vault(user_id, body.content)
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
    return {"processes": proc[:50]}

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
        accent: str = Query("us"), language: str = Query(None),
        pitch: float = Query(1.0), speed: float = Query(1.0),
        authorization: str | None = Header(default=None),
        token: str | None = Query(default=None)):
    """Generate speech audio via Piper TTS. Returns WAV audio stream.

    An <audio>/Audio() GET can't set an Authorization header, so the token may
    also be supplied as a ?token=<token> query parameter.

    Args:
        text: Text to synthesize
        voice: Persona voice (friday, nova, etc)
        accent: English accent (us, gb, in, au) - ignored if language is set
        language: Language mode (gujarati, hindi, tamil, etc) - overrides accent
        pitch: Voice pitch multiplier
        speed: Speech speed multiplier
    """
    require_user(authorization or (f"Bearer {token}" if token else None))
    from agents import voice_agent
    try:
        audio_bytes = voice_agent.synthesize(text, voice, accent, language)
        # Apply pitch and speed scaling in Python, or return with speed settings in header
        audio_bytes = voice_cloning.adjust_voice_pitch(audio_bytes, pitch, speed)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-cache",
                "X-Voice": voice,
                "X-Pitch": str(pitch),
                "X-Speed": str(speed),
                "X-Language": language or "english"
            }
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))

@app.get("/api/tts/status")
def tts_status(authorization: str | None = Header(default=None)):
    require_user(authorization)
    from agents import voice_agent
    return voice_agent.tts_status()

@app.post("/api/tts/install")
def tts_install(authorization: str | None = Header(default=None)):
    require_user(authorization)
    from agents import voice_agent
    result = voice_agent.install_piper()
    return result

# ------------------------------------------------------------- Custom Voice Settings
@app.post("/api/voice/upload")
def upload_voice_clip(file: UploadFile = File(...),
                      legal_authorized: bool = Form(...),
                      authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    if not legal_authorized:
        raise HTTPException(400, "You must check the legal rights checkbox to proceed.")
        
    try:
        contents = file.file.read()
        saved_url = voice_cloning.save_voice_clip(user_id, file.filename, contents)
        
        # Save to voice settings
        with db() as conn:
            conn.execute(
                "INSERT INTO VoiceSettings (user_id, custom_voice_path, legal_authorized, updated_at) "
                "VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET "
                "custom_voice_path=EXCLUDED.custom_voice_path, legal_authorized=EXCLUDED.legal_authorized, updated_at=EXCLUDED.updated_at",
                (user_id, saved_url, 1 if legal_authorized else 0, now())
            )
        return {"ok": True, "voice_url": saved_url}
    except Exception as e:
        raise HTTPException(500, f"Failed to upload voice: {e}")

@app.get("/api/voice/settings")
def get_voice_settings(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        row = conn.execute("SELECT * FROM VoiceSettings WHERE user_id=?", (user_id,)).fetchone()
    if row:
        return dict(row)
    return {"voice_id": "friday", "accent": "us", "pitch": 1.0, "speed": 1.0, "style": "default", "emotional_speech": 0, "custom_voice_path": "", "legal_authorized": 0}

@app.post("/api/voice/settings")
def save_voice_settings(body: VoiceSettingsBody, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with db() as conn:
        conn.execute(
            "INSERT INTO VoiceSettings (user_id, voice_id, accent, pitch, speed, style, emotional_speech, custom_voice_path, legal_authorized, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET "
            "voice_id=EXCLUDED.voice_id, accent=EXCLUDED.accent, pitch=EXCLUDED.pitch, speed=EXCLUDED.speed, style=EXCLUDED.style, emotional_speech=EXCLUDED.emotional_speech, custom_voice_path=EXCLUDED.custom_voice_path, legal_authorized=EXCLUDED.legal_authorized, updated_at=EXCLUDED.updated_at",
            (user_id, body.voice_id, body.accent, body.pitch, body.speed, body.style, 1 if body.emotional_speech else 0, body.custom_voice_path, 1 if body.legal_authorized else 0, now())
        )
    return {"ok": True}

# ------------------------------------------------------------- Productivity APIs
@app.get("/api/notes")
def notes_list(authorization: str | None = Header(default=None)):
    return productivity.list_notes(require_user(authorization))

@app.post("/api/notes")
def note_create(body: NoteBody, authorization: str | None = Header(default=None)):
    return productivity.create_note(require_user(authorization), body.title, body.content, body.tags)

@app.put("/api/notes/{id}")
def note_update(id: str, body: NoteBody, authorization: str | None = Header(default=None)):
    return productivity.update_note(require_user(authorization), id, body.title, body.content, body.tags)

@app.delete("/api/notes/{id}")
def note_delete(id: str, authorization: str | None = Header(default=None)):
    return {"ok": productivity.delete_note(require_user(authorization), id)}

@app.get("/api/tasks")
def tasks_list(authorization: str | None = Header(default=None)):
    return productivity.list_tasks(require_user(authorization))

@app.post("/api/tasks")
def task_create(body: TaskBody, authorization: str | None = Header(default=None)):
    return productivity.create_task(require_user(authorization), body.title, body.due_at)

@app.put("/api/tasks/{id}")
def task_update(id: str, body: TaskBody, authorization: str | None = Header(default=None)):
    return productivity.update_task(require_user(authorization), id, body.title, body.status, body.due_at)

@app.delete("/api/tasks/{id}")
def task_delete(id: str, authorization: str | None = Header(default=None)):
    return {"ok": productivity.delete_task(require_user(authorization), id)}

@app.get("/api/calendar")
def calendar_list(authorization: str | None = Header(default=None)):
    return productivity.list_events(require_user(authorization))

@app.post("/api/calendar")
def calendar_create(body: CalendarBody, authorization: str | None = Header(default=None)):
    return productivity.create_event(require_user(authorization), body.title, body.description, body.start_time, body.end_time)

@app.put("/api/calendar/{id}")
def calendar_update(id: str, body: CalendarBody, authorization: str | None = Header(default=None)):
    return productivity.update_event(require_user(authorization), id, body.title, body.description, body.start_time, body.end_time)

@app.delete("/api/calendar/{id}")
def calendar_delete(id: str, authorization: str | None = Header(default=None)):
    return {"ok": productivity.delete_event(require_user(authorization), id)}

@app.get("/api/reminders")
def reminders_list(authorization: str | None = Header(default=None)):
    return productivity.list_reminders(require_user(authorization))

@app.post("/api/reminders")
def reminder_create(body: ReminderBody, authorization: str | None = Header(default=None)):
    return productivity.create_reminder(require_user(authorization), body.title, body.trigger_at)

@app.delete("/api/reminders/{id}")
def reminder_delete(id: str, authorization: str | None = Header(default=None)):
    return {"ok": productivity.delete_reminder(require_user(authorization), id)}

# ------------------------------------------------------------- WebSockets Real-Time Server
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    await websocket.accept()
    user_id = resolve_session(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return
        
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type")
            
            if msg_type == "chat":
                msg_text = data.get("message", "").strip()
                stream = data.get("stream", False)
                collaborate = data.get("collaborate", False)
                if not msg_text:
                    continue
                
                # Check for multi-agent collaboration
                if collaborate:
                    await websocket.send_json({"type": "collab_start", "message": msg_text})
                    
                    from fastapi.concurrency import run_in_threadpool
                    def run_debate():
                        return list(collaboration.run_collaboration(user_id, msg_text))
                        
                    turns = await run_in_threadpool(run_debate)
                    for turn in turns:
                        await websocket.send_json({"type": "collab_turn", **turn})
                        
                    # Let Commander summarize debate
                    summary_prompt = f"Review the collaboration ideas above, resolve the conflict, and summarize the final solution for: '{msg_text}'"
                    if stream:
                        def generate_summary():
                            return list(commander.handle_message_stream(user_id, summary_prompt))
                        chunks = await run_in_threadpool(generate_summary)
                        for chunk in chunks:
                            await websocket.send_text(chunk)
                    else:
                        reply_dict = await run_in_threadpool(commander.handle_message, user_id, summary_prompt)
                        await websocket.send_json({"type": "done", **reply_dict})
                else:
                    # Simple chat
                    if stream:
                        from fastapi.concurrency import run_in_threadpool
                        def generate_stream():
                            return list(commander.handle_message_stream(user_id, msg_text))
                        chunks = await run_in_threadpool(generate_stream)
                        for chunk in chunks:
                            await websocket.send_text(chunk)
                    else:
                        from fastapi.concurrency import run_in_threadpool
                        reply_dict = await run_in_threadpool(commander.handle_message, user_id, msg_text)
                        await websocket.send_json({"type": "done", **reply_dict})
                        
            elif msg_type == "telemetry":
                event = data.get("event")
                meta = data.get("meta", "")
                with db() as conn:
                    conn.execute(
                        "INSERT INTO Detections VALUES (?,?,?,?,?,?,?)",
                        (new_id(), user_id, "telemetry", event, 1.0, meta, now())
                    )
                reply = None
                if event == "hand_wave":
                    reply = "I see you waving! Hello there, commander!"
                elif event == "smile":
                    reply = "Looking happy! That's what I like to see."
                elif event == "presence_lost":
                    reply = "Commander has walked away."
                elif event == "presence_gain":
                    reply = "Welcome back, commander. Ready when you are."
                
                if reply:
                    await websocket.send_json({"type": "text", "content": reply})
                    await websocket.send_json({"type": "done", "reply": reply, "emotion": "friendly"})
                    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Error: {e}")

# ------------------------------------------------------------------ AVATAR
_VRM_DIR = STATIC
_VRM_DIR.mkdir(exist_ok=True)

@app.post("/api/avatar/upload")
def upload_vrm(file: UploadFile = File(...),
               authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    if not (file.filename or "").lower().endswith(".vrm"):
        raise HTTPException(400, "Only .vrm files are accepted.")
    dest = _VRM_DIR / f"user_{user_id}.vrm"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    vrm_url = f"/static/user_{user_id}.vrm"
    auth_agent.update_profile(user_id, {"vrm_path": vrm_url, "avatar_type": "custom"})
    return {"ok": True, "vrm_url": vrm_url}

@app.delete("/api/avatar/custom")
def delete_custom_vrm(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    dest = _VRM_DIR / f"user_{user_id}.vrm"
    if dest.exists():
        dest.unlink()
    auth_agent.update_profile(user_id, {"vrm_path": "", "avatar_type": "lia"})
    return {"ok": True}

# ---------------------------------------------------------------------- UI
@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")

# Serve static files including custom voices
@app.get("/static/{path:path}")
def static_files(path: str, request: Request):
    # Check if this is a custom voice request
    if path.startswith("custom_voices/"):
        voice_path = ROOT / "data" / path
        if not voice_path.exists() or not voice_path.is_file():
            raise HTTPException(404, "Voice file not found")
        return FileResponse(voice_path, media_type="audio/wav")

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
