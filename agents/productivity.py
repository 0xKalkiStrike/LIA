"""Productivity Suite Agent.

Manages Notes, Tasks, Calendar events, and Reminders in the database layer.
"""
from core.database import db, new_id, now

# ── Notes ──────────────────────────────────────────────────────────────────
def list_notes(user_id: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, title, content, tags, updated_at, created_at FROM Notes "
            "WHERE user_id=? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def create_note(user_id: str, title: str, content: str, tags: str = "[]") -> dict:
    nid = new_id()
    t = now()
    with db() as conn:
        conn.execute(
            "INSERT INTO Notes VALUES (?,?,?,?,?,?,?)",
            (nid, user_id, title.strip(), content, tags, t, t)
        )
    return {"id": nid, "title": title, "content": content, "tags": tags, "updated_at": t, "created_at": t}

def update_note(user_id: str, note_id: str, title: str, content: str, tags: str = "[]") -> dict:
    t = now()
    with db() as conn:
        conn.execute(
            "UPDATE Notes SET title=?, content=?, tags=?, updated_at=? WHERE id=? AND user_id=?",
            (title.strip(), content, tags, t, note_id, user_id)
        )
    return {"id": note_id, "title": title, "content": content, "tags": tags, "updated_at": t}

def delete_note(user_id: str, note_id: str) -> bool:
    with db() as conn:
        res = conn.execute("DELETE FROM Notes WHERE id=? AND user_id=?", (note_id, user_id))
        return getattr(res, "rowcount", 1) > 0

# ── Tasks ──────────────────────────────────────────────────────────────────
def list_tasks(user_id: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, title, status, due_at, created_at FROM Tasks "
            "WHERE user_id=? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def create_task(user_id: str, title: str, due_at: float = None) -> dict:
    tid = new_id()
    t = now()
    status = "pending"
    with db() as conn:
        conn.execute(
            "INSERT INTO Tasks VALUES (?,?,?,?,?,?)",
            (tid, user_id, title.strip(), status, due_at, t)
        )
    return {"id": tid, "title": title, "status": status, "due_at": due_at, "created_at": t}

def update_task(user_id: str, task_id: str, title: str, status: str, due_at: float = None) -> dict:
    with db() as conn:
        conn.execute(
            "UPDATE Tasks SET title=?, status=?, due_at=? WHERE id=? AND user_id=?",
            (title.strip(), status, due_at, task_id, user_id)
        )
    return {"id": task_id, "title": title, "status": status, "due_at": due_at}

def delete_task(user_id: str, task_id: str) -> bool:
    with db() as conn:
        res = conn.execute("DELETE FROM Tasks WHERE id=? AND user_id=?", (task_id, user_id))
        return getattr(res, "rowcount", 1) > 0

# ── Calendar ───────────────────────────────────────────────────────────────
def list_events(user_id: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, title, description, start_time, end_time, created_at FROM CalendarEvents "
            "WHERE user_id=? ORDER BY start_time ASC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def create_event(user_id: str, title: str, description: str, start_time: float, end_time: float) -> dict:
    eid = new_id()
    t = now()
    with db() as conn:
        conn.execute(
            "INSERT INTO CalendarEvents VALUES (?,?,?,?,?,?,?)",
            (eid, user_id, title.strip(), description, start_time, end_time, t)
        )
    return {"id": eid, "title": title, "description": description, "start_time": start_time, "end_time": end_time}

def update_event(user_id: str, event_id: str, title: str, description: str, start_time: float, end_time: float) -> dict:
    with db() as conn:
        conn.execute(
            "UPDATE CalendarEvents SET title=?, description=?, start_time=?, end_time=? WHERE id=? AND user_id=?",
            (title.strip(), description, start_time, end_time, event_id, user_id)
        )
    return {"id": event_id, "title": title, "description": description, "start_time": start_time, "end_time": end_time}

def delete_event(user_id: str, event_id: str) -> bool:
    with db() as conn:
        res = conn.execute("DELETE FROM CalendarEvents WHERE id=? AND user_id=?", (event_id, user_id))
        return getattr(res, "rowcount", 1) > 0

# ── Reminders ──────────────────────────────────────────────────────────────
def list_reminders(user_id: str) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, title, trigger_at, status, created_at FROM Reminders "
            "WHERE user_id=? ORDER BY trigger_at ASC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def create_reminder(user_id: str, title: str, trigger_at: float) -> dict:
    rid = new_id()
    t = now()
    status = "pending"
    with db() as conn:
        conn.execute(
            "INSERT INTO Reminders VALUES (?,?,?,?,?,?)",
            (rid, user_id, title.strip(), trigger_at, status, t)
        )
    return {"id": rid, "title": title, "trigger_at": trigger_at, "status": status}

def delete_reminder(user_id: str, reminder_id: str) -> bool:
    with db() as conn:
        res = conn.execute("DELETE FROM Reminders WHERE id=? AND user_id=?", (reminder_id, user_id))
        return getattr(res, "rowcount", 1) > 0
