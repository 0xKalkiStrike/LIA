# 🏗️ LIA Architecture & System Overview

LIA is built on a modular, event-driven multi-agent architecture designed for high privacy, local processing, and real-time interaction.

```
                  ┌─────────────────────────────────────┐
                  │   Web UI (Three.js 3D Avatar / UI)  │
                  └──────────────────┬──────────────────┘
                                     │ HTTP / WebSockets (/api/ws)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │       FastAPI Server (api/server)   │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│   Commander Agent  │    │  Specialized Agents│    │ Productivity API   │
│ (agents/commander) │    │  (agents/*_agent)  │    │(agents/productivity│
└──────────┬─────────┘    └──────────┬─────────┘    └──────────┬─────────┘
           │                         │                         │
           ▼                         ▼                         ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│  Ollama LLM Engine │    │ Piper TTS Engine   │    │ JSON / SQLite DB   │
│ (Offline / Online) │    │ (Offline ONNX Vox) │    │ (core/database.py) │
└────────────────────┘    └────────────────────┘    └────────────────────┘
```

---

## 🧩 Core Subsystems

### 1. Commander Agent (`agents/commander.py`)
- Central routing brain for incoming prompts.
- Handles intent detection, context retrieval, system prompt formatting, and Ollama streaming.
- Manages command execution triggers (`launch_app`, `run_command`, web browser routing).

### 2. Multi-Agent System (`agents/`)
- **`coder_agent.py`**: Full-stack code workspace and project file generation.
- **`presentation_agent.py`**: HTML slide decks and PowerPoint export (`python-pptx`).
- **`image_agent.py` & `video_agent.py`**: AI image and motion synthesis generation.
- **`voice_agent.py` & `voice_cloning.py`**: Neural TTS synthesis via Piper, pitch/speed adjustment, voice cloning uploads.
- **`vision_agent.py` & `ocr_agent.py`**: Image explanation and optical character recognition.
- **`web_intel/`**: Deep search, surface search, Tor proxy capabilities, and vector storage (`core/intel_store.py`).

### 3. Real-Time Communication (`api/server.py`)
- Full REST endpoints for user authentication, memory CRUD, voice settings, and desktop execution.
- WebSocket `/api/ws` endpoint for streaming chat, multi-agent collaboration debates, and live telemetry (gestures, smile, presence).

### 4. Storage & Persistence (`core/`)
- **`database.py` & `json_db.py`**: Lightweight DB persistence for profiles, tasks, notes, calendar, reminders, memories, and voice settings.
- **`intel_store.py`**: Vector embeddings store using ChromaDB for persistent search memory.
- **`config.py` & `persona.py`**: System persona prompts, multi-language modes (English, Gujarati, Hindi), and voice profiles.
