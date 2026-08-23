"""Memory Agent — long-term memory using JSON and ChromaDB for semantic search."""
import re
import time
import uuid
from core import json_db

_CHROMA = False
collection = None

try:
    import chromadb
    from core.config import DATA_DIR
    chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chroma"))
    collection = chroma_client.get_or_create_collection("memories")
    _CHROMA = True
except Exception:
    pass

def _new_id() -> str:
    return uuid.uuid4().hex

def _now() -> float:
    return time.time()

def remember(user_id: str, content: str, category: str = "fact", importance: int = 1):
    """Store a memory."""
    mem_id = _new_id()
    mem_doc = {
        "user_id": user_id,
        "category": category,
        "content": content.strip(),
        "importance": importance,
        "created_at": _now()
    }
    json_db.insert("memories", mem_id, mem_doc)

    if _CHROMA and collection:
        try:
            collection.add(
                documents=[content.strip()],
                ids=[mem_id],
                metadatas=[{"user_id": user_id, "category": category}]
            )
        except Exception:
            pass

def recall(user_id: str, limit: int = 12) -> list[str]:
    """Recall user's memories."""
    memories = json_db.find("memories", {"user_id": user_id})
    # Filter out vault and sort by importance then date
    memories = [m for m in memories if m.get("category") != "vault"]
    memories.sort(key=lambda x: (-x.get("importance", 0), -x.get("created_at", 0)))
    return [f"[{m['category']}] {m['content']}" for m in memories[:limit]]

def search(user_id: str, query: str, limit: int = 8) -> list[str]:
    """Search memories by keyword."""
    if _CHROMA and collection:
        try:
            results = collection.query(
                query_texts=[query],
                n_results=limit,
                where={"user_id": user_id}
            )
            if results and results.get("documents"):
                return [doc for doc in results["documents"][0]]
        except Exception:
            pass

    # Fallback: keyword search
    memories = json_db.find("memories", {"user_id": user_id})
    results = []
    for m in memories:
        if query.lower() in m.get("content", "").lower():
            results.append(m["content"])
    return results[:limit]

def save_turn(user_id: str, role: str, content: str, language: str = "english"):
    """Save conversation turn."""
    turn_doc = {
        "user_id": user_id,
        "role": role,
        "content": content,
        "language": language,
        "created_at": _now()
    }
    json_db.insert("conversations", _new_id(), turn_doc)

def recent_turns(user_id: str, limit: int = 10) -> list[dict]:
    """Get recent conversation turns."""
    turns = json_db.find("conversations", {"user_id": user_id})
    turns.sort(key=lambda x: x.get("created_at", 0))
    return [{"role": t["role"], "content": t["content"]} for t in turns[-limit:]]

def cache_knowledge(key: str, value: str):
    """Store knowledge in cache."""
    json_db.insert("knowledge_cache", key.lower().strip(), {
        "key": key.lower().strip(),
        "value": value,
        "created_at": _now()
    })

def get_cached_knowledge(key: str) -> str | None:
    """Get knowledge from cache if fresh (< 24h old)."""
    cached = json_db.get("knowledge_cache", key.lower().strip())
    if cached and (_now() - cached.get("created_at", 0)) < 24 * 3600:
        return cached.get("value")
    return None

def remember_vault(user_id: str, content: str):
    """Save personal memory to vault."""
    remember(user_id, content.strip(), category="vault", importance=5)

def recall_vault(user_id: str, limit: int = 20) -> list[dict]:
    """Get vault memories."""
    import datetime
    memories = json_db.find("memories", {"user_id": user_id, "category": "vault"})
    memories.sort(key=lambda x: -x.get("created_at", 0))

    result = []
    for m in memories[:limit]:
        ts = datetime.datetime.fromtimestamp(m["created_at"]).strftime("%d %b %Y, %I:%M %p")
        result.append({"content": m["content"], "saved_at": ts})
    return result

def auto_extract(user_id: str, user_message: str):
    """Auto-extract memories from user message."""
    low = user_message.lower().strip()

    # Learn commander's name
    name_match = re.search(r"\bmy name is\s+([a-z0-9 ]{2,30})", low)
    if not name_match:
        name_match = re.search(r"\bcall me\s+([a-z0-9 ]{2,30})", low)

    if name_match:
        new_name = name_match.group(1).strip().title()
        if new_name:
            user = json_db.get("users", user_id)
            if user:
                user["display_name"] = new_name
                json_db.insert("users", user_id, user)
            remember(user_id, f"Commander's name is {new_name}", category="fact", importance=3)
            return

    # Learn programming preferences
    if "python" in low:
        remember(user_id, "Commander prefers coding in Python.", category="preference", importance=2)
    elif "javascript" in low or "js" in low:
        remember(user_id, "Commander prefers coding in JavaScript.", category="preference", importance=2)

    # Learn preferences from triggers
    triggers = ("i like", "i love", "my favourite", "my favorite", "i hate",
                "remember that", "mane game che", "mujhe pasand hai")
    if any(t in low for t in triggers):
        remember(user_id, user_message, category="preference", importance=2)
