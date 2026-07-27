"""Search Agent — performs offline-friendly DuckDuckGo web searches.

Provides Google-like capability for JARVIS by scraping search results.
"""
import urllib.request
import urllib.parse
import re

def web_search(query: str, num_results: int = 5) -> list[dict]:
    """Execute a DuckDuckGo HTML search and return parsed results."""
    try:
        url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote_plus(query)
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        # Timeout at 8 seconds so the agent stays responsive
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8")
        
        # Matches link tag and content inside results
        matches = re.findall(
            r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
            html,
            re.DOTALL
        )
        
        # Matches result snippet content
        snippets = re.findall(
            r'<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>',
            html,
            re.DOTALL
        )
        
        def clean_html(text):
            text = re.sub(r'<[^>]+>', '', text)
            text = text.replace('&amp;', '&').replace('&quot;', '"').replace('&#x27;', "'").replace('&lt;', '<').replace('&gt;', '>')
            return text.strip()
            
        results = []
        for i in range(min(len(matches), len(snippets), num_results)):
            href, title_html = matches[i]
            snippet_html = snippets[i]
            
            # Extract real URL from the ddg redirect link if present
            real_url = href
            if "uddg=" in href:
                try:
                    real_url = href.split("uddg=")[1].split("&")[0]
                    real_url = urllib.parse.unquote(real_url)
                except Exception:
                    pass
            
            if real_url.startswith("//"):
                real_url = "https:" + real_url
                
            results.append({
                "title": clean_html(title_html),
                "link": real_url,
                "snippet": clean_html(snippet_html)
            })
        return results
    except Exception as e:
        # Silently log errors
        print(f"[SearchAgent] failed to query: {e}")
        return []


def ahmia_search(query: str, num_results: int = 5) -> list[dict]:
    """Search Ahmia.fi using homepage challenge bypass."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        # Step 1: Fetch home page to get dynamic challenge key
        req_home = urllib.request.Request("https://ahmia.fi/", headers=headers)
        with urllib.request.urlopen(req_home, timeout=5) as resp:
            home_html = resp.read().decode("utf-8")
        
        match = re.search(r'<input type="hidden" name="([^"]+)" value="([^"]+)">', home_html)
        params = {"q": query}
        if match:
            params[match.group(1)] = match.group(2)
            
        url = "https://ahmia.fi/search/?" + urllib.parse.urlencode(params)
        req_search = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req_search, timeout=8) as resp:
            html = resp.read().decode("utf-8")
            
        # Parse results
        matches = re.findall(
            r'<li class="result">.*?<h4>\s*<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>\s*</h4>\s*<p>(.*?)</p>',
            html,
            re.DOTALL
        )
        
        def clean_html(text):
            text = re.sub(r'<[^>]+>', '', text)
            text = text.replace('&amp;', '&').replace('&quot;', '"').replace('&#x27;', "'").replace('&lt;', '<').replace('&gt;', '>')
            return text.strip()
            
        results = []
        for href, title, snippet in matches[:num_results]:
            real_url = href
            if "redirect_url=" in href:
                try:
                    parsed = urllib.parse.urlparse(href)
                    queries = urllib.parse.parse_qs(parsed.query)
                    if "redirect_url" in queries:
                        real_url = queries["redirect_url"][0]
                except Exception:
                    pass
            results.append({
                "title": clean_html(title),
                "link": real_url,
                "snippet": clean_html(snippet)
            })
        return results
    except Exception as e:
        print(f"[SearchAgent] Ahmia search failed: {e}")
        return []


def darkweb_search(query: str, num_results: int = 5) -> list[dict]:
    """Search the Dark Web via Ahmia, with clear-web Tor2web fallback scraping."""
    # Clean the dark web keywords from search query itself for better indexing
    clean_query = re.sub(r'\b(?:search\s+)?(?:the\s+)?(?:darkweb|dark\s+web|onion(?:\s+services)?)\b', '', query, flags=re.IGNORECASE).strip()
    if not clean_query:
        clean_query = query
        
    results = ahmia_search(clean_query, num_results)
    if results:
        return results
        
    # Fallback to clearweb proxy indexes
    ddg_query = f"site:onion.ly OR site:onion.pet OR site:onion.ws OR site:onion.dog OR site:onion.cab {clean_query}"
    ddg_results = web_search(ddg_query, num_results)
    
    cleaned_results = []
    for r in ddg_results:
        link = r["link"]
        cleaned_link = re.sub(r'://(?:www\.)?([\w\-]+\.onion)(?:\.ws|\.pet|\.ly|\.dog|\.cab|\.link|\.direct)\b', r'://\1', link)
        title = re.sub(r'([\w\-]+\.onion)(?:\.ws|\.pet|\.ly|\.dog|\.cab|\.link|\.direct)\b', r'\1', r["title"])
        snippet = re.sub(r'([\w\-]+\.onion)(?:\.ws|\.pet|\.ly|\.dog|\.cab|\.link|\.direct)\b', r'\1', r["snippet"])
        
        cleaned_results.append({
            "title": title,
            "link": cleaned_link,
            "snippet": snippet
        })
    return cleaned_results
