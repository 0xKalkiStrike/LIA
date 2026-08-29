"""Web Intelligence layer -- unified dispatcher over surface / deep / Tor search.

    from agents.web_intel import unified_search
    results = await unified_search("retrieval augmented generation", depth="all")

Every result is normalized to {title, link, snippet, source} regardless of
which tier produced it, so callers (commander.py, lia_orchestrator.py, the
/api/intel/* endpoints) don't need to branch on depth.
"""
from __future__ import annotations

import asyncio
from typing import Literal

from . import surface, deep, tor_net

Depth = Literal["surface", "deep", "tor", "all"]


async def unified_search(query: str, depth: Depth = "surface", max_results: int = 5) -> dict:
    """Dispatch a query to one or more web-intelligence tiers.

    Returns {"query": query, "depth": depth, "results": [...], "errors": [...]}.
    Errors from one tier never suppress results from another.
    """
    tasks: dict[str, "asyncio.Task"] = {}

    async def _run():
        nonlocal tasks
        coros = {}
        if depth in ("surface", "all"):
            coros["surface"] = surface.multi_engine_search(query, max_results=max_results)
        if depth in ("deep", "all"):
            coros["deep"] = deep.deep_search(query, max_results=max_results)
        if depth in ("tor", "all"):
            coros["tor"] = tor_net.search_ahmia(query, max_results=max_results)

        names = list(coros.keys())
        gathered = await asyncio.gather(*coros.values(), return_exceptions=True)
        return dict(zip(names, gathered))

    tier_results = await _run()

    results: list[dict] = []
    errors: list[dict] = []
    for tier, res in tier_results.items():
        if isinstance(res, Exception):
            errors.append({"tier": tier, "error": str(res)[:200]})
            continue
        results.extend(res or [])

    return {"query": query, "depth": depth, "results": results, "errors": errors}
