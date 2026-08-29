"""Tor/onion routing layer — OSINT and network-research tooling.

Routes queries through a local or remote Tor SOCKS5 proxy so surface-level
metadata about onion services can be gathered anonymously for legitimate
research, security education, or defensive/OSINT use. This module only
fetches and returns page metadata (titles/links/snippets) -- it does not
interact with, facilitate access to, or provide operational guidance for
illegal marketplaces or content. Same safety framing as the existing
warning text in agents/search_agent.py's darkweb_search().

Configurable so the same code works against a Tor daemon running on
localhost during development and against a differently-hosted one in a
deployed/"live" environment: host/port are read from config/settings.json
first, then overridable via TOR_SOCKS_HOST / TOR_SOCKS_PORT env vars.
"""
from __future__ import annotations

import os
import re
import urllib.parse
from html.parser import HTMLParser

import aiohttp
from aiohttp_socks import ProxyConnector

from core.config import setting

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LIA-WebIntel-Tor/1.0"


def tor_enabled() -> bool:
    return bool(setting("tor_enabled", True))


def _socks_host() -> str:
    return os.environ.get("TOR_SOCKS_HOST") or setting("tor_socks_host", "127.0.0.1")


def _socks_port() -> int:
    env = os.environ.get("TOR_SOCKS_PORT")
    if env:
        return int(env)
    return int(setting("tor_socks_port", 9050))


def _control_port() -> int:
    return int(setting("tor_control_port", 9051))


def _control_password() -> str | None:
    return os.environ.get("TOR_CONTROL_PASSWORD") or setting("tor_control_password")


def _proxy_url() -> str:
    # aiohttp_socks/python_socks only recognizes the bare "socks5" scheme
    # (not curl/requests' "socks5h" convention) -- remote (through-proxy)
    # DNS resolution is the ProxyConnector default for SOCKS5 regardless,
    # so this still avoids leaking DNS queries outside Tor.
    return f"socks5://{_socks_host()}:{_socks_port()}"


async def tor_get(url: str, timeout: int = 20) -> dict:
    """Fetch a URL through the Tor SOCKS proxy. Never raises -- returns a
    structured {"ok": bool, "text": str|None, "error": str|None} so callers
    can degrade gracefully when Tor isn't reachable."""
    if not tor_enabled():
        return {"ok": False, "text": None, "error": "Tor routing is disabled (tor_enabled=false)."}

    try:
        connector = ProxyConnector.from_url(_proxy_url())
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.get(
                url, headers={"User-Agent": _UA}, timeout=aiohttp.ClientTimeout(total=timeout)
            ) as resp:
                text = await resp.text(errors="ignore")
                return {"ok": resp.status == 200, "text": text, "error": None if resp.status == 200 else f"HTTP {resp.status}"}
    except Exception as e:
        return {
            "ok": False,
            "text": None,
            "error": f"Tor proxy at {_socks_host()}:{_socks_port()} unreachable: {str(e)[:150]}",
        }


def renew_circuit() -> dict:
    """Send NEWNYM over the Tor control port to get a fresh circuit."""
    try:
        from stem import Signal
        from stem.control import Controller
    except ImportError:
        return {"ok": False, "error": "stem is not installed (pip install stem)."}

    try:
        with Controller.from_port(address=_socks_host(), port=_control_port()) as controller:
            password = _control_password()
            if password:
                controller.authenticate(password=password)
            else:
                controller.authenticate()
            controller.signal(Signal.NEWNYM)
        return {"ok": True, "error": None}
    except Exception as e:
        return {"ok": False, "error": f"Circuit renewal failed: {str(e)[:150]}"}


class _OnionLinkParser(HTMLParser):
    """Extracts onion-service search results without depending on a
    specific CSS/class markup contract -- captures every anchor whose href
    references an onion address (directly, or via a redirect query param),
    using the anchor text as the title and the immediately following text
    run as the snippet."""

    def __init__(self):
        super().__init__()
        self.results: list[dict] = []
        self._current: dict | None = None
        self._in_link = False

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        attrs = dict(attrs)
        href = attrs.get("href", "")
        if ".onion" not in href:
            return
        link = href
        if "redirect_url=" in href:
            try:
                link = urllib.parse.unquote(href.split("redirect_url=")[1].split("&")[0])
            except Exception:
                pass
        self._current = {"title": "", "link": link, "snippet": ""}
        self._in_link = True

    def handle_endtag(self, tag):
        if tag == "a" and self._in_link:
            self._in_link = False
            if self._current and self._current["title"]:
                self.results.append(self._current)
            self._current = None

    def handle_data(self, data):
        cleaned = data.strip()
        if not cleaned or self._current is None:
            return
        if self._in_link:
            self._current["title"] += cleaned
        else:
            # text right after the closing </a> of the most recent result
            if self.results and len(self.results[-1]["snippet"]) < 200:
                self.results[-1]["snippet"] += (" " + cleaned)


async def search_ahmia(query: str, max_results: int = 5) -> list[dict]:
    """Query Ahmia (ahmia.fi), the standard clearnet index of onion
    services, routed through the Tor SOCKS proxy. Returns onion URLs +
    metadata as data only -- does not auto-visit results."""
    url = f"https://ahmia.fi/search/?q={urllib.parse.quote(query)}"
    result = await tor_get(url)
    if not result["ok"] or not result["text"]:
        return []

    parser = _OnionLinkParser()
    parser.feed(result["text"])

    out = []
    for r in parser.results[:max_results]:
        out.append({
            "title": r["title"].strip()[:120],
            "link": r["link"].strip(),
            "snippet": re.sub(r"\s+", " ", r["snippet"]).strip()[:200],
            "source": "ahmia_tor",
        })
    return out
