# LIA AI — Quick Start Guide

## 🚀 Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js/npm (for frontend)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Step 1: Install Python Dependencies
```bash
cd C:\hacker\LIA
pip install -r requirements.txt  # if exists
pip install fastapi uvicorn pydantic piper-tts chromadb
```

### Step 2: Optional - Install Local LLM (Recommended)
```bash
# Download Ollama from https://ollama.ai
# After installation, start Ollama server:
ollama serve

# In another terminal, download a model:
ollama pull llama3.2
# Or try: mistral, neural-chat, phi, orca-mini
```

### Step 3: Start the Server
```bash
cd C:\hacker\LIA
python run.py
```

The application will open at: **http://127.0.0.1:8000**

---

## 🎬 First Run Experience

### Onboarding (First Time Only)
1. **Choose Avatar**: Select "LIA" (recommended) or upload custom VRM
2. **Customize Character**: Pick gender, skin tone, hair, eyes, outfit
3. **Choose Voice**: Select voice persona and speaking rate
4. **Set Language**: English, Gujarati, Hindi/Hinglish
5. **Create Account**: Set username and secret word for login

### Main Dashboard
- 🗣️ **Chat Box**: Talk to your AI character
- 👁️ **Avatar**: 3D character with real-time animations
- 🎤 **Voice Input**: Click microphone to speak
- ⚙️ **Settings**: Customize character and preferences

---

## 💬 Using Your AI Character

### Basic Interactions
```
You:     "Hello LIA, how are you?"
LIA:     "Hello, Commander! All systems are running smoothly. How can I assist you today?"

You:     "What time is it?"
LIA:     "It is 2:45 PM. Would you like to do something specific?"

You:     "Tell me about Python"
LIA:     "Python is a high-level, interpreted programming language... [detailed response]"
```

### Advanced Features
- **Web Search**: "Search for latest AI news"
- **Code Writing**: "Write a Python function for Fibonacci"
- **File Operations**: "Show me workspace files"
- **System Info**: "What's my system status?"

---

## 🎭 Character Animations

Your AI character automatically animates based on:

| Trigger | Animation |
|---------|-----------|
| Greeting | Wave 👋 |
| Excited response | Celebrate 🎉 |
| Thinking | Hand-on-chin thinking pose 🤔 |
| Confused | Listening posture |
| Happy response | Friendly open arms 🤗 |
| Error message | Concerned expression |
| Long response | Dynamic talking gestures |

### Lip Sync
- Real-time mouth movement synced to speech
- Multiple viseme shapes (A, E, I, O, U, M, F)
- Smooth transitions for natural appearance

---

## 🧠 AI Knowledge Base

Your AI character has been trained on **115+ facts** covering:

✅ **Programming**: Python, JavaScript, TypeScript, Go, Rust  
✅ **AI/ML**: Neural networks, transformers, supervised learning  
✅ **Web Tech**: React, Vue, Django, FastAPI, REST APIs  
✅ **Cloud**: AWS, Google Cloud, Azure  
✅ **DevOps**: Kubernetes, Docker, CI/CD  
✅ **Security**: Encryption, OAuth, SSL/TLS  
✅ **Communication**: Active listening, empathy, feedback  
✅ **VR/AR**: VRM avatars, motion capture, lip sync  
✅ **And many more...**

---

## 🗣️ Language Support

### English (Default)
```
You: "Hello, how are you?"
LIA: "Greetings, Commander! All systems optimal."
```

### Gujarati
```
You: "Kem cho?"
LIA: "Hu badhyu chu! Tame kem chho?"
```

### Hindi/Hinglish
```
You: "Kaise ho?"
LIA: "Bilkul theek! Boliye aap kya karna chahte ho?"
```

**Language Auto-Detection**: Automatically detects and responds in your language!

---

## 📱 Troubleshooting

### Issue: Avatar not loading
**Solution**: Check browser console (F12). May be missing VRM file.
- Fall back to procedural avatar (generates 3D character)
- Upload custom VRM in onboarding

### Issue: No voice output
**Solution**: 
1. Check browser volume settings
2. Enable microphone permissions
3. Select different voice in settings
4. Browser may use built-in TTS if Piper unavailable

### Issue: Slow responses / Timeout
**Solution**:
1. Ensure Ollama is running (`ollama serve`)
2. Check internet for cloud fallback
3. Try smaller model: `ollama pull mistral` or `ollama pull phi`

### Issue: Character looks gray/desaturated
**Solution**:
1. Refresh page (F5)
2. Check graphics drivers updated
3. Try different browser
4. Disable hardware acceleration if present

### Issue: Lip sync not syncing
**Solution**:
1. Clear browser cache
2. Restart server
3. Check audio playback working
4. Try different TTS voice

---

## ⚡ Performance Tips

### Improve Responsiveness
1. **Use Local Ollama**: Faster than cloud fallback
2. **Disable Animations**: Settings → Visual → Reduce Motion
3. **Use Smaller Models**: `phi`, `mistral` instead of `llama3.2`
4. **Close Other Apps**: Free up system resources

### Faster LLM Responses
```bash
# Fast & capable model:
ollama pull mistral

# Ultra-fast lightweight model:
ollama pull neural-chat

# High-quality model (slower):
ollama pull llama2
```

### Internet-Free Mode
- All features work offline with local Ollama
- Responses limited to training data if no cloud access
- Voice synthesis works offline with Piper TTS

---

## 🔑 Environment Variables

### Optional Configuration
```bash
# For Gemini cloud fallback
set GEMINI_API_KEY=your_api_key_here

# Custom model selection
set OLLAMA_MODEL=mistral

# Custom Ollama server
set OLLAMA_URL=http://localhost:11434
```

---

## 📚 Advanced Usage

### Chat History
All conversations are automatically saved in ChromaDB for:
- Continuity across sessions
- Context awareness
- Personality consistency
- Memory-based responses

### Custom Training Data
Edit `train.json` to add your own knowledge:
```json
{
  "category": "fact",
  "content": "My specific knowledge here..."
}
```

### API Integration
FastAPI backend can be accessed via HTTP:
```bash
# Chat with AI
POST http://localhost:8000/api/chat
Body: {"message": "Hello"}

# Get greeting
GET http://localhost:8000/api/greeting

# List memories
GET http://localhost:8000/api/memories
```

---

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Ctrl+L` | Clear chat |
| `Ctrl+R` | Refresh character |
| `F1` | Help |
| `Esc` | Close dialogs |

---

## 🐛 Reporting Issues

If you encounter bugs:

1. **Check Console**: Open DevTools (F12) and look for errors
2. **Describe Issue**: What were you doing? What happened?
3. **Check IMPROVEMENTS.md**: Known issues might be documented
4. **Try Restart**: Server and browser restart often help

---

## 📖 Further Reading

- **IMPROVEMENTS.md** - Detailed technical improvements
- **agents/commander.py** - AI conversation logic
- **ui/static/anime.js** - Character animation engine
- **train.json** - Knowledge base

---

## 🎯 Quick Tips

1. **Personality**: AI personality is "JARVIS-inspired" - professional, witty, helpful
2. **Context**: AI remembers conversation history within session
3. **Emotions**: Response emotions affect character expressions
4. **Gestures**: Watch for automatic gestures during interaction
5. **Voice**: Natural-sounding TTS when Piper is available

---

## 🚀 Next Steps

1. ✅ Set up and launch application
2. ✅ Complete onboarding wizard
3. ✅ Test chat and voice features
4. ✅ Experiment with different emotions
5. ✅ Try multiple languages
6. ✅ Install Ollama for better responses
7. ✅ Explore custom settings

---

## 💡 Pro Tips

- **Pin Important Info**: Ask AI to remember things: "Remember I'm working on project X"
- **Search Web**: "Search for latest React tutorials" 
- **Get Code**: "Write Python function to sort list"
- **Ask Questions**: AI has comprehensive knowledge base
- **Control Mood**: Set character emotion for different response styles

---

**Happy chatting! 🤖✨**

For issues or improvements, refer to IMPROVEMENTS.md or modify train.json with custom knowledge.
