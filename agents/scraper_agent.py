"""Scraper Agent — robust web scraping with timeouts and fallbacks"""
import html
import json
import os
import re
import urllib.parse
import urllib.request
import urllib.error
import threading
import time
from html.parser import HTMLParser

from core.config import setting

SCRAPE_TRIGGERS = (
    "scrape", "web scrape", "search web", "search internet", "search online",
    "fetch url", "read webpage", "extract data from", "lookup online",
    "search for", "find news about", "latest news on", "research on"
)

def looks_like_scraper_request(message: str) -> bool:
    """Check if message looks like a scraping/search request"""
    low = message.lower()
    return any(t in low for t in SCRAPE_TRIGGERS) or (
        any(w in low for w in ("search", "scrape", "fetch", "lookup", "research")) and
        any(w in low for w in ("web", "url", "website", "online", "internet", "http", "https"))
    ) or ("http://" in low or "https://" in low)

class SimpleHTMLTextExtractor(HTMLParser):
    """Extract clean text from HTML"""
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.links = []
        self.in_script = False
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.in_script = True
        elif tag == 'a':
            for name, val in attrs:
                if name == 'href' and val and val.startswith(('http://', 'https://')):
                    self.links.append(val)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.in_script = False

    def handle_data(self, data):
        if not self.in_script and not self.in_style:
            cleaned = data.strip()
            if cleaned and len(cleaned) > 2:
                self.text_parts.append(cleaned)

    def get_text(self):
        return " ".join(self.text_parts)[:500]  # Limit to 500 chars

class DDGResultParser(HTMLParser):
    """Extracts search results from DuckDuckGo's HTML results page.

    Uses div-depth tracking rather than a non-greedy regex: each result
    block contains nested <div> tags, so a regex like
    r'<div class="result...">(.*?)</div>' closes on the *first* inner
    </div> and truncates every result before it reaches the snippet.
    """
    def __init__(self):
        super().__init__()
        self.results = []
        self._cur = None
        self._depth = 0
        self._capture = None  # "title" | "snippet" | None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "div":
            if self._cur is None and ("result" in classes or "web-result" in classes):
                self._cur = {"title": "", "link": "", "snippet": ""}
                self._depth = 1
                return
            if self._cur is not None:
                self._depth += 1
        elif tag == "a" and self._cur is not None:
            if "result__a" in classes:
                self._cur["link"] = attrs.get("href", "")
                self._capture = "title"
            elif "result__snippet" in classes:
                self._capture = "snippet"

    def handle_endtag(self, tag):
        if tag == "div" and self._cur is not None:
            self._depth -= 1
            if self._depth == 0:
                if self._cur["title"] and self._cur["link"]:
                    self.results.append(self._cur)
                self._cur = None
        elif tag == "a":
            self._capture = None

    def handle_data(self, data):
        if self._capture and self._cur is not None:
            self._cur[self._capture] += data

def _timeout_handler(func, args, timeout=5):
    """Execute function with timeout"""
    result = [None]
    error = [None]

    def wrapper():
        try:
            result[0] = func(*args)
        except Exception as e:
            error[0] = e

    thread = threading.Thread(target=wrapper, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    if error[0]:
        raise error[0]
    return result[0]

def search_duckduckgo(query: str, max_results: int = 5) -> list:
    """Web search with layered fallbacks, all free and keyless by default.

    DuckDuckGo's plain HTML endpoint frequently serves an anti-bot
    "anomaly" challenge page to server-side requests instead of real
    results (confirmed live -- a bare request returns HTTP 202 with an
    image-captcha page, no result markup at all), so it can't be relied
    on as the only method. Order: Brave API (optional, only runs if you
    add a key -- entirely skipped otherwise, no cost) -> DuckDuckGo's
    Instant Answer JSON API (free, no key, not behind the bot-wall, but
    limited to topic summaries) -> Wikipedia's search API (free, no key,
    a real public API rather than scraping -- covers far more general
    knowledge queries) -> DuckDuckGo HTML scrape (best-effort last
    resort) -> honest fallback.
    """
    results = _brave_search(query, max_results)
    if results:
        return results

    results = _duckduckgo_instant_answer(query, max_results)
    if results:
        return results

    results = _wikipedia_search(query, max_results)
    if results:
        return results

    results = _duckduckgo_html_search(query, max_results)
    if results:
        return results

    return _fallback_results(query)

def _wikipedia_search(query: str, max_results: int = 5) -> list:
    """Wikipedia's full-text search API -- free, keyless, no bot-wall.
    This is a legitimate public API (not scraping), and covers far more
    general-knowledge queries than DuckDuckGo's narrow Instant Answer
    API since it does real full-text search across all articles."""
    try:
        url = (
            "https://en.wikipedia.org/w/api.php?action=query&list=search"
            f"&srsearch={urllib.parse.quote(query)}&format=json&srlimit={max_results}"
        )
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "LIA-Assistant/1.0 (personal project)"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        results = []
        for item in data.get("query", {}).get("search", [])[:max_results]:
            title = item.get("title", "")
            snippet = html.unescape(re.sub(r'<[^>]+>', '', item.get("snippet", "")))
            results.append({
                "title": title[:80],
                "link": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "snippet": snippet[:150]
            })
        return results

    except Exception as e:
        print(f"[Scraper] Wikipedia search failed: {e}")
        return []

def _brave_search(query: str, max_results: int = 5) -> list:
    """Search using the Brave Search API, if an API key is configured
    (env var BRAVE_SEARCH_API_KEY, or "brave_search_api_key" in
    config/settings.json). Entirely optional -- skipped with zero cost
    when no key is set, which is the default. Brave's free tier is
    available at api.search.brave.com if you ever want broader live-web
    coverage than the free methods below provide."""
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY") or setting("brave_search_api_key")
    if not api_key:
        return []

    try:
        url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={max_results}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": api_key,
            }
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        results = []
        for item in data.get("web", {}).get("results", [])[:max_results]:
            results.append({
                "title": item.get("title", "")[:80],
                "link": item.get("url", ""),
                "snippet": re.sub(r'<[^>]+>', '', item.get("description", ""))[:150]
            })
        return results

    except Exception as e:
        print(f"[Scraper] Brave search failed: {e}")
        return []

def _duckduckgo_instant_answer(query: str, max_results: int = 5) -> list:
    """DuckDuckGo's Instant Answer JSON API. Not behind the HTML site's
    bot-wall, but only covers topic summaries / disambiguation -- not
    general web search -- so it often returns nothing for niche queries."""
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        results = []
        if data.get("AbstractText"):
            results.append({
                "title": (data.get("Heading") or query)[:80],
                "link": data.get("AbstractURL", ""),
                "snippet": data["AbstractText"][:150]
            })
        for item in data.get("RelatedTopics", []):
            if len(results) >= max_results:
                break
            if "FirstURL" in item and item.get("Text"):
                results.append({
                    "title": item["Text"].split(" - ")[0][:80],
                    "link": item["FirstURL"],
                    "snippet": item["Text"][:150]
                })
        return results

    except Exception as e:
        print(f"[Scraper] DuckDuckGo instant-answer API failed: {e}")
        return []

def _duckduckgo_html_search(query: str, max_results: int = 5) -> list:
    """Last-resort: scrape DuckDuckGo's HTML results page. Not reliable
    on its own since DuckDuckGo may serve a bot-detection challenge page
    instead of results -- kept as a fallback behind the API methods."""
    try:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            page = resp.read().decode('utf-8', errors='ignore')

        parser = DDGResultParser()
        parser.feed(page)

        results = []
        for r in parser.results[:max_results]:
            link = r["link"]
            if 'uddg=' in link:
                try:
                    link = urllib.parse.unquote(link.split('uddg=')[1].split('&')[0])
                except Exception:
                    pass
            if link.startswith('//'):
                link = 'https:' + link
            if not link.startswith('http'):
                continue

            results.append({
                "title": html.unescape(r["title"]).strip()[:80],
                "link": link,
                "snippet": html.unescape(r["snippet"]).strip()[:150]
            })

        return results

    except Exception as e:
        print(f"[Scraper] DuckDuckGo HTML search failed: {e}")
        return []

def scrape_url(url: str) -> str:
    """Fetch and extract text from a URL with timeout"""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            page = resp.read().decode('utf-8', errors='ignore')

        # Extract text
        parser = SimpleHTMLTextExtractor()
        parser.feed(page)
        return parser.get_text()

    except urllib.error.URLError as e:
        return f"Error accessing {url}: {str(e)[:100]}"
    except Exception as e:
        return f"Error scraping {url}: {str(e)[:100]}"

_LEADING_FILLERS = (
    r'^i\s+want\s+to\s*do?\s+',
    r'^i\s+want\s+todo\s+',
    r'^i\s+would\s+like\s+to\s+',
    r'^i\s+need\s+to\s+',
    r'^can\s+you\s+',
    r'^could\s+you\s+',
    r'^please\s+',
)
_LEADING_VERB = r'^(search|scrape|lookup|look\s+up|research|find|investigate|google)\s+(for\s+|on\s+)?'
_TRAILING_FILLER = r'\s+(on|via|at|from)\s+(the\s+|a\s+)?(web|internet|online)\.?$'

def _extract_query(message: str) -> str:
    """Strip conversational scaffolding ("I want to research X on the
    web") down to the actual search topic. The old code only stripped a
    single leading trigger word, so a natural sentence like that was sent
    to the search engine verbatim -- an unnatural query that returns
    fewer (or zero) results."""
    query = message.strip().lower()
    query = re.sub(r'[!?.]+$', '', query)

    changed = True
    while changed:
        changed = False
        for pattern in _LEADING_FILLERS:
            new_query = re.sub(pattern, '', query)
            if new_query != query:
                query = new_query
                changed = True
        new_query = re.sub(_LEADING_VERB, '', query)
        if new_query != query:
            query = new_query
            changed = True

    query = re.sub(_TRAILING_FILLER, '', query).strip()
    query = re.sub(r'^(a|an|the)\s+', '', query).strip()
    return query or message.strip()

def process_scrape_request(message: str) -> dict:
    """Process a scrape/search request"""
    try:
        query = _extract_query(message)

        if not query or len(query) < 3:
            return {
                "spoken": "I need a clearer search query. What would you like me to research?",
                "status": "error",
                "results": []
            }

        # Check if it's a direct URL
        if query.startswith('http'):
            text = scrape_url(query)
            return {
                "spoken": f"I've accessed {query[:50]}. Here's what I found: {text[:200]}...",
                "status": "success",
                "url": query,
                "content": text,
                "results": [{"title": "Direct URL", "link": query, "snippet": text[:150]}]
            }

        # Perform web search
        results = search_duckduckgo(query, max_results=5)

        if not results:
            return {
                "spoken": f"I couldn't find results for '{query}'. Try a different search term.",
                "status": "no_results",
                "results": []
            }

        # Format response
        summary = f"I found {len(results)} results for '{query}':\n"
        for i, result in enumerate(results[:3], 1):
            summary += f"\n{i}. {result['title']}\n   {result['snippet']}"

        return {
            "spoken": summary,
            "status": "success",
            "query": query,
            "results": results,
            "web_scraper_results": True
        }

    except Exception as e:
        return {
            "spoken": f"Search failed: {str(e)[:100]}",
            "status": "error",
            "results": []
        }

def _fallback_results(query: str) -> list:
    """Return helpful fallback results when search fails"""
    return [
        {
            "title": "Live Search Unavailable",
            "link": "#",
            "snippet": f"No results for '{query}' from any free source (DuckDuckGo blocked the automated request, and Wikipedia had no matching article) -- this isn't a connectivity issue. Try rephrasing, or a more specific/well-known topic."
        },
        {
            "title": "Try Again",
            "link": "#",
            "snippet": "Please try your search again in a moment."
        }
    ]
