"""LIA — launcher.

    python run.py

Opens the AI Operating System at http://127.0.0.1:8000
First run shows the onboarding wizard (character -> voice -> language -> account).
Every later login wakes your character up with a spoken greeting.
"""
import uvicorn

from core.config import setting
from core.database import init_db

if __name__ == "__main__":
    init_db()
    host = setting("host", "127.0.0.1")
    port = setting("port", 8000)
    print(f"\n  LIA online  ->  http://{host}:{port}\n")
    uvicorn.run("api.server:app", host=host, port=port, reload=False)
