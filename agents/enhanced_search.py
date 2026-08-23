"""Enhanced Search Agent — DuckDuckGo + web scraping with better context"""
import json
import urllib.request
import urllib.parse
import re
from typing import List, Dict

def duckduckgo_search(query: str, max_results: int = 5) -> List[Dict]:
    """Search using DuckDuckGo API for better privacy and results"""
    try:
        # DuckDuckGo search
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        search_url = f"https://duckduckgo.com/api?q={urllib.parse.quote(query)}&format=json"
        req = urllib.request.Request(search_url, headers=headers)

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

        results = []

        # Process DDG results
        if 'Results' in data:
            for result in data['Results'][:max_results]:
                results.append({
                    'title': result.get('Text', ''),
                    'url': result.get('FirstURL', ''),
                    'snippet': result.get('Result', ''),
                    'source': 'duckduckgo'
                })

        return results
    except Exception as e:
        print(f"[Enhanced Search] DuckDuckGo error: {e}")
        return []

def context_aware_search(query: str, search_type: str = "general") -> Dict:
    """Perform context-aware search based on query type"""
    results = {
        'query': query,
        'search_type': search_type,
        'results': [],
        'analysis': '',
        'keywords': []
    }

    # Extract key terms for better searching
    keywords = extract_keywords(query)
    results['keywords'] = keywords

    # Route based on search type
    if search_type == "darkweb":
        results['results'] = darkweb_search(query)
        results['analysis'] = analyze_darkweb_results(results['results'])
    elif search_type == "research":
        results['results'] = duckduckgo_search(query, max_results=8)
        results['analysis'] = analyze_academic_results(results['results'])
    elif search_type == "recent":
        results['results'] = duckduckgo_search(query, max_results=5)
        results['analysis'] = extract_summary(results['results'])
    else:
        results['results'] = duckduckgo_search(query, max_results=10)
        results['analysis'] = extract_summary(results['results'])

    return results

def extract_keywords(query: str) -> List[str]:
    """Extract important keywords from query"""
    # Remove stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'was', 'are'}

    words = query.lower().split()
    keywords = [w.strip('.,?!;:') for w in words if w.lower() not in stop_words and len(w) > 2]

    return keywords

def extract_summary(results: List[Dict]) -> str:
    """Extract and synthesize summary from search results"""
    if not results:
        return "No results found."

    # Combine snippets
    summaries = []
    for i, result in enumerate(results[:3], 1):
        snippet = result.get('snippet', '')
        title = result.get('title', '')
        if snippet:
            summaries.append(f"{i}. {title}: {snippet[:150]}...")

    return "\n".join(summaries) if summaries else "Results found but unable to summarize."

def analyze_academic_results(results: List[Dict]) -> str:
    """Analyze results for academic/research context"""
    if not results:
        return "No academic results found."

    analysis = "Research Results Summary:\n"
    for result in results[:3]:
        analysis += f"• {result.get('title', 'Unknown')}\n"

    return analysis

def analyze_darkweb_results(results: List[Dict]) -> str:
    """Analyze darkweb search results with security context"""
    if not results:
        return "No darkweb results found (this is likely the safest outcome)."

    analysis = "Darkweb Search Results (Use with caution):\n"
    for result in results[:3]:
        analysis += f"• {result.get('title', 'Unknown')}\n"

    return analysis

def darkweb_search(query: str, max_results: int = 3) -> List[Dict]:
    """Simulate darkweb search (returns warning for illegal content)"""
    # For now, return empty results - real darkweb search would need Tor
    return [{
        'title': 'Darkweb Search Notice',
        'url': '#',
        'snippet': 'Darkweb search requires Tor browser and proper security setup. Use with caution.',
        'source': 'local'
    }]

def web_scrape_content(url: str) -> Dict:
    """Scrape content from a URL for deeper analysis"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')

        # Extract title
        title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
        title = title_match.group(1) if title_match else 'Unknown'

        # Extract meta description
        desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\'"]', content, re.IGNORECASE)
        description = desc_match.group(1) if desc_match else ''

        # Extract text content (simplified)
        text_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.IGNORECASE | re.DOTALL)
        if text_match:
            text = text_match.group(1)
            # Remove HTML tags
            text = re.sub(r'<[^>]+>', '', text)
            # Get first 500 chars of meaningful content
            text = ' '.join(text.split())[:500]
        else:
            text = ''

        return {
            'url': url,
            'title': title,
            'description': description,
            'content': text,
            'status': 'success'
        }
    except Exception as e:
        return {
            'url': url,
            'error': str(e),
            'status': 'failed'
        }

def intelligent_search(user_query: str) -> Dict:
    """Main function for intelligent searching with context"""

    # Detect search intent
    query_lower = user_query.lower()

    if any(word in query_lower for word in ['research', 'academic', 'study', 'learn', 'scientific']):
        search_type = 'research'
    elif any(word in query_lower for word in ['dark web', 'darkweb', 'onion', 'tor']):
        search_type = 'darkweb'
    elif any(word in query_lower for word in ['latest', 'recent', 'new', 'today', 'news']):
        search_type = 'recent'
    else:
        search_type = 'general'

    # Perform context-aware search
    results = context_aware_search(user_query, search_type)

    # If minimal results, try alternative search
    if not results['results'] or len(results['results']) < 3:
        alt_results = duckduckgo_search(user_query, max_results=5)
        results['results'].extend(alt_results)

    return results
