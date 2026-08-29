#!/usr/bin/env python
"""lia_orchestrator.py -- ties Ollama, the FastAPI backend, the web
intelligence layer, and n8n together for 24/7 research cycles.

Usage:
    python lia_orchestrator.py health              # check every subsystem
    python lia_orchestrator.py research "<query>"    # one-shot research cycle
    python lia_orchestrator.py serve                # n8n-independent scheduler loop

`research` and `serve` run the same logic the n8n cron path drives over
HTTP (agents.web_intel -> core.intel_store -> Ollama synthesis), but
in-process, so they work even when n8n isn't running -- and don't require
an authenticated session, since /api/intel/* carries no user-specific data.
"""
from __future__ import annotations

import asyncio
import json
import socket
import sys
import time
import urllib.error
import urllib.request

from core.config import setting
from core import persona, intel_store

TIMEOUT = 5


def _http_get_ok(url: str, timeout: int = TIMEOUT) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status == 200, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        # Some endpoints (e.g. n8n webhook with no query params) may 4xx but
        # still prove the service is up and routing requests.
        return e.code < 500, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)[:150]


def _tcp_open(host: str, port: int, timeout: int = TIMEOUT) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, "port open"
    except Exception as e:
        return False, str(e)[:150]


def health() -> dict:
    ollama_url = setting("ollama_url", "http://localhost:11434")
    backend_host = setting("host", "127.0.0.1")
    backend_port = setting("port", 8001)
    n8n_url = setting("n8n_url", "http://localhost:5678")
    tor_host = setting("tor_socks_host", "127.0.0.1")
    tor_port = setting("tor_socks_port", 9050)

    checks = {}
    ok, detail = _http_get_ok(f"{ollama_url}/api/tags")
    checks["ollama"] = {"ok": ok, "detail": detail, "url": f"{ollama_url}/api/tags"}

    ok, detail = _http_get_ok(f"http://{backend_host}:{backend_port}/api/state")
    checks["backend"] = {"ok": ok, "detail": detail, "url": f"http://{backend_host}:{backend_port}/api/state"}

    ok, detail = _http_get_ok(f"{n8n_url}/webhook/lia-greeting?user_id=health")
    checks["n8n"] = {"ok": ok, "detail": detail, "url": f"{n8n_url}/webhook/lia-greeting"}

    ok, detail = _tcp_open(tor_host, tor_port)
    checks["tor_proxy"] = {"ok": ok, "detail": detail, "target": f"{tor_host}:{tor_port}"}

    return checks


def _print_health(checks: dict) -> bool:
    all_ok = True
    for name, result in checks.items():
        status = "UP  " if result["ok"] else "DOWN"
        all_ok = all_ok and result["ok"]
        print(f"  [{status}] {name:10s} {result['detail']}")
    return all_ok


async def run_research_cycle(query: str, depth: str = "all") -> dict:
    from agents.web_intel import unified_search

    search_out = await unified_search(query, depth=depth)
    results = search_out["results"]

    persisted = 0
    if results:
        try:
            embeddings = await asyncio.gather(
                *[intel_store.embed(f"{r.get('title', '')}\n{r.get('snippet', '')}") for r in results]
            )
            persisted = intel_store.persist_sync(query, results, embeddings)
        except Exception as e:
            print(f"[Orchestrator] Persistence skipped (embedding/store failed): {str(e)[:150]}")

    search_context = "\n".join(
        f"[{i+1}] ({r.get('source','')}) {r.get('title','')} -- {r.get('link','')}\n    {r.get('snippet','')}"
        for i, r in enumerate(results)
    ) or "No results found."

    system_prompt = persona.build_system_prompt(
        "research", char_name="LIA", user_name="Commander", search_context=search_context
    )

    summary = _ollama_synthesize(system_prompt, query)

    return {
        "query": query,
        "depth": depth,
        "result_count": len(results),
        "persisted": persisted,
        "errors": search_out.get("errors", []),
        "summary": summary,
    }


def _ollama_synthesize(system_prompt: str, query: str) -> str:
    payload = json.dumps({
        "model": setting("ollama_model", "llama3.2"),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Summarize the research findings for: {query}"},
        ],
        "stream": False,
        # Same generation options as the n8n Ollama Chat node, so both entry
        # points behave the same -- also caps response length so synthesis
        # can't run away and blow the request timeout below.
        "options": {"temperature": 0.72, "num_predict": 512, "top_p": 0.9},
    }).encode()
    req = urllib.request.Request(
        setting("ollama_url", "http://localhost:11434") + "/api/chat",
        data=payload, headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
        return data.get("message", {}).get("content", "").strip() or "(Ollama returned an empty response.)"
    except Exception as e:
        return f"(Synthesis unavailable -- Ollama unreachable: {str(e)[:150]})"


async def serve() -> None:
    """n8n-independent 24/7 scheduler: rotates through config/settings.json's
    'watch_queries' every 'research_interval_seconds', running a full
    research cycle for each. Runs until interrupted (Ctrl+C)."""
    interval = int(setting("research_interval_seconds", 1800))
    queries = setting("watch_queries", [])

    if not queries:
        print(
            "No watch_queries configured in config/settings.json. "
            "Add e.g. \"watch_queries\": [\"topic to monitor\"] to enable the scheduler loop."
        )
        return

    print(f"Starting LIA research scheduler: {len(queries)} watch queries, every {interval}s. Ctrl+C to stop.")
    idx = 0
    while True:
        query = queries[idx % len(queries)]
        idx += 1
        print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Running research cycle for: {query}")
        try:
            result = await run_research_cycle(query)
            print(f"  -> {result['result_count']} results, {result['persisted']} persisted")
        except Exception as e:
            print(f"  -> cycle failed: {str(e)[:200]}")
        await asyncio.sleep(interval)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    command = sys.argv[1]

    if command == "health":
        print("LIA subsystem health:\n")
        all_ok = _print_health(health())
        return 0 if all_ok else 1

    if command == "research":
        if len(sys.argv) < 3:
            print("Usage: python lia_orchestrator.py research \"<query>\"")
            return 1
        query = " ".join(sys.argv[2:])
        result = asyncio.run(run_research_cycle(query))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if command == "serve":
        try:
            asyncio.run(serve())
        except KeyboardInterrupt:
            print("\nScheduler stopped.")
        return 0

    print(f"Unknown command: {command}\n")
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
