"""Surface web layer — async multi-engine search aggregation.

Uses aiohttp instead of Scrapy: this repo is intentionally dependency-light
(see requirements.txt header) and Scrapy is a full crawling framework with
its own project/pipeline structure that doesn't fit a per-request agent
call. Playwright is used only for the optional JS-rendering fetch tool and
is lazy-imported so it's never required for the default search path.
"""
from __future__ import annotations

import os
import urllib.parse
from html.parser import HTMLParser

import aiohttp

from core.config import setting
from agents.scraper_agent import DDGResultParser, SimpleHTMLTextExtractor

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LIA-WebIntel/1.0"

_PUBLIC_SEARXNG_INSTANCES = (
    "https://searx.be/search",
    "https://search.privacyguide.org/search",
)


async def _get(session: aiohttp.ClientSession, url: str, timeout: int = 10) -> str | None:
    try:
        async with session.get(
            url, headers={"User-Agent": _UA}, timeout=aiohttp.ClientTimeout(total=timeout)
        ) as resp:
            if resp.status != 200:
                return None
            return await resp.text(errors="ignore")
    except Exception as e:
        print(f"[WebIntel/surface] GET {url} failed: {str(e)[:100]}")
        return None


async def duckduckgo_html(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    page = await _get(session, url)
    if not page:
        return []

    parser = DDGResultParser()
    parser.feed(page)

    results = []
    for r in parser.results[:max_results]:
        link = r["link"]
        if "uddg=" in link:
            try:
                link = urllib.parse.unquote(link.split("uddg=")[1].split("&")[0])
            except Exception:
                pass
        if link.startswith("//"):
            link = "https:" + link
        if not link.startswith("http"):
            continue
        results.append({
            "title": r["title"].strip()[:100],
            "link": link,
            "snippet": r["snippet"].strip()[:200],
            "source": "duckduckgo",
        })
    return results


async def searxng_search(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    import json as _json

    instances = []
    configured = setting("searxng_url")
    if configured:
        instances.append(configured)
    instances.extend(_PUBLIC_SEARXNG_INSTANCES)

    for instance in instances:
        url = f"{instance}?q={urllib.parse.quote(query)}&format=json"
        raw = await _get(session, url)
        if not raw:
            continue
        try:
            data = _json.loads(raw)
        except Exception:
            continue
        results = []
        for item in data.get("results", [])[:max_results]:
            results.append({
                "title": (item.get("title") or "")[:100],
                "link": item.get("url", ""),
                "snippet": (item.get("content") or "")[:200],
                "source": "searxng",
            })
        if results:
            return results
    return []


async def google_cse_search(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    """Google Custom Search JSON API. Entirely optional — skipped with zero
    cost when GOOGLE_CSE_ID/GOOGLE_CSE_KEY aren't set, same pattern as the
    optional Brave key in scraper_agent._brave_search."""
    import json as _json

    cse_id = os.environ.get("GOOGLE_CSE_ID") or setting("google_cse_id")
    api_key = os.environ.get("GOOGLE_CSE_KEY") or setting("google_cse_key")
    if not cse_id or not api_key:
        return []

    url = (
        "https://www.googleapis.com/customsearch/v1"
        f"?key={api_key}&cx={cse_id}&q={urllib.parse.quote(query)}&num={min(max_results, 10)}"
    )
    raw = await _get(session, url)
    if not raw:
        return []
    try:
        data = _json.loads(raw)
    except Exception:
        return []

    results = []
    for item in data.get("items", [])[:max_results]:
        results.append({
            "title": (item.get("title") or "")[:100],
            "link": item.get("link", ""),
            "snippet": (item.get("snippet") or "")[:200],
            "source": "google_cse",
        })
    return results


_ENGINE_FUNCS = {
    "duckduckgo": duckduckgo_html,
    "searxng": searxng_search,
    "google_cse": google_cse_search,
}


async def multi_engine_search(
    query: str,
    engines: tuple[str, ...] = ("duckduckgo", "searxng", "google_cse"),
    max_results: int = 5,
) -> list[dict]:
    """Fan out to every requested engine concurrently, merge, de-dupe by URL."""
    import asyncio

    async with aiohttp.ClientSession() as session:
        tasks = [_ENGINE_FUNCS[e](session, query, max_results) for e in engines if e in _ENGINE_FUNCS]
        engine_results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: list[dict] = []
    seen_links: set[str] = set()
    for res in engine_results:
        if isinstance(res, Exception) or not res:
            continue
        for item in res:
            link = item.get("link", "")
            if not link or link in seen_links:
                continue
            seen_links.add(link)
            merged.append(item)

    return merged[:max_results * len(engines)]


async def render_js_page(url: str) -> str:
    """Render a JS-heavy page with Playwright and extract its text.
    Playwright is an optional dependency (see requirements.txt) — raises a
    clear, actionable error instead of crashing the caller if it's missing."""
    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        raise RuntimeError(
            "Playwright is not installed. Install it with "
            "`pip install playwright && playwright install chromium` to enable JS page rendering."
        ) from e

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            page = await browser.new_page(user_agent=_UA)
            await page.goto(url, timeout=20000, wait_until="networkidle")
            html = await page.content()
        finally:
            await browser.close()

    parser = SimpleHTMLTextExtractor()
    parser.feed(html)
    return parser.get_text()
