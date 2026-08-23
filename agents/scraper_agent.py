"""Scraper Agent — robust web scraping with timeouts and fallbacks"""
import json
import re
import urllib.parse
import urllib.request
import urllib.error
import threading
import time
from html.parser import HTMLParser

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
    """Search DuckDuckGo with timeout protection"""
    try:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        results = []

        # Parse DDG results
        result_blocks = re.findall(
            r'<div[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)</div>',
            html,
            re.DOTALL
        )

        for block in result_blocks[:max_results]:
            # Extract title and link
            link_match = re.search(r'<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>', block)
            if not link_match:
                continue

            raw_link = link_match.group(1)
            title = link_match.group(2).strip()

            # Extract snippet
            snippet_match = re.search(r'<a[^>]*class="result__snippet[^"]*"[^>]*>(.*?)</a>', block)
            snippet = snippet_match.group(1).strip() if snippet_match else ""

            # Clean HTML from snippet
            snippet = re.sub(r'<[^>]+>', '', snippet)
            snippet = snippet.replace('&amp;', '&').replace('&quot;', '"')[:150]

            # Decode URL
            try:
                if 'uddg=' in raw_link:
                    raw_link = urllib.parse.unquote(raw_link.split('uddg=')[1].split('&')[0])
            except:
                pass

            if raw_link.startswith('//'):
                raw_link = 'https:' + raw_link

            if raw_link.startswith('http'):
                results.append({
                    "title": title[:80],
                    "link": raw_link,
                    "snippet": snippet
                })

        return results if results else _fallback_results(query)

    except Exception as e:
        print(f"[Scraper] DuckDuckGo search failed: {e}")
        return _fallback_results(query)

def scrape_url(url: str) -> str:
    """Fetch and extract text from a URL with timeout"""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        # Extract text
        parser = SimpleHTMLTextExtractor()
        parser.feed(html)
        return parser.get_text()

    except urllib.error.URLError as e:
        return f"Error accessing {url}: {str(e)[:100]}"
    except Exception as e:
        return f"Error scraping {url}: {str(e)[:100]}"

def process_scrape_request(message: str) -> dict:
    """Process a scrape/search request"""
    try:
        # Extract search query
        query = message.lower()
        query = re.sub(r'^(search|scrape|lookup|research)\s+', '', query)
        query = re.sub(r'\s+(on|via|at|from)\s+(the\s+)?(web|internet|online)$', '', query)
        query = query.strip()

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
            "title": "Search Unavailable",
            "link": "#",
            "snippet": f"Live search for '{query}' is temporarily unavailable. Check your internet connection."
        },
        {
            "title": "Try Again",
            "link": "#",
            "snippet": "Please try your search again in a moment."
        }
    ]
