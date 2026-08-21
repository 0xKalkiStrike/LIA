@echo off
echo Starting LIA Backend and Frontend...
echo.

REM Start Backend (FastAPI)
echo [1/2] Starting Backend API on port 8001...
start "LIA Backend" cmd /k "cd /d C:\hacker\LIA && set PYTHONPATH=. && python api/server.py"
timeout /t 3 /nobreak

REM Start Frontend (Next.js)
echo [2/2] Starting Frontend on port 3000...
start "LIA Frontend" cmd /k "cd /d C:\hacker\LIA\frontend && npm run dev -- --webpack"

echo.
echo ============================================
echo LIA is starting up!
echo ============================================
echo.
echo Wait 30 seconds for both servers to start, then open:
echo   http://localhost:3000
echo.
echo Backend will be available at:
echo   http://localhost:8001
echo.
echo Press Ctrl+C in each window to stop.
echo.
pause
