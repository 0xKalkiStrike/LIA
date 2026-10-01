"""Agent loop — lets a local Ollama model plan and act by calling tools.

Streams NDJSON events: text | tool_call | confirm | tool_result | done | error.
Risky tools pause until the user approves via `resolve_approval` (HTTP endpoint),
unless the profile/setting `agent_autonomy` is "auto".
"""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.request
import uuid

from core import tools
from core.config import setting
from . import memory_agent, auth_agent

MAX_STEPS = 8
APPROVAL_TIMEOUT = 120

_pending: dict[str, dict] = {}
_lock = threading.Lock()


def resolve_approval(approval_id: str, user_id: str, approved: bool) -> bool:
    with _lock:
        item = _pending.get(approval_id)
    if not item or item["user_id"] != user_id:
        return False
    item["approved"] = approved
    item["event"].set()
    return True


def _wait_for_approval(approval_id: str, user_id: str) -> bool:
    item = {"user_id": user_id, "event": threading.Event(), "approved": False}
    with _lock:
        _pending[approval_id] = item
    item["event"].wait(APPROVAL_TIMEOUT)
    with _lock:
        _pending.pop(approval_id, None)
    return item["approved"]


def _system_prompt(user_id: str) -> str:
    profile = auth_agent.get_profile(user_id) or {}
    name = profile.get("display_name") or "friend"
    try:
        facts = memory_agent.recall(user_id, 10)
    except Exception:
        facts = []
    mem = "\n".join(f"- {f}" for f in facts) or "(none yet)"
    return (
        f"You are LIA, a capable personal AI assistant running locally on the user's computer via Ollama. "
        f"The user is {name}. You can ACT, not just talk: use the provided tools to search the web, read pages, "
        f"work with files in the workspace, run Python or shell commands, manage notes/tasks/reminders, "
        f"check the system, and remember facts. When the user has uploaded a folder/project, it lives in their "
        f"workspace: use list_files(recursive=true) to see its structure, and read_project to read every file in "
        f"it (and its subfolders) in one call before answering questions about it — don't guess at contents you "
        f"haven't actually read. Rules: use a tool whenever it gives a more accurate or "
        f"real result than guessing (current events, math, dates, files, system state). Chain multiple tools "
        f"for multi-step goals. After tools finish, answer clearly and concisely in Markdown, in the user's "
        f"language. If a tool returns an Error, fix the arguments and call it again before answering; never guess a result a tool should provide, and never invent tool results. "
        f"Ask for clarification only when truly necessary.\n\nWhat you remember about the user:\n{mem}"
    )


def _ollama_stream(messages: list[dict], model: str, use_tools: bool):
    payload = {"model": model, "messages": messages, "stream": True, "keep_alive": "30m"}
    if use_tools:
        payload["tools"] = tools.schemas()
    req = urllib.request.Request(setting("ollama_url", "http://localhost:11434") + "/api/chat",
                                 data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        for line in resp:
            if line.strip():
                yield json.loads(line)


def _parse_text_calls(text: str) -> list[dict]:
    """Recover tool calls a model wrote as JSON text, e.g. {"name": "x", "parameters": {...}}."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t).strip()
    try:
        obj = json.loads(t)
    except Exception:
        return []
    items = obj if isinstance(obj, list) else [obj]
    out = []
    for it in items:
        if isinstance(it, dict) and it.get("name") in tools.TOOLS:
            args = it.get("parameters", it.get("arguments", {}))
            out.append({"function": {"name": it["name"], "arguments": args if isinstance(args, dict) else {}}})
    return out


def available_models() -> list[str]:
    try:
        with urllib.request.urlopen(setting("ollama_url", "http://localhost:11434") + "/api/tags", timeout=3) as r:
            return [m["name"] for m in json.loads(r.read()).get("models", [])]
    except Exception:
        return []


def run(user_id: str, message: str, model: str | None = None, autonomy: str | None = None):
    """Generator of NDJSON lines."""
    def ev(**kw) -> str:
        return json.dumps(kw) + "\n"

    model = model or setting("ollama_model", "llama3.2")
    autonomy = autonomy or setting("agent_autonomy", "ask")
    memory_agent.save_turn(user_id, "user", message)
    try:
        memory_agent.auto_extract(user_id, message)
    except Exception:
        pass

    messages = [{"role": "system", "content": _system_prompt(user_id)}]
    messages += memory_agent.recent_turns(user_id, 12)[:-1]
    messages.append({"role": "user", "content": message})

    final_text = ""
    use_tools = True
    used_tools: list[str] = []
    try:
        for _step in range(MAX_STEPS):
            text, calls = "", []
            try:
                for chunk in _ollama_stream(messages, model, use_tools):
                    msg = chunk.get("message", {})
                    if msg.get("content"):
                        text += msg["content"]
                        # Small models sometimes emit a tool call as JSON text: hold it back.
                        if not text.lstrip().startswith(("{", "```")):
                            yield ev(type="text", content=msg["content"])
                    calls += msg.get("tool_calls") or []
            except urllib.error.HTTPError as e:
                if e.code == 400 and use_tools:  # model without tool support -> plain chat
                    use_tools = False
                    continue
                raise
            if not calls:
                calls = _parse_text_calls(text)
                if calls:
                    text = ""
                elif text.lstrip().startswith(("{", "```")):
                    yield ev(type="text", content=text)
            if not calls:
                final_text += text
                break
            messages.append({"role": "assistant", "content": text, "tool_calls": calls})
            final_text += text
            for call in calls:
                fn = call.get("function", {})
                name, args = fn.get("name", ""), fn.get("arguments") or {}
                cid = uuid.uuid4().hex[:8]
                yield ev(type="tool_call", id=cid, name=name, args=args)
                if tools.is_risky(name) and autonomy != "auto":
                    yield ev(type="confirm", id=cid, name=name, args=args)
                    if not _wait_for_approval(cid, user_id):
                        result = "The user denied this action (or it timed out). Do not retry; explain and offer alternatives."
                        yield ev(type="tool_result", id=cid, name=name, ok=False, output=result)
                        messages.append({"role": "tool", "content": result, "tool_name": name})
                        continue
                result = tools.run(name, user_id, args)
                used_tools.append(name)
                yield ev(type="tool_result", id=cid, name=name, ok=not result.startswith("Error"), output=result)
                messages.append({"role": "tool", "content": result, "tool_name": name})
            text_sep = "\n\n"
            final_text += text_sep if final_text and not final_text.endswith("\n") else ""
        else:
            note = "\n\n_Stopped after the maximum number of steps._"
            final_text += note
            yield ev(type="text", content=note)
    except Exception as e:
        err = f"Could not reach Ollama ({str(e)[:120]}). Make sure `ollama serve` is running and the model '{model}' is pulled."
        yield ev(type="error", content=err)
        final_text = final_text or err

    final_text = final_text.strip()
    if final_text:
        memory_agent.save_turn(user_id, "assistant", final_text)
    yield ev(type="done", reply=final_text, tools_used=used_tools, model=model, ts=time.time())
