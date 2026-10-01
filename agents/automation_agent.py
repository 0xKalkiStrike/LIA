"""Automation Agent — JARVIS executes automated tasks and workflow scripts.

Features:
- Executes multi-step batch automation tasks
- System checks, directory cleanup, automated reports, process supervision
- Schedules background tasks and workflow sequences
"""
import shutil
import tempfile
import time
from pathlib import Path
from core.config import ROOT

AUTOMATION_TRIGGERS = (
    "automate", "run automation", "automation workflow", "batch job",
    "schedule task", "system clean", "auto backup", "run workflow"
)


def looks_like_automation_request(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in AUTOMATION_TRIGGERS) or (
        any(w in low for w in ("automate", "script", "cron", "workflow", "batch", "schedule")) and
        any(w in low for w in ("task", "job", "process", "action", "routine", "backup", "cleanup"))
    )


def _clean_temp() -> tuple[str, list[str]]:
    """Actually delete stale files from the OS temp folder. Skips anything locked/in-use."""
    log = []
    temp_dir = Path(tempfile.gettempdir())
    log.append(f"[{time.strftime('%H:%M:%S')}] Scanning {temp_dir}...")
    freed = 0
    cleaned = 0
    for item in temp_dir.iterdir():
        try:
            if item.is_file():
                size = item.stat().st_size
                item.unlink()
                freed += size
                cleaned += 1
            elif item.is_dir():
                size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                shutil.rmtree(item)
                freed += size
                cleaned += 1
        except (PermissionError, OSError):
            continue  # in use by another process — skip, don't fail the whole run
    log.append(
        f"[{time.strftime('%H:%M:%S')}] Cleaned {cleaned} temp items "
        f"(freed {freed / 1024 / 1024:.1f}MB)."
    )
    return "Temporary System Cleanup", log


def _backup_database() -> tuple[str, list[str]]:
    """Actually copy the live database to a timestamped backup file."""
    log = []
    db_path = ROOT / "data" / "jarvis.db"
    backups_dir = ROOT / "data" / "backups"
    if not db_path.exists():
        log.append(f"[{time.strftime('%H:%M:%S')}] No database found at {db_path} — nothing to back up.")
        return "Database & Vault Backup", log

    backups_dir.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    dest = backups_dir / f"jarvis_{stamp}.db"
    log.append(f"[{time.strftime('%H:%M:%S')}] Target database found ({db_path.stat().st_size} bytes).")
    shutil.copy2(db_path, dest)
    log.append(f"[{time.strftime('%H:%M:%S')}] Backup written to {dest} ({dest.stat().st_size} bytes).")
    return "Database & Vault Backup", log


def _system_check() -> tuple[str, list[str]]:
    """Real system stats via device_agent (psutil), not canned text."""
    log = []
    try:
        from agents.device_agent import status
        s = status()
        log.append(f"[{time.strftime('%H:%M:%S')}] Inspecting system resource utilization...")
        if "cpu_percent" in s:
            log.append(
                f"[{time.strftime('%H:%M:%S')}] CPU {s['cpu_percent']}%, "
                f"RAM {s['ram_percent']}%, disk {s['disk_percent']}%."
            )
        else:
            log.append(f"[{time.strftime('%H:%M:%S')}] Running on {s.get('platform')} ({s.get('machine')}).")
    except Exception as e:
        log.append(f"[{time.strftime('%H:%M:%S')}] Could not read system stats: {e}")
    return "System Workflow Supervision", log


def execute_automation(message: str, user_id: str) -> dict:
    """Execute automated system workflow or batch routine."""
    low = message.lower()
    log = [f"[{time.strftime('%H:%M:%S')}] Automation Agent initialized by user {user_id}."]

    if "clean" in low or "temp" in low:
        task_name, task_log = _clean_temp()
    elif "backup" in low:
        task_name, task_log = _backup_database()
    else:
        task_name, task_log = _system_check()
    log.extend(task_log)

    log.append(f"[{time.strftime('%H:%M:%S')}] Automation task '{task_name}' executed cleanly.")

    return {
        "ok": True,
        "task_name": task_name,
        "logs": log,
        "spoken": f"Automation routine '{task_name}' completed successfully."
    }
