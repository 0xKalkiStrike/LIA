"""Memory Agent — long-term memory in SQLite (ChromaDB optional upgrade) and knowledge base caching.

Categories: preference | interest | habit | fact | command
"""
import re
from core.database import db, new_id, now

_CHROMA = False
collection = None

try:  # optional semantic memory
    import chromadb
    from core.config import DATA_DIR
    chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chroma"))
    collection = chroma_client.get_or_create_collection("memories")
    _CHROMA = True
except Exception:
    pass


def remember(user_id: str, content: str, category: str = "fact", importance: int = 1):
    mem_id = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO Memories VALUES (?,?,?,?,?,?)",
            (mem_id, user_id, category, content.strip(), importance, now()),
        )
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
    with db() as conn:
        rows = conn.execute(
            "SELECT content, category FROM Memories WHERE user_id=? "
            "ORDER BY importance DESC, created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [f"[{r['category']}] {r['content']}" for r in rows]


def search(user_id: str, query: str, limit: int = 8) -> list[str]:
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

    with db() as conn:
        rows = conn.execute(
            "SELECT content FROM Memories WHERE user_id=? AND content LIKE ? "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, f"%{query}%", limit),
        ).fetchall()
    return [r["content"] for r in rows]


def save_turn(user_id: str, role: str, content: str, language: str = "english"):
    with db() as conn:
        conn.execute(
            "INSERT INTO Conversations VALUES (?,?,?,?,?,?)",
            (new_id(), user_id, role, content, language, now()),
        )


def recent_turns(user_id: str, limit: int = 10) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM Conversations WHERE user_id=? "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def cache_knowledge(key: str, value: str):
    """Store retrieved search results or facts in the KnowledgeCache."""
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO KnowledgeCache VALUES (?,?,?)",
            (key.lower().strip(), value, now())
        )


def get_cached_knowledge(key: str) -> str | None:
    """Retrieve knowledge from the KnowledgeCache if it's fresh (less than 24h old)."""
    with db() as conn:
        row = conn.execute(
            "SELECT value, created_at FROM KnowledgeCache WHERE key=?",
            (key.lower().strip(),)
        ).fetchone()
    if row and (now() - row["created_at"]) < 24 * 3600:
        return row["value"]
    return None


def auto_extract(user_id: str, user_message: str):
    """Heuristic memory extraction and profile learning from user interaction."""
    low = user_message.lower().strip()
    
    # 1. Learn commander's name
    name_match = re.search(r"\bmy name is\s+([a-z0-9 ]{2,30})", low)
    if not name_match:
        name_match = re.search(r"\bcall me\s+([a-z0-9 ]{2,30})", low)
        
    if name_match:
        new_name = name_match.group(1).strip().title()
        if new_name:
            with db() as conn:
                conn.execute(
                    "UPDATE Users SET display_name=? WHERE id=?",
                    (new_name, user_id)
                )
            remember(user_id, f"Commander's name is {new_name}", category="fact", importance=3)
            return

    # 2. Learn system / coding preferences
    if "python" in low:
        remember(user_id, "Commander prefers coding in Python.", category="preference", importance=2)
    elif "javascript" in low or "js" in low:
        remember(user_id, "Commander prefers coding in JavaScript.", category="preference", importance=2)

    # 3. Standard preference indicators
    triggers = ("i like", "i love", "my favourite", "my favorite", "i hate",
                "remember that", "mane game che", "mujhe pasand hai")
    if any(t in low for t in triggers):
        remember(user_id, user_message, category="preference", importance=2)

