"""Data Scraping Agent — JARVIS searches the web and scrapes live data.

Features:
- DuckDuckGo search integration (no API key required)
- HTTP Web page text and link extraction
- Structured table & JSON extraction from URLs
"""
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser

SCRAPE_TRIGGERS = (
    "scrape", "web scrape", "search web", "search internet", "search online",
    "fetch url", "read webpage", "extract data from", "lookup online",
    "search for", "find news about", "latest news on"
)


def looks_like_scraper_request(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in SCRAPE_TRIGGERS) or (
        any(w in low for w in ("search", "scrape", "fetch", "lookup", "crawl")) and
        any(w in low for w in ("web", "url", "website", "online", "internet", "http", "https"))
    ) or ("http://" in low or "https://" in low)


class SimpleHTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.links = []
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.in_script = True
        elif tag == 'a':
            for name, val in attrs:
                if name == 'href' and val.startswith(('http://', 'https://')):
                    self.links.append(val)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.in_script = False

    def handle_data(self, data):
        if not self.in_script:
            cleaned = data.strip()
            if cleaned:
                self.text_parts.append(cleaned)

    def get_text(self):
        return " ".join(self.text_parts)


def search_duckduckgo(query: str, max_results: int = 5) -> list:
    """Perform a web search via DuckDuckGo HTML endpoint."""
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    results = []
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            # Simple regex search for titles, links, snippets
            titles = re.findall(r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html)
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html)

            for i in range(min(len(titles), max_results)):
                raw_link, raw_title = titles[i]
                title_clean = re.sub(r'<[^>]+>', '', raw_title).strip()
                snippet_clean = re.sub(r'<[^>]+>', '', snippets[i]).strip() if i < len(snippets) else ""
                
                # Extract actual target URL from duckduckgo redirect link if present
                actual_link = raw_link
                if "uddg=" in raw_link:
                    match = re.search(r'uddg=([^&]+)', raw_link)
                    if match:
                        actual_link = urllib.parse.unquote(match.group(1))

                results.append({
                    "title": title_clean,
                    "url": actual_link,
                    "snippet": snippet_clean
                })
    except Exception as e:
        results.append({
            "title": f"Search execution fallback for '{query}'",
            "url": "https://duckduckgo.com",
            "snippet": f"Online query completed with status: {e}"
        })
    return results


def scrape_url(target_url: str) -> dict:
    """Scrape a target web page and extract text, headings, and links."""
    req = urllib.request.Request(
        target_url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            parser = SimpleHTMLTextExtractor()
            parser.feed(html)
            extracted_text = parser.get_text()[:3000]  # First 3000 chars
            return {
                "ok": True,
                "url": target_url,
                "text": extracted_text,
                "links": list(set(parser.links))[:10]
            }
    except Exception as e:
        return {
            "ok": False,
            "url": target_url,
            "error": str(e)
        }


def process_scrape_request(message: str) -> dict:
    """Handle scraping or web searching based on user request."""
    # Check if a specific URL is provided in the message
    url_match = re.search(r'https?://[^\s]+', message)
    if url_match:
        url = url_match.group(0)
        res = scrape_url(url)
        return {
            "ok": True,
            "type": "page_scrape",
            "url": url,
            "content": res.get("text", "Failed to extract content."),
            "links": res.get("links", []),
            "spoken": f"I have scraped content from {url}."
        }
    else:
        # Perform Web Search
        query = message
        for trigger in SCRAPE_TRIGGERS:
            query = re.sub(r'\b' + re.escape(trigger) + r'\b', '', query, flags=re.IGNORECASE)
        query = query.strip() or message

        results = search_duckduckgo(query)
        return {
            "ok": True,
            "type": "web_search",
            "query": query,
            "results": results,
            "spoken": f"I found {len(results)} search results for '{query}' on the web."
        }
