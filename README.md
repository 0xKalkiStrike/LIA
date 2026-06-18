# JARVIS AI — Personal AI Operating System

A local-first, self-hosted, multi-agent AI assistant with a **customisable on-screen character** that wakes up and greets you in your own language every time you log in.

Inspired by JARVIS from Iron Man. Runs fully offline once Ollama is installed; the web UI works even before that, on a built-in offline brain.

---

## The experience you asked for

1. **First boot** → an onboarding wizard:
   - Choose your AI's **character**: Male / Female
   - Choose **skin tone** (5), **hair style** (6) + **hair color** (4), **suit accent** (4)
   - Name your AI
   - Pick one of **4 voices** (JARVIS, FRIDAY, NOVA, SAGE)
   - Pick a **language mode** (Auto / English / English+Gujarati / English+Hindi / …)
   - Create your commander account (your name + a secret word) → **Done**
2. **Every login afterwards** → your character is asleep in its holo-pod, then **wakes up** (ring spins, scan-line, eyes open, a little wave) and **greets you out loud** in your chosen voice + language — e.g. *"Kem cho, Tony! Hu jaagi gayo chu — badhu ready che."*

---

## Quick start

```bash
cd LIA
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Open **http://127.0.0.1:8000** in Chrome or Edge (needed for mic + best voices).

### Turn on the full AI brain (optional)
```bash
# install Ollama from https://ollama.com, then:
ollama serve
ollama pull llama3.2     # chat / reasoning
ollama pull llava        # vision (object & product intelligence)
```
JARVIS detects Ollama automatically and switches from the offline brain to the full LLM.

---

## Architecture

```
Commander Agent (central brain)
├── Language Agent   detect language, mixed-mode prompts (Gujlish/Hinglish)
├── Memory Agent     long-term memory + conversation history (SQLite, ChromaDB-ready)
├── Auth Agent       accounts, character profiles, sessions, RBAC
├── Voice Agent      wake word, STT, TTS, voiceprint  (browser now; Whisper/Piper offline)
├── Vision Agent     YOLO + LLaVA object/product intelligence
├── OCR Agent        Tesseract text reading
└── Device Agent     system stats / device control
```

Model-agnostic: switch Ollama models in `config/settings.json` without code changes.

## Folder structure
```
jarvis-ai/
├── run.py                  launcher
├── requirements.txt
├── config/                 JSON = config ONLY (settings, voices, languages, agents)
├── core/                   config, database (14 tables), security
├── agents/                 the 8 agents above
├── api/                    FastAPI server (all routes)
├── ui/static/              index.html, style.css, avatar.js, app.js
└── data/                   jarvis.db (created on first run)
```

## Voices & language modes
Defined in `config/voices.json` and `config/languages.json` — add more by editing JSON only.
Language modes ship with English, English+Gujarati, +Hindi, +Marathi, +Tamil, +Bengali, and Auto-detect.

## Security
Secret word hashed with PBKDF2-SHA256 (200k iterations). Session tokens, per-user data scoping, audit logging. Each user only ever sees their own data.

## Roadmap (per spec)
- **Phase 1** ✅ auth, chat, memory, voice, **character system**
- **Phase 2** vision, object detection, OCR (agents in place; install optional deps)
- **Phase 3** LangGraph multi-agent graph
- **Phase 4** device management + automation (Playwright/Paramiko)
- **Phase 5** smart-glasses mode (real-time camera + hands-free)
- **Phase 6** cross-platform packaging (Flet desktop/mobile)

## Notes
- The web UI uses the browser's Speech APIs so it works with zero audio installs. For fully offline server-side voice, uncomment the voice group in `requirements.txt`.
- This is a working Phase-1 foundation with every later phase's agent stubbed and wired, ready to extend.
"# LIA" 
