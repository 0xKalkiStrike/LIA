# 🎤 Install Piper TTS for Natural Voice (Optional but Recommended)

## What is Piper TTS?

Piper is a **local text-to-speech engine** that:
- ✅ Runs completely offline (no cloud required)
- ✅ Uses neural network voice models (human-like)
- ✅ ZERO latency - instant speech synthesis
- ✅ Best quality voice for JARVIS AI
- ✅ Free and open-source

## Why Install Piper?

| Aspect | Browser Voice | Piper TTS |
|--------|--------------|-----------|
| Quality | Good | ⭐⭐⭐ Excellent |
| Naturalness | Okay | ⭐⭐⭐ Very Natural |
| Latency | ~500ms | ~100ms |
| Offline | No | ✅ Yes |
| Sound | Synthetic | Human-like |

---

## Installation Steps

### Step 1: Install Piper Python Package

```bash
pip install piper-tts
```

Or with pip3 if pip doesn't work:
```bash
pip3 install piper-tts
```

**Expected output:**
```
Successfully installed piper-tts-1.2.0
```

### Step 2: Download Voice Model (One-Time)

Run this Python script to download the best natural voice:

```python
# Run this in PowerShell or terminal:
python -c "
from agents.voice_agent import install_piper
result = install_piper()
print('\\n'.join(result.get('steps', [])))
if result['ok']:
    print('\\n✅ Piper TTS is ready!')
else:
    print('\\n⚠️  Some issues, but system will auto-fallback')
"
```

**What it does:**
- Downloads voice model (~150-500MB)
- Installs automatically
- Takes 2-5 minutes first time
- Subsequent runs are instant

**Expected output:**
```
✓ piper-tts installed
✓ Downloaded en_US-jenny-medium (natural voice)

✅ Piper TTS is ready!
```

### Step 3: Start JARVIS AI

```bash
python run.py
```

**Check if Piper is active:**
1. Open browser: http://127.0.0.1:8000
2. Chat with JARVIS
3. Listen for voice - should sound **warm, natural, friendly** (NOT robotic)

---

## Voices Available

Piper offers multiple voices. The recommended voice is:

### 🌟 Best Choice: `en_US-jenny-medium`
- **Quality**: Excellent
- **Tone**: Warm, friendly, natural
- **Speed**: Clear and easy to understand
- **Size**: ~130MB

### 🎯 Alternative Voices

If you want to try others, edit `agents/voice_agent.py`:

```python
# Line ~45, change this:
default_voice = "en_US-jenny-medium"

# To one of these:
default_voice = "en_US-libritts-high"      # Clear and clean
default_voice = "en_US-kusal-medium"       # Professional
default_voice = "en_US-norman-medium"      # Deeper voice
```

Then reinstall:
```bash
rm -r data/piper_voices/*  # Clear old voice
python -c "from agents.voice_agent import install_piper; install_piper()"
```

---

## Verification

### ✅ Piper is working if:
- [ ] Voice is warm and natural-sounding
- [ ] No robotic/synthetic quality
- [ ] Speech is clear and articulate
- [ ] Response is fast (<1 second)
- [ ] Console shows: "✓ Piper TTS loaded"

### ❌ If Piper isn't working:
- [ ] Browser still uses system voice (okay, but less natural)
- [ ] Check console (F12) for error messages
- [ ] Verify pip install succeeded
- [ ] Check disk space (need 500MB+)

---

## Troubleshooting

### Issue: "Module not found: piper"
**Solution:**
```bash
pip install --upgrade piper-tts
# or
pip3 install --upgrade piper-tts
```

### Issue: Voice file download failed
**Solution:**
1. Check internet connection
2. Try again: `python -c "from agents.voice_agent import install_piper; install_piper()"`
3. Manual download: Visit https://huggingface.co/rhasspy/piper-voices/

### Issue: Piper installed but not being used
**Solution:**
1. Restart server: `python run.py`
2. Restart browser: Close and reopen
3. Check browser console (F12) for errors

### Issue: Voice is still slow/robotic
**Solution:**
1. Clear browser cache: Ctrl+Shift+Delete
2. Check that neural voice is selected
3. Verify Piper installed: `pip show piper-tts`

---

## Advanced Configuration

### Custom Voice Speed

In `agents/voice_agent.py`, adjust speaking rate:

```python
# Line ~60, after voice loads, add:
piper.speed = 1.0   # 0.8 = slower, 1.2 = faster
```

### Use Different Voice

Piper supports 10+ languages. To use French:

```python
default_voice = "fr_FR-mls-medium"
```

See all available: https://github.com/rhasspy/piper

---

## Performance Impact

| Operation | Time | CPU | Disk |
|-----------|------|-----|------|
| Installation | 2-5 min | <10% | 500MB |
| Voice download | 1-2 min | <5% | 100-150MB |
| Per speech | <100ms | 10-15% | None |

---

## System Requirements

- **Python**: 3.7+
- **Disk**: 500MB free (for voice model)
- **RAM**: 2GB+ (for running voice)
- **CPU**: Any modern processor
- **Internet**: Required only for download (offline after that)

---

## Fallback Behavior

If Piper fails to install or activate:

✅ **System automatically falls back to browser voices**
- Still natural sounding (if neural voices available)
- Slightly slower (~500ms latency)
- Cloud-dependent if system voice is online

---

## Next Steps

1. **Install Piper**: Follow installation steps above
2. **Download Voice**: Run the install script
3. **Restart JARVIS**: `python run.py`
4. **Enjoy**: Natural human-like voice! 🎤

---

## Optional: Remove Piper (If Not Wanted)

```bash
# Uninstall Python package:
pip uninstall piper-tts

# Remove voice files:
rm -r C:\hacker\LIA\data\piper_voices

# System will use browser voice automatically
```

---

## Questions?

- **Installation help**: See error message in console
- **Voice quality**: Try different model (see Voices section)
- **Performance**: Reduce speech length or use smaller model

---

**Status**: Optional but recommended for best experience  
**Quality Gain**: 🌟🌟🌟 Major improvement  
**Difficulty**: ⭐ Very easy - just one command  

Ready? Run: `pip install piper-tts`

Then: `python -c "from agents.voice_agent import install_piper; install_piper()"`

Then: `python run.py` and enjoy! 🚀
