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
