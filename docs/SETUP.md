# 🚀 LIA Setup & Quickstart Guide

LIA (Local Intelligence Assistant) is an offline-capable, multi-agent AI operating system featuring 3D avatar interaction, neural voice synthesis, multi-modal vision, real-time WebSockets, productivity tools, and full autonomous agent execution.

---

## 🛠️ Prerequisites

- **Python**: 3.10+ (3.11 recommended)
- **Node.js**: 18+ (for Next.js frontend, optional if using static UI)
- **Ollama**: (Optional for local offline LLM brain, default model: `llama3.2`)

---

## ⚡ Quick Start

### 1. Environment Setup

```bash
# Create and activate virtual environment (optional but recommended)
python -m venv .venv
.venv\Scripts\activate   # On Windows
source .venv/bin/activate # On Linux/macOS

# Install dependencies
pip install -r requirements.txt
```

### 2. Install Neural TTS (Piper) — Optional

For ultra low-latency offline voice synthesis:
```bash
pip install piper-tts
python -c "from agents.voice_agent import install_piper; install_piper()"
```

### 3. Launch LIA

#### Option A: FastAPI Single Server (Static Web Interface)
```bash
python run.py
# Opens at http://127.0.0.1:8001
```

#### Option B: Full Stack (FastAPI Backend + Next.js App)
Double-click or run `START_SERVERS.bat` in PowerShell:
```cmd
START_SERVERS.bat
# Backend:  http://localhost:8001
# Frontend: http://localhost:3000
```

---

## 🧪 Verification & Testing

To run the complete automated test suite:
```bash
python tests/test_backend.py
python tests/test_browser_heuristics.py
python tests/test_commands.py
```

To run system health diagnostics:
```bash
python lia_orchestrator.py health
```
