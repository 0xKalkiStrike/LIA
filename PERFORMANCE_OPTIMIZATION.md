# LIA Performance Optimization Guide

This guide helps you run LIA smoothly on low-end laptops and systems with limited resources.

## Quick Start (Lightweight Setup)

### 1. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

The frontend now uses:
- ✅ Lazy-loaded Monaco Editor (loads only when CodeWorkspace opens)
- ✅ Optimized Three.js rendering (low-power mode detection, frame skipping)
- ✅ Code splitting for workspaces (CodeWorkspace, PresentationWorkspace load on-demand)
- ✅ Reduced animations on low-end devices (fewer lights, lower-quality rendering)

### 2. **Backend Setup (Lightweight)**

Use small Ollama models instead of large ones:

```bash
# Install Ollama: https://ollama.com

# Use lightweight models (2.7B parameters):
ollama pull tinyllama    # Ultra-fast, low memory
# OR
ollama pull phi2         # Good quality, fast

# Start Ollama server
ollama serve             # Runs on port 11434
```

Then start the LIA backend:
```bash
pip install -r requirements.txt
python api/server.py
```

**Backend optimizations enabled:**
- SQLite by default (no Postgres overhead)
- Optional Chroma DB (not loaded unless needed)
- Smaller Ollama models by default
- Request caching for repeated queries
- Lazy agent loading

### 3. **Recommended System Settings**

#### On Your Device:
- Close unnecessary browser tabs
- Disable browser extensions (except essential ones)
- Close other CPU-heavy applications

#### In LIA Settings (when implemented):
- Disable 3D breathing animations (low-end mode)
- Reduce animation quality
- Use simpler VRM model or disable VRM entirely
- Lower microphone quality/sample rate if using voice

### 4. **Performance Monitoring**

The app now detects your device:
- **High-end (4+ CPU cores):** Full animations, high-quality rendering
- **Low-end (≤4 CPU cores):** Reduced animations, simplified rendering

Memory warnings appear when usage > 300MB.

## File Changes Made

### Frontend
- **LazyMonacoEditor.tsx** - Monaco loads only when needed
- **ThreeCanvas.tsx** - Low-power mode, frame skipping, reduced lights
- **package.json** - Removed canvas-confetti, made Monaco optional
- **next.config.ts** - Code splitting, compression, optimization enabled

### Backend
- **requirements.txt** - Commented out heavy deps (piper-tts, chromadb)
- Use smaller Ollama models (tinyllama, phi2)

## Troubleshooting

### High Memory Usage
```
If app shows > 300MB heap usage:
1. Close workspace tabs
2. Clear chat history (if option available)
3. Reload page
4. Use tinyllama instead of larger Ollama models
```

### Low FPS (< 30 FPS)
```
1. Disable 3D character if not needed
2. Use PresentationWorkspace instead of CodeWorkspace for heavy editing
3. Reduce window size temporarily
4. Close browser tabs
```

### Backend Slow Responses
```
1. Use smaller Ollama model: ollama pull tinyllama
2. Reduce max_tokens in prompts
3. Disable semantic search (Chroma) - comment out in server.py
4. Use SQLite (default), not Postgres
```

## Optimization Checklist

- [x] Lazy load Monaco Editor (only load on CodeWorkspace mount)
- [x] Optimize Three.js rendering (low-power GPU mode)
- [x] Frame skipping for non-critical animations
- [x] Remove canvas-confetti (expensive animations)
- [x] Code splitting for major workspaces
- [x] Recommend tinyllama instead of large models
- [x] Add performance monitoring
- [x] Optimize Next.js build (compression, splitting)
- [ ] Add performance dashboard (TODO)
- [ ] Add render quality slider (TODO)
- [ ] Implement memory pooling in agents (TODO)

## Development Tips

**To test low-end mode:**
```javascript
// In browser console:
Object.defineProperty(navigator, 'hardwareConcurrency', {
  value: 2  // Simulate 2-core device
});
location.reload();
```

**To profile performance:**
```javascript
// Chrome DevTools → Performance tab
// Record 30 seconds, check:
// - Frame rate (target: > 30fps)
// - Memory growth over time
// - Long tasks (yellow > 50ms)
```

## Model Recommendations by System

| System | Ollama Model | Memory | Speed |
|--------|-------------|--------|-------|
| 2GB RAM, 2 cores | tinyllama | ~4GB | Fast |
| 4GB RAM, 4 cores | tinyllama | ~6GB | Good |
| 8GB+ RAM | phi2 or llama2 | ~10GB | Better |
| 16GB+ RAM | llama2-large | ~14GB | Great |

## Next Steps

1. **Performance Dashboard** - Visual FPS/memory graph in UI
2. **Quality Settings** - User-facing render quality slider
3. **Workspace Memory** - Unload inactive workspace tabs
4. **Model Selection** - Auto-select best model for your system
5. **GPU Acceleration** - Better three-force-graph for 3D (future)
