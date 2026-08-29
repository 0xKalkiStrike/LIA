"""Deep web / structured-store layer — free, keyless academic + open-data APIs.

Stdlib XML/JSON parsing only (no new dependency beyond aiohttp, already
required by agents.web_intel.surface).
"""
from __future__ import annotations

import asyncio
import urllib.parse
import xml.etree.ElementTree as ET

import aiohttp

_UA = "Mozilla/5.0 LIA-WebIntel/1.0 (academic research; personal project)"

_ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


async def _get(session: aiohttp.ClientSession, url: str, timeout: int = 10) -> str | None:
    try:
        async with session.get(
            url, headers={"User-Agent": _UA}, timeout=aiohttp.ClientTimeout(total=timeout)
        ) as resp:
            if resp.status != 200:
                return None
            return await resp.text(errors="ignore")
    except Exception as e:
        print(f"[WebIntel/deep] GET {url} failed: {str(e)[:100]}")
        return None


async def search_arxiv(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    url = (
        "http://export.arxiv.org/api/query"
        f"?search_query=all:{urllib.parse.quote(query)}&start=0&max_results={max_results}"
    )
    raw = await _get(session, url)
    if not raw:
        return []

    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return []

    results = []
    for entry in root.findall("atom:entry", _ATOM_NS):
        title_el = entry.find("atom:title", _ATOM_NS)
        summary_el = entry.find("atom:summary", _ATOM_NS)
        id_el = entry.find("atom:id", _ATOM_NS)
        title = (title_el.text or "").strip().replace("\n", " ")[:150] if title_el is not None else ""
        snippet = (summary_el.text or "").strip().replace("\n", " ")[:200] if summary_el is not None else ""
        link = (id_el.text or "").strip() if id_el is not None else ""
        if title and link:
            results.append({"title": title, "link": link, "snippet": snippet, "source": "arxiv"})
    return results[:max_results]


async def search_pubmed(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    """NCBI E-utilities esearch + esummary. NCBI's free-tier rate limit is
    3 req/s -- the two sequential calls here stay well within it."""
    esearch_url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        f"?db=pubmed&term={urllib.parse.quote(query)}&retmax={max_results}&retmode=json"
    )
    raw = await _get(session, esearch_url)
    if not raw:
        return []

    import json
    try:
        ids = json.loads(raw).get("esearchresult", {}).get("idlist", [])
    except Exception:
        return []
    if not ids:
        return []

    await asyncio.sleep(0.34)  # stay under NCBI's 3 req/s limit

    esummary_url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        f"?db=pubmed&id={','.join(ids)}&retmode=json"
    )
    raw2 = await _get(session, esummary_url)
    if not raw2:
        return []

    try:
        data = json.loads(raw2)
    except Exception:
        return []

    results = []
    for uid in data.get("result", {}).get("uids", []):
        item = data["result"].get(uid, {})
        title = (item.get("title") or "")[:150]
        if not title:
            continue
        results.append({
            "title": title,
            "link": f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
            "snippet": (item.get("source") or "") + " " + (item.get("pubdate") or ""),
            "source": "pubmed",
        })
    return results[:max_results]


async def search_semantic_scholar(session: aiohttp.ClientSession, query: str, max_results: int = 5) -> list[dict]:
    url = (
        "https://api.semanticscholar.org/graph/v1/paper/search"
        f"?query={urllib.parse.quote(query)}&limit={max_results}&fields=title,abstract,url"
    )
    raw = await _get(session, url)
    if not raw:
        return []

    import json
    try:
        data = json.loads(raw)
    except Exception:
        return []

    results = []
    for item in data.get("data", [])[:max_results]:
        title = (item.get("title") or "")[:150]
        if not title:
            continue
        results.append({
            "title": title,
            "link": item.get("url", ""),
            "snippet": (item.get("abstract") or "")[:200],
            "source": "semantic_scholar",
        })
    return results


async def deep_search(query: str, max_results: int = 5) -> list[dict]:
    """Fan out to arXiv, PubMed, and Semantic Scholar concurrently, merge results."""
    async with aiohttp.ClientSession() as session:
        arxiv_res, pubmed_res, s2_res = await asyncio.gather(
            search_arxiv(session, query, max_results),
            search_pubmed(session, query, max_results),
            search_semantic_scholar(session, query, max_results),
            return_exceptions=True,
        )

    merged: list[dict] = []
    for res in (arxiv_res, pubmed_res, s2_res):
        if isinstance(res, Exception) or not res:
            continue
        merged.extend(res)
    return merged
