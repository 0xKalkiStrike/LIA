@echo off

:: Kill process listening on port 8001 (default settings port)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING 2^>nul') do (
    echo Killing process %%a listening on port 8001...
    taskkill /F /PID %%a
)

:: Kill process listening on port 8000 (run.py default port)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo Killing process %%a listening on port 8000...
    taskkill /F /PID %%a
)

:: Wait 2 seconds using ping (works in non-interactive shells)
ping -n 3 127.0.0.1 >nul

python run.py
