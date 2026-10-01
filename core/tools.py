"""LIA agent tools — real capabilities the local LLM can call via Ollama tool-calling.

Each tool has a JSON schema (sent to Ollama) and an implementation. Tools flagged
`risky` need the user's approval in the UI before they run (see agents/agent_loop.py).
File access is confined to the workspace folder unless noted.
"""
from __future__ import annotations

import ast
import datetime as _dt
import html
import json
import math
import operator
import os
import platform
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from .config import DATA_DIR

WORKSPACE_ROOT = DATA_DIR / "workspace"
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

MAX_OUT = 6000  # chars returned to the model per tool call

# Folders we never walk into — noisy, huge, or not something a user meant to share.
_IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "env",
                ".next", "dist", "build", ".cache", ".idea", ".vscode", "target"}
_BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".pdf", ".zip",
               ".rar", ".7z", ".exe", ".dll", ".so", ".mp3", ".mp4", ".mov", ".avi",
               ".woff", ".woff2", ".ttf", ".db", ".sqlite3", ".bin", ".pyc", ".class"}


def _clip(text: str, limit: int = MAX_OUT) -> str:
    text = text if isinstance(text, str) else json.dumps(text, default=str)
    return text if len(text) <= limit else text[:limit] + f"\n…[truncated {len(text) - limit} chars]"


def user_workspace(user_id: str) -> Path:
    """Each user gets an isolated folder; this is also where folder uploads land."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id) or "default"
    p = WORKSPACE_ROOT / safe
    p.mkdir(parents=True, exist_ok=True)
    return p


def _safe_path(user_id: str, rel: str) -> Path:
    root = user_workspace(user_id).resolve()
    p = (root / (rel or ".")).resolve()
    if root != p and root not in p.parents:
        raise ValueError("Path escapes the workspace folder.")
    return p


def _walk(root: Path, max_entries: int = 400):
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in _IGNORE_DIRS and not d.startswith("."))
        for name in sorted(filenames):
            if count >= max_entries:
                return
            fp = Path(dirpath) / name
            yield fp
            count += 1


# ------------------------------------------------------------------ tools ---
def get_datetime(user_id: str, **_) -> str:
    now = _dt.datetime.now().astimezone()
    return now.strftime("%A, %d %B %Y, %H:%M:%S %Z (UTC%z)")


_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
        ast.FloorDiv: operator.floordiv, ast.USub: operator.neg, ast.UAdd: operator.pos}
_FUNCS = {k: getattr(math, k) for k in ("sqrt", "sin", "cos", "tan", "log", "log10", "exp", "floor", "ceil", "factorial")}
_FUNCS.update(abs=abs, round=round, min=min, max=max)
_CONSTS = {"pi": math.pi, "e": math.e}


def _eval(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        l, r = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(r) > 1000:
            raise ValueError("Exponent too large.")
        return _OPS[type(node.op)](l, r)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand))
    if isinstance(node, ast.Name) and node.id in _CONSTS:
        return _CONSTS[node.id]
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS:
        return _FUNCS[node.func.id](*[_eval(a) for a in node.args])
    raise ValueError("Unsupported expression.")


def calculator(user_id: str, expression: str = "", **_) -> str:
    try:
        expr = expression.replace("^", "**").replace("×", "*").replace("÷", "/").replace(",", "")
        expr = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?=[\d(])", r"(\g<1>/100)*", expr)  # "18% of 50"
        expr = re.sub(r"(\d+(?:\.\d+)?)\s*%(?!\s*\d)", r"(\g<1>/100)", expr)  # "18%"
        return str(_eval(ast.parse(expr, mode="eval").body))
    except Exception as e:
        return f"Error: could not evaluate '{expression}' ({e}). Rewrite it using only numbers, + - * / ** ( ) and call the tool again."


def web_search(user_id: str, query: str = "", **_) -> str:
    from agents import search_agent
    results = search_agent.web_search(query, 6)
    if not results:
        return "No results."
    return _clip("\n\n".join(
        f"{i}. {r.get('title', '')}\n   {r.get('url') or r.get('link', '')}\n   {r.get('snippet') or r.get('body', '')}"
        for i, r in enumerate(results, 1)))


def fetch_url(user_id: str, url: str = "", **_) -> str:
    if not re.match(r"^https?://", url):
        return "Error: URL must start with http:// or https://"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 LIA/2.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read(1_500_000).decode(resp.headers.get_content_charset() or "utf-8", "replace")
    except Exception as e:
        return f"Error fetching page: {e}"
    raw = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", raw)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))
    return _clip(re.sub(r"\s+", " ", text).strip())


def list_files(user_id: str, path: str = ".", recursive: bool = False, **_) -> str:
    try:
        d = _safe_path(user_id, path)
        if not d.is_dir():
            return "Error: not a directory."
        if not recursive:
            rows = [f"{'[dir] ' if p.is_dir() else ''}{p.name}" + ("" if p.is_dir() else f"  ({p.stat().st_size} B)")
                    for p in sorted(d.iterdir()) if not p.name.startswith(".")]
            return "\n".join(rows) or "(empty)"
        rows, n = [], 0
        for fp in _walk(d, 600):
            rows.append(f"{fp.relative_to(d).as_posix()}  ({fp.stat().st_size} B)")
            n += 1
        suffix = "" if n < 600 else "\n…[listing capped at 600 files]"
        return (_clip("\n".join(rows)) + suffix) if rows else "(empty)"
    except Exception as e:
        return f"Error: {e}"


def read_file(user_id: str, path: str = "", **_) -> str:
    try:
        p = _safe_path(user_id, path)
        if p.suffix.lower() in _BINARY_EXT:
            return f"Error: '{path}' looks binary ({p.suffix}); this tool only reads text files."
        return _clip(p.read_text(encoding="utf-8", errors="replace"))
    except Exception as e:
        return f"Error: {e}"


def read_project(user_id: str, path: str = ".", max_files: int = 25, **_) -> str:
    """Read every text file under a folder (recursively) and return them concatenated,
    so the model can understand a whole uploaded project in one call."""
    try:
        d = _safe_path(user_id, path)
        if not d.is_dir():
            return "Error: not a directory."
        try:
            max_files = int(max_files)
        except (TypeError, ValueError):
            max_files = 25
        if max_files <= 0:
            max_files = 25
        per_file_budget = max(400, MAX_OUT // max_files)
        out, used, skipped = [], 0, []
        for fp in _walk(d, 2000):
            if used >= max_files:
                skipped.append(fp.relative_to(d).as_posix())
                continue
            if fp.suffix.lower() in _BINARY_EXT or fp.stat().st_size > 400_000:
                skipped.append(fp.relative_to(d).as_posix())
                continue
            try:
                text = fp.read_text(encoding="utf-8", errors="replace")
            except Exception:
                skipped.append(fp.relative_to(d).as_posix())
                continue
            used += 1
            rel = fp.relative_to(d).as_posix()
            body = text if len(text) <= per_file_budget else text[:per_file_budget] + "\n…[truncated]"
            out.append(f"\n===== {rel} =====\n{body}")
        header = f"Read {used} file(s) from '{path}'."
        if skipped:
            header += f" Skipped {len(skipped)} (binary, too large, or over the file limit): {', '.join(skipped[:15])}" + (", …" if len(skipped) > 15 else "")
        return _clip(header + "\n" + "".join(out), limit=MAX_OUT * 3)
    except Exception as e:
        return f"Error: {e}"


def write_file(user_id: str, path: str = "", content: str = "", **_) -> str:
    try:
        p = _safe_path(user_id, path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} chars to workspace/{path}"
    except Exception as e:
        return f"Error: {e}"


def run_python(user_id: str, code: str = "", **_) -> str:
    try:
        r = subprocess.run([sys.executable, "-I", "-c", code], cwd=user_workspace(user_id), capture_output=True,
                           text=True, timeout=30)
        return _clip((r.stdout + (f"\n[stderr]\n{r.stderr}" if r.stderr else "")).strip() or "(no output)")
    except subprocess.TimeoutExpired:
        return "Error: timed out after 30s."
    except Exception as e:
        return f"Error: {e}"


def run_shell(user_id: str, command: str = "", **_) -> str:
    from agents import device_agent
    r = device_agent.run_command(command)
    out = (r.get("stdout") or "") + (f"\n[stderr]\n{r['stderr']}" if r.get("stderr") else "")
    return _clip(out.strip() or f"(exit code {r.get('code')})")


def open_app(user_id: str, app: str = "", **_) -> str:
    from agents import device_agent
    r = device_agent.launch_app(app)
    return json.dumps(r, default=str)[:500]


def system_info(user_id: str, **_) -> str:
    from agents import device_agent
    try:
        return json.dumps(device_agent.status(), default=str)
    except Exception:
        return f"{platform.system()} {platform.release()}, Python {platform.python_version()}"


def remember(user_id: str, fact: str = "", **_) -> str:
    from agents import memory_agent
    memory_agent.remember(user_id, fact, "fact", 2)
    return "Saved to long-term memory."


def recall(user_id: str, query: str = "", **_) -> str:
    from agents import memory_agent
    hits = memory_agent.search(user_id, query, 8)
    return "\n".join(f"- {h}" for h in hits) or "Nothing relevant remembered."


def add_note(user_id: str, title: str = "", content: str = "", **_) -> str:
    from agents import productivity
    productivity.create_note(user_id, title, content)
    return f"Note '{title}' created."


def add_task(user_id: str, title: str = "", **_) -> str:
    from agents import productivity
    productivity.create_task(user_id, title)
    return f"Task '{title}' added."


def list_tasks(user_id: str, **_) -> str:
    from agents import productivity
    rows = productivity.list_tasks(user_id)
    return "\n".join(f"- [{t.get('status')}] {t.get('title')}" for t in rows) or "No tasks."


def add_reminder(user_id: str, title: str = "", minutes_from_now: float = 10, **_) -> str:
    from agents import productivity
    productivity.create_reminder(user_id, title, time.time() + float(minutes_from_now) * 60)
    return f"Reminder '{title}' set for {minutes_from_now} minute(s) from now."


def _s(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or []}


_STR = {"type": "string"}

# name -> (function, description, parameters schema, risky)
TOOLS: dict[str, tuple] = {
    "get_datetime": (get_datetime, "Get the current local date and time.", _s({}), False),
    "calculator": (calculator, "Evaluate a math expression exactly (supports + - * / ** % sqrt sin log pi).",
                   _s({"expression": _STR}, ["expression"]), False),
    "web_search": (web_search, "Search the web for current information. Returns titles, URLs, snippets.",
                   _s({"query": _STR}, ["query"]), False),
    "fetch_url": (fetch_url, "Download a web page and return its readable text.",
                  _s({"url": _STR}, ["url"]), False),
    "list_files": (list_files, "List files in the user's workspace folder (where uploaded folders/projects land). "
                   "Set recursive=true to see every file in every subfolder.",
                   _s({"path": _STR, "recursive": {"type": "boolean"}}), False),
    "read_file": (read_file, "Read one text file from the workspace folder.", _s({"path": _STR}, ["path"]), False),
    "read_project": (read_project, "Read EVERY text file in a folder and its subfolders at once (skips binaries, "
                     "huge files, .git/node_modules/etc, up to ~25 files). Use this when the user uploaded a "
                     "folder/project and asks you to review, explain, find something in, or work across the whole thing.",
                     _s({"path": _STR}, ["path"]), False),
    "write_file": (write_file, "Create or overwrite a text/code file in the workspace folder.",
                   _s({"path": _STR, "content": _STR}, ["path", "content"]), True),
    "run_python": (run_python, "Run Python code (30s limit, workspace as cwd) and return its output. Use for data work, "
                   "precise calculations, generating files.", _s({"code": _STR}, ["code"]), True),
    "run_shell": (run_shell, "Run a shell command on the user's computer and return its output.",
                  _s({"command": _STR}, ["command"]), True),
    "open_app": (open_app, "Launch a desktop application (notepad, calculator, chrome, vscode...).",
                 _s({"app": _STR}, ["app"]), True),
    "system_info": (system_info, "Get CPU, memory, disk and OS status of this computer.", _s({}), False),
    "remember": (remember, "Save a fact about the user to long-term memory.", _s({"fact": _STR}, ["fact"]), False),
    "recall": (recall, "Search long-term memory for facts about the user.", _s({"query": _STR}, ["query"]), False),
    "add_note": (add_note, "Create a note.", _s({"title": _STR, "content": _STR}, ["title"]), False),
    "add_task": (add_task, "Add a to-do task.", _s({"title": _STR}, ["title"]), False),
    "list_tasks": (list_tasks, "List the user's tasks.", _s({}), False),
    "add_reminder": (add_reminder, "Set a reminder N minutes from now.",
                     _s({"title": _STR, "minutes_from_now": {"type": "number"}}, ["title"]), False),
}


def schemas() -> list[dict]:
    return [{"type": "function", "function": {"name": n, "description": d, "parameters": p}}
            for n, (_f, d, p, _r) in TOOLS.items()]


def is_risky(name: str) -> bool:
    return TOOLS[name][3] if name in TOOLS else True


def run(name: str, user_id: str, args: dict) -> str:
    if name not in TOOLS:
        return f"Error: unknown tool '{name}'."
    try:
        args = args if isinstance(args, dict) else json.loads(args or "{}")
        return _clip(TOOLS[name][0](user_id, **args))
    except TypeError as e:
        return f"Error: bad arguments ({e})."
    except Exception as e:
        return f"Error: {e}"
