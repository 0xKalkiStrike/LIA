"""Multi-Agent Collaboration Engine.

Orchestrates debates and collaborative discussions between specialized AI roles
(Software Engineer, Researcher, Designer, Security Analyst, Business Analyst, etc.)
to solve complex user requests step-by-step.
"""
import json
from core.config import load, setting
from agents.commander import _ollama_chat, _gemini_chat

ROLES = {
    "software_engineer": {
        "title": "Software Engineer",
        "emoji": "💻",
        "system": "You are LIA's Senior Software Engineer. Focus on planning system architectures, designing databases, writing clean code (SOLID, modular), and explaining technical mechanics. Keep comments actionable and constructive."
    },
    "researcher": {
        "title": "Researcher",
        "emoji": "🔍",
        "system": "You are LIA's Lead Researcher. Focus on gathering facts, conducting searches, summarizing articles, analyzing trends, and bringing objective, verified data to the discussion. Avoid assumptions."
    },
    "designer": {
        "title": "Designer",
        "emoji": "🎨",
        "system": "You are LIA's UI/UX Designer. Focus on frontend aesthetics, user experience, responsiveness, layout flow, Tailwind CSS style tokens, typography, and clean interactions. Ensure design is premium and polished."
    },
    "security_analyst": {
        "title": "Security Analyst",
        "emoji": "🛡️",
        "system": "You are LIA's Cybersecurity Analyst. Focus on vulnerability auditing, database protection, encryption standard, session security, authentication flows, privacy compliance, and threat mitigation."
    },
    "business_analyst": {
        "title": "Business Analyst",
        "emoji": "📊",
        "system": "You are LIA's Business Analyst. Focus on product monetization, value propositions, market sizing, cost optimization, operational metrics, and growth planning."
    },
    "data_scientist": {
        "title": "Data Scientist",
        "emoji": "🧪",
        "system": "You are LIA's Data Scientist. Focus on model parameters, pipeline performance, statistics, data cleansing, and mapping analytics dashboard widgets."
    },
    "marketing_expert": {
        "title": "Marketing Expert",
        "emoji": "📣",
        "system": "You are LIA's Marketing Expert. Focus on user acquisition channels, copy drafting, target demographics, SEO optimization, and visual messaging."
    }
}

def determine_agents(prompt: str) -> list[str]:
    """Choose the best 3 collaborating agents for the user's prompt."""
    low = prompt.lower()
    selected = ["researcher"] # researcher is always present to gather context
    
    if any(w in low for w in ("code", "build", "program", "database", "sql", "api", "function", "javascript", "python", "html")):
        selected.append("software_engineer")
        if any(w in low for w in ("login", "auth", "secure", "hack", "encrypt", "password")):
            selected.append("security_analyst")
        else:
            selected.append("designer")
            
    elif any(w in low for w in ("ui", "ux", "style", "css", "color", "layout", "button", "screen")):
        selected.append("designer")
        selected.append("software_engineer")
        
    elif any(w in low for w in ("security", "vulnerability", "hack", "auth", "crypto", "token", "privacy")):
        selected.append("security_analyst")
        selected.append("software_engineer")
        
    elif any(w in low for w in ("business", "price", "market", "revenue", "strategy", "competitor")):
        selected.append("business_analyst")
        selected.append("marketing_expert")
        
    elif any(w in low for w in ("chart", "graph", "metric", "predict", "model", "analysis", "data", "excel")):
        selected.append("data_scientist")
        selected.append("business_analyst")
        
    else:
        # Default technical fallback
        selected.extend(["software_engineer", "designer"])
        
    return selected[:3]

def run_collaboration(user_id: str, prompt: str):
    """Run collaborative debate between selected agents.
    
    Yields dictionary states containing current speaking agent name, title, and response.
    """
    agents = determine_agents(prompt)
    history = [
        {"role": "user", "content": f"We need to collaborate on this query: '{prompt}'. Let's discuss it step-by-step."}
    ]
    
    # Run 1 turn per selected agent
    for agent_id in agents:
        role = ROLES[agent_id]
        system_prompt = role["system"] + "\nKeep your input under 4 sentences. Address the user's query and build on what previous agents mentioned."
        
        # Build messages for LLM query
        messages = [
            {"role": "system", "content": system_prompt}
        ] + history
        
        # Run chat
        reply = _ollama_chat(messages)
        if reply is None:
            reply = _gemini_chat(messages)
            
        if not reply:
            reply = "I agree we should focus on providing a secure and elegant solution for the commander."
            
        history.append({
            "role": "assistant",
            "content": f"[{role['title']}]: {reply}"
        })
        
        yield {
            "agent": agent_id,
            "title": role["title"],
            "emoji": role["emoji"],
            "content": reply
        }
