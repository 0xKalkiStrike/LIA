# 🤖 LIA — Local Intelligence Assistant

**LIA** is an AI Operating System and multi-agent virtual assistant featuring interactive 3D VRM avatars, low-latency offline neural speech synthesis (Piper TTS), real-time WebSockets, multi-modal vision, desktop automation, and personal productivity tools.

---

## ⚡ Quickstart

```bash
# 1. Install requirements
pip install -r requirements.txt

# 2. Run LIA Backend & Web UI
python run.py
```
Open **http://127.0.0.1:8001** in your browser.

For full-stack deployment (Backend + Next.js Frontend), execute:
```cmd
START_SERVERS.bat
```

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](docs/) directory:

- 🛠️ [**Setup & Installation Guide**](docs/SETUP.md)
- 🏗️ [**Architecture & Systems Overview**](docs/ARCHITECTURE.md)
- ✨ [**Feature & Agent Capabilities**](docs/FEATURES.md)

---

## 🧪 Testing & Health Check

Run integration tests:
```bash
python tests/test_backend.py
python tests/test_browser_heuristics.py
python tests/test_commands.py
```

Run health diagnostics:
```bash
python lia_orchestrator.py health
```

---

## 📄 License
Open source — built with FastAPI, Ollama, Piper TTS, and Three.js.
