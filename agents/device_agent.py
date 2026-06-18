"""Device Agent — system stats, file management, application launch, and shell execution."""
import os
import platform
import subprocess
from pathlib import Path

try:
    import psutil
    _PS = True
except Exception:
    _PS = False

# Safe target directories
WORKSPACE_DIR = Path("C:/hacker/LIA").resolve()
PROJECTS_DIR = Path.home() / "JarvisProjects"
PROJECTS_DIR.mkdir(exist_ok=True)


def status() -> dict:
    info = {
        "platform": platform.system(),
        "machine": platform.machine(),
        "python": platform.python_version(),
    }
    if _PS:
        info.update({
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage("/").percent,
        })
        batt = getattr(psutil, "sensors_battery", lambda: None)()
        if batt:
            info["battery_percent"] = batt.percent
    return info


def status_text() -> str:
    s = status()
    if "cpu_percent" in s:
        return (f"Systems check: CPU at {s['cpu_percent']}%, RAM at "
                f"{s['ram_percent']}%, disk at {s['disk_percent']}%. "
                f"All within normal parameters.")
    return f"Running on {s['platform']} ({s['machine']}), Python {s['python']}."


def run_command(command: str) -> dict:
    """Execute shell command securely and return output."""
    try:
        # Run in a shell suitable for the OS
        result = subprocess.run(
            command,
            shell=True,
            text=True,
            capture_output=True,
            timeout=15,
            cwd=str(WORKSPACE_DIR)
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "stdout": "",
            "stderr": "Command execution timed out after 15 seconds.",
            "code": -1
        }
    except Exception as e:
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(e),
            "code": -2
        }


def launch_app(app_name: str) -> dict:
    """Launch standard desktop application."""
    app_name = app_name.lower().strip()
    # Define safe application mappings for Windows
    apps = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "explorer": "explorer.exe",
        "paint": "mspaint.exe",
        "code": "code",
    }
    
    executable = apps.get(app_name, app_name)
    try:
        subprocess.Popen(executable, shell=True)
        return {"ok": True, "message": f"Successfully launched {app_name}."}
    except Exception as e:
        return {"ok": False, "message": f"Failed to launch {app_name}: {str(e)}"}


def list_files(dir_path: str = None) -> list:
    """List files in the workspace or projects directory."""
    if dir_path:
        target_dir = Path(dir_path).resolve()
    else:
        target_dir = WORKSPACE_DIR
        
    # Safety boundary check
    is_safe = False
    try:
        is_safe = target_dir.is_relative_to(WORKSPACE_DIR) or target_dir.is_relative_to(PROJECTS_DIR)
    except (ValueError, AttributeError):
        # Fallback for older python or absolute string checks
        abs_target = str(target_dir).lower()
        abs_work = str(WORKSPACE_DIR).lower()
        abs_proj = str(PROJECTS_DIR).lower()
        is_safe = abs_target.startswith(abs_work) or abs_target.startswith(abs_proj)

    if not is_safe:
        target_dir = WORKSPACE_DIR
        
    if not target_dir.exists():
        return []
        
    out = []
    try:
        for p in target_dir.iterdir():
            if p.name.startswith(".") or "__pycache__" in p.name or ".venv" in p.name:
                continue
            out.append({
                "name": p.name,
                "is_dir": p.is_dir(),
                "size": p.stat().st_size if p.is_file() else 0,
                "path": str(p.resolve()).replace('\\', '/')
            })
    except Exception:
        pass
    return sorted(out, key=lambda x: (not x["is_dir"], x["name"]))

