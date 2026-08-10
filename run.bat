@echo off

echo Stopping any running LIA processes...

:: Kill process listening on port 8001 (default settings port)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING 2^>nul') do (
    echo Killing process %%a listening on port 8001...
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill process listening on port 8000 (run.py default port)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo Killing process %%a listening on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

:: Wait 2 seconds using ping (works in non-interactive shells)
ping -n 3 127.0.0.1 >nul

echo Initializing Ollama (Offline Brain)...
:: Start Ollama in background
start "" ollama serve
ping -n 3 127.0.0.1 >nul

echo Pulling llama3.2 model...
ollama pull llama3.2

echo Switching to Online Brain...
ping -n 2 127.0.0.1 >nul

echo Starting LIA...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe run.py
) else (
    python run.py
)
