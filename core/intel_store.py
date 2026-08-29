"""Vector persistence for the web-intelligence layer -- backs
/api/intel/persist and /api/intel/query. Real Chroma persistence (not a
stub): embeddings come from Ollama's /api/embeddings endpoint, vectors are
stored in a PersistentClient collection under data/chroma (the directory
that already existed on disk before this module).
"""
from __future__ import annotations

import hashlib
import time

import aiohttp

from core.config import DATA_DIR, setting

_COLLECTION_NAME = "lia_intel"
_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    import chromadb
    _client = chromadb.PersistentClient(path=str(DATA_DIR / "chroma"))
    _collection = _client.get_or_create_collection(_COLLECTION_NAME)
    return _collection


async def embed(text: str) -> list[float]:
    """Embed text via Ollama's /api/embeddings endpoint."""
    model = setting("ollama_embedding_model", "nomic-embed-text")
    url = setting("ollama_url") + "/api/embeddings"
    async with aiohttp.ClientSession() as session:
        async with session.post(
            url, json={"model": model, "prompt": text}, timeout=aiohttp.ClientTimeout(total=30)
        ) as resp:
            data = await resp.json()
    embedding = data.get("embedding")
    if not embedding:
        raise RuntimeError(f"Ollama embeddings call returned no vector (model={model}); is it pulled?")
    return embedding


def _doc_id(link: str, title: str) -> str:
    basis = link or title
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:32]


def persist_sync(query: str, results: list[dict], embeddings: list[list[float]]) -> int:
    """Blocking Chroma upsert -- call via run_in_threadpool from async routes."""
    if not results:
        return 0
    collection = _get_collection()
    ids, docs, metas, vecs = [], [], [], []
    for item, vec in zip(results, embeddings):
        title = item.get("title", "")
        link = item.get("link", "")
        snippet = item.get("snippet", "")
        ids.append(_doc_id(link, title))
        docs.append(f"{title}\n{snippet}")
        metas.append({
            "query": query,
            "link": link,
            "title": title,
            "source": item.get("source", ""),
            "persisted_at": time.time(),
        })
        vecs.append(vec)
    collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=vecs)
    return len(ids)


def query_sync(query_embedding: list[float], n_results: int = 5) -> list[dict]:
    """Blocking Chroma similarity query -- call via run_in_threadpool."""
    collection = _get_collection()
    if collection.count() == 0:
        return []
    res = collection.query(query_embeddings=[query_embedding], n_results=min(n_results, collection.count()))
    out = []
    metadatas = (res.get("metadatas") or [[]])[0]
    documents = (res.get("documents") or [[]])[0]
    distances = (res.get("distances") or [[]])[0]
    for meta, doc, dist in zip(metadatas, documents, distances):
        out.append({
            "title": meta.get("title", ""),
            "link": meta.get("link", ""),
            "source": meta.get("source", ""),
            "original_query": meta.get("query", ""),
            "document": doc,
            "distance": dist,
        })
    return out
