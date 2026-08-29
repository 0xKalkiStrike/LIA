"""LIA AI — JSON-based database (replaces SQLite)"""
import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Lock for thread-safe file operations
_lock = threading.Lock()

COLLECTIONS = {
    "users": DATA_DIR / "users.json",
    "profiles": DATA_DIR / "profiles.json",
    "sessions": DATA_DIR / "sessions.json",
    "memories": DATA_DIR / "memories.json",
    "conversations": DATA_DIR / "conversations.json",
    "tasks": DATA_DIR / "tasks.json",
    "notes": DATA_DIR / "notes.json",
    "events": DATA_DIR / "calendar_events.json",
    "reminders": DATA_DIR / "reminders.json",
    "voice_settings": DATA_DIR / "voice_settings.json",
    "logs": DATA_DIR / "logs.json",
    "detections": DATA_DIR / "detections.json",
    "video_projects": DATA_DIR / "video_projects.json",
}

def _load_collection(collection: str) -> Dict[str, Any]:
    """Load JSON collection, create if missing."""
    path = COLLECTIONS.get(collection)
    if not path:
        raise ValueError(f"Unknown collection: {collection}")

    if not path.exists():
        return {}

    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def _save_collection(collection: str, data: Dict[str, Any]) -> None:
    """Save JSON collection."""
    path = COLLECTIONS.get(collection)
    if not path:
        raise ValueError(f"Unknown collection: {collection}")

    with _lock:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

def get(collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
    """Get document by ID."""
    data = _load_collection(collection)
    return data.get(doc_id)

def find(collection: str, query: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Find documents matching query."""
    data = _load_collection(collection)
    results = []

    for doc_id, doc in data.items():
        match = True
        for key, value in query.items():
            if doc.get(key) != value:
                match = False
                break
        if match:
            doc["id"] = doc_id
            results.append(doc)

    return results

def find_one(collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Find first document matching query."""
    results = find(collection, query)
    if results:
        return results[0]
    return None

def insert(collection: str, doc_id: str, doc: Dict[str, Any]) -> None:
    """Insert or update document."""
    data = _load_collection(collection)
    data[doc_id] = doc
    _save_collection(collection, data)

def update(collection: str, doc_id: str, updates: Dict[str, Any]) -> None:
    """Update document fields."""
    data = _load_collection(collection)
    if doc_id in data:
        data[doc_id].update(updates)
        _save_collection(collection, data)

def delete(collection: str, doc_id: str) -> None:
    """Delete document."""
    data = _load_collection(collection)
    if doc_id in data:
        del data[doc_id]
        _save_collection(collection, data)

def delete_many(collection: str, query: Dict[str, Any]) -> int:
    """Delete all documents matching query."""
    data = _load_collection(collection)
    to_delete = []

    for doc_id, doc in data.items():
        match = True
        for key, value in query.items():
            if doc.get(key) != value:
                match = False
                break
        if match:
            to_delete.append(doc_id)

    for doc_id in to_delete:
        del data[doc_id]

    if to_delete:
        _save_collection(collection, data)

    return len(to_delete)

def count(collection: str) -> int:
    """Count documents in collection."""
    data = _load_collection(collection)
    return len(data)

def init_db() -> None:
    """Initialize all collections."""
    for collection in COLLECTIONS:
        if not COLLECTIONS[collection].exists():
            _save_collection(collection, {})
