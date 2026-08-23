"""Productivity Suite Agent — Notes, Tasks, Calendar, Reminders using JSON."""
import time
import uuid
from core import json_db

def _new_id() -> str:
    return uuid.uuid4().hex

def _now() -> float:
    return time.time()

# ── Notes ──────────────────────────────────────────────────────────────────
def list_notes(user_id: str) -> list[dict]:
    notes = json_db.find("notes", {"user_id": user_id})
    notes.sort(key=lambda x: -x.get("updated_at", 0))
    return notes

def create_note(user_id: str, title: str, content: str, tags: str = "[]") -> dict:
    nid = _new_id()
    t = _now()
    note_doc = {
        "user_id": user_id,
        "title": title.strip(),
        "content": content,
        "tags": tags,
        "updated_at": t,
        "created_at": t
    }
    json_db.insert("notes", nid, note_doc)
    note_doc["id"] = nid
    return note_doc

def update_note(user_id: str, note_id: str, title: str, content: str, tags: str = "[]") -> dict:
    t = _now()
    note = json_db.get("notes", note_id)
    if note and note.get("user_id") == user_id:
        note.update({
            "title": title.strip(),
            "content": content,
            "tags": tags,
            "updated_at": t
        })
        json_db.insert("notes", note_id, note)
    return note

def delete_note(user_id: str, note_id: str) -> bool:
    note = json_db.get("notes", note_id)
    if note and note.get("user_id") == user_id:
        json_db.delete("notes", note_id)
        return True
    return False

# ── Tasks ──────────────────────────────────────────────────────────────────
def list_tasks(user_id: str) -> list[dict]:
    tasks = json_db.find("tasks", {"user_id": user_id})
    tasks.sort(key=lambda x: -x.get("created_at", 0))
    return tasks

def create_task(user_id: str, title: str, due_at: float = None) -> dict:
    tid = _new_id()
    t = _now()
    task_doc = {
        "user_id": user_id,
        "title": title.strip(),
        "status": "pending",
        "due_at": due_at,
        "created_at": t
    }
    json_db.insert("tasks", tid, task_doc)
    task_doc["id"] = tid
    return task_doc

def update_task(user_id: str, task_id: str, title: str, status: str, due_at: float = None) -> dict:
    task = json_db.get("tasks", task_id)
    if task and task.get("user_id") == user_id:
        task.update({
            "title": title.strip(),
            "status": status,
            "due_at": due_at
        })
        json_db.insert("tasks", task_id, task)
    return task

def delete_task(user_id: str, task_id: str) -> bool:
    task = json_db.get("tasks", task_id)
    if task and task.get("user_id") == user_id:
        json_db.delete("tasks", task_id)
        return True
    return False

# ── Calendar ───────────────────────────────────────────────────────────────
def list_events(user_id: str) -> list[dict]:
    events = json_db.find("events", {"user_id": user_id})
    events.sort(key=lambda x: x.get("start_time", 0))
    return events

def create_event(user_id: str, title: str, description: str, start_time: float, end_time: float) -> dict:
    eid = _new_id()
    t = _now()
    event_doc = {
        "user_id": user_id,
        "title": title.strip(),
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "created_at": t
    }
    json_db.insert("events", eid, event_doc)
    event_doc["id"] = eid
    return event_doc

def update_event(user_id: str, event_id: str, title: str, description: str, start_time: float, end_time: float) -> dict:
    event = json_db.get("events", event_id)
    if event and event.get("user_id") == user_id:
        event.update({
            "title": title.strip(),
            "description": description,
            "start_time": start_time,
            "end_time": end_time
        })
        json_db.insert("events", event_id, event)
    return event

def delete_event(user_id: str, event_id: str) -> bool:
    event = json_db.get("events", event_id)
    if event and event.get("user_id") == user_id:
        json_db.delete("events", event_id)
        return True
    return False

# ── Reminders ──────────────────────────────────────────────────────────────
def list_reminders(user_id: str) -> list[dict]:
    reminders = json_db.find("reminders", {"user_id": user_id})
    reminders.sort(key=lambda x: x.get("trigger_at", 0))
    return reminders

def create_reminder(user_id: str, title: str, trigger_at: float) -> dict:
    rid = _new_id()
    t = _now()
    reminder_doc = {
        "user_id": user_id,
        "title": title.strip(),
        "trigger_at": trigger_at,
        "status": "pending",
        "created_at": t
    }
    json_db.insert("reminders", rid, reminder_doc)
    reminder_doc["id"] = rid
    return reminder_doc

def delete_reminder(user_id: str, reminder_id: str) -> bool:
    reminder = json_db.get("reminders", reminder_id)
    if reminder and reminder.get("user_id") == user_id:
        json_db.delete("reminders", reminder_id)
        return True
    return False
