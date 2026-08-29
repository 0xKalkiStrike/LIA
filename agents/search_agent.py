"""Search Agent — reliable web searching with multiple fallbacks"""
import urllib.request
import urllib.parse
import urllib.error
import json
import re
import time

def web_search(query: str, num_results: int = 5) -> list[dict]:
    """Web search with fallback methods"""

    # Try multiple search methods in order
    results = []

    # Method 1: DuckDuckGo API JSON
    results = _duckduckgo_api_search(query, num_results)
    if results and len(results) >= 2:
        return results[:num_results]

    # Method 2: Google Search API via searx.be (fallback)
    results = _searx_search(query, num_results)
    if results and len(results) >= 2:
        return results[:num_results]

    # Method 3: Simple DDG HTML parsing (last resort)
    results = _duckduckgo_html_search(query, num_results)
    if results:
        return results[:num_results]

    # Fallback: Return mock results if offline
    return _mock_results(query)

def _duckduckgo_api_search(query: str, num_results: int = 5) -> list[dict]:
    """Search using DuckDuckGo API endpoint"""
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&kl=us-en"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        results = []

        # Get results from RelatedTopics
        if 'RelatedTopics' in data:
            for item in data['RelatedTopics'][:num_results]:
                if 'FirstURL' in item:
                    results.append({
                        "title": item.get('Text', '').split(' - ')[0][:100],
                        "link": item.get('FirstURL', ''),
                        "snippet": item.get('Text', '')[:150]
                    })

        return results
    except Exception as e:
        print(f"[Search] DDG API failed: {e}")
        return []

def _searx_search(query: str, num_results: int = 5) -> list[dict]:
    """Search using public Searx instances"""
    searx_instances = [
        "https://searx.be/search",
        "https://search.privacyguide.org/search",
    ]

    for instance in searx_instances:
        try:
            url = f"{instance}?q={urllib.parse.quote(query)}&format=json"

            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )

            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            results = []

            if 'results' in data:
                for item in data['results'][:num_results]:
                    results.append({
                        "title": item.get('title', '')[:100],
                        "link": item.get('url', ''),
                        "snippet": item.get('content', '')[:150]
                    })

            if results:
                return results

        except Exception as e:
            print(f"[Search] Searx instance failed: {e}")
            continue

    return []

def _duckduckgo_html_search(query: str, num_results: int = 5) -> list[dict]:
    """Fallback: Parse DuckDuckGo HTML directly"""
    try:
        url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote_plus(query)

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")

        # Parse search results
        result_blocks = re.findall(r'<div class="result[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)

        results = []
        for block in result_blocks[:num_results]:
            # Extract link
            link_match = re.search(r'<a[^>]+href="([^"]+)"[^>]*>([^<]+)</a>', block)
            if not link_match:
                continue

            url_raw = link_match.group(1)
            title = link_match.group(2).strip()

            # Extract snippet
            snippet_match = re.search(r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', block)
            snippet = snippet_match.group(1).strip() if snippet_match else ""

            # Clean HTML
            snippet = re.sub(r'<[^>]+>', '', snippet)
            snippet = snippet.replace('&amp;', '&').replace('&quot;', '"').replace('&#x27;', "'")
            snippet = snippet[:150]

            # Fix URL if needed
            if 'uddg=' in url_raw:
                try:
                    url_raw = urllib.parse.unquote(url_raw.split('uddg=')[1].split('&')[0])
                except:
                    pass

            if url_raw.startswith('//'):
                url_raw = 'https:' + url_raw

            if url_raw.startswith('http'):
                results.append({
                    "title": title[:100],
                    "link": url_raw,
                    "snippet": snippet
                })

        return results

    except Exception as e:
        print(f"[Search] HTML parse failed: {e}")
        return []

def _mock_results(query: str) -> list[dict]:
    """Return mock results when offline"""
    keywords = query.lower().split()

    mock_db = {
        'python': [
            {"title": "Python Official Docs", "link": "https://python.org/docs", "snippet": "Official Python documentation and tutorials"},
            {"title": "Python Programming", "link": "https://python.org", "snippet": "The official Python website"},
        ],
        'javascript': [
            {"title": "JavaScript MDN", "link": "https://developer.mozilla.org/en-US/docs/Web/JavaScript", "snippet": "Complete JavaScript documentation"},
            {"title": "JavaScript.com", "link": "https://javascript.com", "snippet": "Learn JavaScript online"},
        ],
        'research': [
            {"title": "Google Scholar", "link": "https://scholar.google.com", "snippet": "Search academic papers and research"},
            {"title": "ResearchGate", "link": "https://researchgate.net", "snippet": "Share and discover research"},
        ],
        'darkweb': [
            {"title": "Darkweb Safety Guide", "link": "#", "snippet": "Guide to browsing the darkweb safely with Tor"},
            {"title": "Tor Project", "link": "https://torproject.org", "snippet": "Anonymous communication software"},
        ]
    }

    results = []
    for keyword in keywords:
        if keyword in mock_db:
            results.extend(mock_db[keyword])

    if not results:
        results = [
            {"title": "Search Results", "link": "#", "snippet": f"Searching for: {query}. System is in offline mode. Connect to internet for live results."},
            {"title": "Try Again", "link": "#", "snippet": "Check your connection and try your search again"},
        ]

    return results[:5]

_DARKWEB_UNAVAILABLE_FALLBACK = [
    {
        "title": "⚠️ Tor Proxy Unreachable",
        "link": "#",
        "snippet": "Live onion-index search needs a local Tor daemon (SOCKS5 on 127.0.0.1:9050 by default -- "
                   "install from torproject.org and run `tor`, or set tor_socks_host/tor_socks_port "
                   "in config/settings.json for a remote proxy)."
    },
    {
        "title": "⚠️ Safety Warning",
        "link": "#",
        "snippet": "The darkweb contains illegal content. Only access with proper security setup and legal awareness."
    }
]


def darkweb_search(query: str, num_results: int = 3) -> list[dict]:
    """Real onion-index search via Ahmia, routed through Tor
    (agents.web_intel.tor_net). Falls back to static setup guidance only if
    the Tor proxy is actually unreachable."""
    import asyncio
    from agents.web_intel import tor_net

    try:
        results = asyncio.run(tor_net.search_ahmia(query, max_results=num_results))
    except Exception as e:
        print(f"[Search] Tor darkweb search failed: {e}")
        results = []

    if results:
        return results
    return _DARKWEB_UNAVAILABLE_FALLBACK

def looks_like_search_request(message: str) -> bool:
    """Check if message is a search request"""
    keywords = [
        'search', 'google', 'find', 'look up', 'research',
        'web search', 'dark web', 'darkweb', 'investigate',
        'lookup', 'how to', 'what is', 'why', 'where'
    ]
    return any(kw in message.lower() for kw in keywords)
