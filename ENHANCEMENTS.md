# LIA AI — Enhancements Guide

## 🚀 What's New

Your LIA AI system has been enhanced with better search, context awareness, and response quality. Here's what changed:

### 1. **Enhanced Search System** (`agents/enhanced_search.py`)

**Features:**
- ✅ DuckDuckGo search integration (privacy-focused)
- ✅ Context-aware search routing
- ✅ Keyword extraction for better results
- ✅ Result analysis and summarization
- ✅ Academic/research mode
- ✅ Web content scraping

**How It Works:**
```python
# When you search for "Research on Darkweb"
# System detects: academic intent + darkweb context
# Automatically routes to: research-mode search
# Returns: academic results + analysis + keywords
```

**Supported Search Types:**
1. **General** - Standard web search
2. **Research** - Academic/detailed results
3. **Recent** - Latest news/updates
4. **Darkweb** - Tor network (with safety warnings)

### 2. **Enhanced Prompts** (`agents/enhanced_prompts.py`)

**Features:**
- ✅ Dynamic system prompts based on user profile
- ✅ Personality adaptation (Jarvis, Friday, Nova, Sage)
- ✅ Preference learning from memories
- ✅ Domain-specific prompts (coding, data, writing, research)
- ✅ Better context understanding

**How It Works:**
```
User Profile → Extract Preferences → Build Custom Prompt → Better Responses
```

**Personality Modes:**
- **Jarvis Classic** - Professional, British-style, sophisticated
- **Friday** - Friendly, enthusiastic, warm
- **Nova** - Energetic, dynamic, creative
- **Sage** - Wise, thoughtful, philosophical

### 3. **Better Search Query Handling**

**Improved Patterns:**
```
"I want to do Research on Darkweb"
→ Detects: research intent + darkweb + academic context
→ Routes: enhanced_search.intelligent_search()
→ Returns: analyzed results + keywords + summary
```

### 4. **Ollama Model Integration**

LIA now better leverages your Ollama models:

```bash
# Check available models
ollama list

# Use specific model
# Set in config/settings.json:
{
  "ollama_model": "mistral",      # or llama3.2, neural-chat, etc
  "ollama_url": "http://localhost:11434"
}
```

**Recommended Models:**
- **llama3.2** (8B) - Best all-around
- **mistral** (7B) - Fast and capable
- **neural-chat** (7B) - Chat optimized
- **dolphin-mixtral** (8x7B) - Very powerful
- **openchat** (3.5B) - Lightweight

### 5. **Context Window Management**

The system now maintains better context:

1. **Memory Recall** - Automatically recalls relevant past conversations
2. **Preference Learning** - Learns your style from saved memories
3. **Smart Summarization** - Keeps long conversations concise
4. **Token Optimization** - Fits more context in the same window

## 📊 How to Use Enhancements

### Example 1: Smart Research Query

```
You: "I want to do Research on Darkweb"

LIA Does:
1. Detects: "research" + "darkweb" → research-mode search
2. Extracts keywords: ["darkweb", "research", "dark", "web"]
3. Searches DuckDuckGo with context
4. Analyzes results for academic relevance
5. Responds with:
   - Summary of findings
   - Source credibility assessment
   - Key takeaways
   - Recommended further reading
```

### Example 2: Technical Help (Coding)

```
You: "I prefer Python. Help me build a web scraper."

LIA Does:
1. Recalls: Python preference from past messages
2. Loads: Technical prompt + coding domain
3. Generates: Python code with explanations
4. Includes: Best practices, alternatives, testing advice
5. Learns: Updates your preference profile
```

### Example 3: Personal Sharing

```
You: "I'm feeling stressed about my project deadline"

LIA Does:
1. Detects: Personal/emotional content
2. Auto-saves to vault (keeps secure memories)
3. Responds with empathy + practical help
4. Remembers for future context
5. Doesn't share with anyone (private vault)
```

## 🔧 Configuration

### Step 1: Update Commander Agent (Optional)

To use enhanced search, modify the search routing in `api/server.py`:

```python
# In handle_message_stream or handle_message:
from agents import enhanced_search

# Instead of basic search:
# search_results = scraper_agent.web_search(query)

# Use enhanced:
# enhanced_results = enhanced_search.intelligent_search(query)
```

### Step 2: Configure Ollama Model

Edit `config/settings.json`:

```json
{
  "ollama_model": "mistral",
  "ollama_url": "http://localhost:11434",
  "ollama_timeout": 120
}
```

### Step 3: Enable Enhanced Prompts

The system automatically uses enhanced prompts when:
1. User has a profile (character customization)
2. User has saved memories (preferences)
3. User has set a voice persona

## 📈 Performance Tips

### For Better Search Results:

1. **Be Specific** - "research on machine learning applications" vs "ML"
2. **Include Context** - "research for academic paper" vs "research"
3. **Use Keywords** - The system extracts and emphasizes them
4. **Follow Up** - Ask clarifying questions for better results

### For Better AI Responses:

1. **Save Preferences** - Tell LIA about your coding language, interests
2. **Use Vault** - Save important memories LIA should remember
3. **Provide Feedback** - Correct misunderstandings so it learns
4. **Be Conversational** - Natural dialogue works better

### For Faster Performance:

1. **Use Smaller Models** - `openchat` or `neural-chat` instead of large models
2. **Set Appropriate Timeout** - `"ollama_timeout": 60` for quick responses
3. **Limit Search Results** - 5 results enough for most queries
4. **Cache Results** - System remembers recent searches

## 🎯 Best Practices

### ✅ Do This:

```
✓ "Show me recent news on AI safety research"
✓ "I'm interested in Python and data science"
✓ "Remember that I prefer concise explanations"
✓ "Search for best practices in cybersecurity"
```

### ❌ Don't Do This:

```
✗ "search" (too vague)
✗ "something about web" (unclear intent)
✗ "help me with illegal stuff" (against guidelines)
✗ "search darkweb for anything" (risky, vague)
```

## 🔐 Security & Privacy

- **JSON Database** - All data stored locally, encrypted at rest
- **DuckDuckGo** - Privacy-focused search (no tracking)
- **Vault Memories** - Secure, only accessible to you
- **No Cloud Sync** - Everything stays on your machine
- **Darkweb Warning** - Requires Tor setup, safety guidance provided

## 🐛 Troubleshooting

### Issue: "Found 0 search results"

**Solution:**
1. Check internet connection
2. Try simpler keywords
3. Verify DuckDuckGo is reachable
4. Use different search term

### Issue: "Ollama timeout"

**Solution:**
1. Check Ollama is running: `ollama serve`
2. Increase timeout in settings.json
3. Switch to smaller model
4. Check GPU/CPU load

### Issue: "AI responses are generic"

**Solution:**
1. Save more memories/preferences
2. Use more specific questions
3. Tell LIA about your interests
4. Check that vault memories are active

## 📚 Advanced Usage

### Custom Search Routing

```python
from agents import enhanced_search

# For research papers
results = enhanced_search.context_aware_search(
    "quantum computing research",
    search_type="research"
)

# For latest news
results = enhanced_search.context_aware_search(
    "AI news today",
    search_type="recent"
)
```

### Domain-Specific Assistance

```python
from agents import enhanced_prompts

# Get coding prompt
prompt = enhanced_prompts.get_technical_prompt('coding')

# Get data analysis prompt
prompt = enhanced_prompts.get_technical_prompt('data')

# Get research prompt
prompt = enhanced_prompts.get_technical_prompt('research')
```

## 📞 Support

If you encounter issues:

1. Check logs in browser console (F12)
2. Verify backend is running (`python run.py`)
3. Check Ollama status (`ollama list`)
4. Review memory vault for any errors
5. Restart backend to reset state

## 🎉 What's Next?

Planned enhancements:

- [ ] Multi-modal AI responses (voice + text + images)
- [ ] Real-time collaboration features
- [ ] Advanced data visualization
- [ ] Custom model fine-tuning
- [ ] Plugin system for extensions
- [ ] Advanced analytics dashboard
- [ ] Voice command optimization
- [ ] Mobile app sync

---

**LIA is now smarter, faster, and more personalized to you!** 🚀
