# JARVIS AI — Test Verification Guide

## Quick Start Testing

```bash
cd C:\hacker\LIA
python run.py
# Open http://127.0.0.1:8000 in Chrome or Edge
```

---

## Visual Test 1: Character Color (Black & White Issue)

### Test Steps
1. Complete onboarding (skip to character selection)
2. In the skin tone selection, try each tone:
   - ✓ **Porcelain** - should be light peach, not white-grey
   - ✓ **Fair** - should be warm beige
   - ✓ **Tan** - should be golden brown
   - ✓ **Brown** - should be rich brown
   - ✓ **Deep** - should be dark warm brown

3. In hair color selection:
   - ✓ **Black** - vibrant black, not grey
   - ✓ **Blonde** - golden yellow, not pale
   - ✓ **Pink** - vibrant magenta, not washed out
   - ✓ **Blue** - bright blue, not dull

4. In outfit selection:
   - ✓ **Arc Cyan** - bright cyan/turquoise glow
   - ✓ **Gold** - warm golden yellow
   - ✓ **Rose** - pink/magenta accent

### Expected Result ✓
All colors should be vibrant and saturated, NOT grayscale or desaturated.

**BEFORE FIX**: Everything looked black & white / grayscale
**AFTER FIX**: Colors are vivid and true to selection

---

## Visual Test 2: Character Orientation (Facing Forward)

### Test Steps
1. Create account and login
2. Look at character in the pod

### Expected Result ✓
- Character should face directly toward you
- You should see the character's **face clearly**
- Character's eyes look toward you
- Mouth is visible and moves when speaking

**BEFORE FIX**: Character's back was visible, showing hair/back of head
**AFTER FIX**: Character faces you directly

---

## Visual Test 3: Lip Sync & Animations

### Test Steps
1. Wait for greeting message to play (or speak in chat)
2. Watch the character's mouth while it speaks

### Expected Result ✓
- Mouth opens when speaking
- Mouth shapes match vowels (A, E, I, O, U)
- Mouth closes after speech ends
- Lip movements sync with audio

### Test Gestures
Say things to trigger different expressions:
- "Hi" or "Hello" → character waves
- "Great job" or "Awesome" → character celebrates (arms up)
- "What?" or "Hmm?" → character looks thinking (hand to chin)

### Expected Result ✓
- Gestures match emotional tone
- Expressions appear on face
- Hand movements are visible
- Body sways gently while idle

**BEFORE FIX**: No visible animations; character facing away meant nothing visible
**AFTER FIX**: All animations now visible because character faces you

---

## Audio Test 1: Voice Quality (Not Robotic)

### Test Steps
1. Complete login and go to Chat
2. Type: "Hello, how are you today?"
3. Click Send and listen

### Listen For ✓
- **Natural sounding speech** (not mechanical/synthesized)
- Proper **pronunciation** of words
- Natural **pauses** between words/phrases
- Appropriate **intonation** (pitch variation)
- **Emotion in voice** (happy/sad/excited sound different)

**BEFORE FIX**: Voice sounded very robotic/synthesized
**AFTER FIX**: Voice sounds more natural and expressive

### Test Emotion-Based Voice
Try these phrases and listen for voice changes:
- "I'm so excited!" → voice should sound higher, faster, energetic
- "That's sad..." → voice should sound lower, slower, somber
- "What did you say?" → voice should sound questioning/surprised

---

## Audio Test 2: Voice Selection Verification

### Test Steps
1. Go to Settings tab
2. Look at available voices (JARVIS, FRIDAY, NOVA, SAGE)
3. Click play button (▶) next to each voice

### Expected Result ✓
- Each voice should sound different:
  - **JARVIS**: Deep, calm, male voice
  - **FRIDAY**: Warm, professional, female voice
  - **NOVA**: Energetic, casual, female voice
  - **SAGE**: Soft, gentle, male voice

- Each voice should sound **natural**, not robotic

**BEFORE FIX**: All voices sounded robotic/synthetic
**AFTER FIX**: Voices sound natural and distinct

---

## Advanced Test: Piper TTS (Offline Voice)

### Prerequisites
Install Piper TTS for even better voice quality:
```bash
pip install piper-tts
```

### Test Steps
1. In Settings → Find "Install Piper Voice" button
2. Click to download voice model
3. Test voice again after installation

### Expected Result ✓
- Voice should sound **even more natural** than browser TTS
- Speech should work **fully offline**
- Same character expressions and animations apply
- Lower latency on voice responses

**BEFORE**: Using browser synthesized voice (good but not optimal)
**AFTER**: Using Piper neural voice (most natural offline option)

---

## Comprehensive Test Checklist

### ✓ Visual Rendering
- [ ] Character appears in **full color** (not grayscale)
- [ ] Character **faces forward** (not showing back)
- [ ] All facial features visible (eyes, nose, mouth)
- [ ] Hair color matches selection
- [ ] Skin tone matches selection
- [ ] Outfit accent color is vibrant

### ✓ Character Animation
- [ ] Eyes blink naturally
- [ ] Eyes track your mouse (look at you)
- [ ] Mouth moves when speaking
- [ ] Lip movements match speech sounds
- [ ] Character gestures:
  - [ ] Waves hello
  - [ ] Raises hands to celebrate
  - [ ] Hand to chin when thinking
  - [ ] Points when explaining

### ✓ Body Animation
- [ ] Character breathes (slight up/down)
- [ ] Body sways gently while idle
- [ ] Character leans forward when listening
- [ ] Posture changes with emotion

### ✓ Facial Expression
- [ ] Happy: Character smiles
- [ ] Sad: Character looks concerned
- [ ] Surprised: Character eyes widen
- [ ] Thinking: Character furrows brow
- [ ] Neutral: Relaxed face at rest

### ✓ Voice Quality
- [ ] Voice sounds **natural** (not robotic)
- [ ] Clear **pronunciation**
- [ ] Natural **speech rhythm**
- [ ] Appropriate **pauses**
- [ ] Voice has **emotion/tone**
- [ ] Different voices sound **distinct**

### ✓ Speech Synchronization
- [ ] Mouth opens when speaking starts
- [ ] Mouth closes when speaking ends
- [ ] Lip movements sync with audio
- [ ] No gaps between audio and mouth
- [ ] Gestures happen during relevant speech

### ✓ Emotion System
- [ ] Happy phrases trigger happy expression
- [ ] Sad phrases trigger sad expression
- [ ] Excited phrases trigger celebration gesture
- [ ] Thinking questions trigger thinking pose
- [ ] Voice pitch/rate changes with emotion

---

## Performance Metrics

Monitor your browser's developer console for:

### Expected Performance
- **FPS**: 50-60 frames per second (smooth animation)
- **GPU Memory**: <100MB (character rendering)
- **CPU Load**: <15% (for animation loop)

### Test in DevTools
1. Press **F12** → Performance tab
2. Record for 10 seconds of interaction
3. Check:
   - FPS stays above 30 (smoother is better)
   - No memory leaks (stable over time)
   - No dropped frames during speech

---

## Troubleshooting

### Issue: Character still appears gray/desaturated
- **Fix**: Clear browser cache (Ctrl+Shift+Delete)
- **Fix**: Try in Incognito mode
- **Fix**: Update graphics drivers
- **Fix**: Try different browser (Chrome/Edge/Firefox)

### Issue: Character still faces backward
- **Fix**: Clear browser cache completely
- **Fix**: Hard refresh (Ctrl+Shift+R)
- **Fix**: Check browser console (F12) for JS errors
- **Contact**: If issue persists, check anime.js was updated correctly

### Issue: Voice still sounds robotic
- **Fix**: Install Piper TTS (`pip install piper-tts`)
- **Fix**: Select different voice in Settings
- **Fix**: Try Chrome/Edge (better voice selection)
- **Fix**: Ensure system voices installed (Windows: Settings → Speech)

### Issue: Lip sync not working
- **Fix**: Reload page (F5)
- **Fix**: Check browser console for JavaScript errors
- **Fix**: Ensure speaker volume is not muted
- **Fix**: Try different text (shorter sentences often sync better)

### Issue: Animations not visible
- **Fix**: Make sure character is facing forward first
- **Fix**: Try speaking to character (should gesture)
- **Fix**: Clear cache and reload

---

## Browser Recommendations

### ✓ Best Experience (in order)
1. **Google Chrome** (best voice selection, full Web Audio API)
2. **Microsoft Edge** (excellent neural voices, Windows integration)
3. **Safari** (high-quality native voices)
4. **Firefox** (good voice variety)

### Requirements
- Browser must support:
  - ✓ WebGL (3D rendering)
  - ✓ Web Audio API (voice/sound)
  - ✓ Speech Synthesis API (TTS)
  - ✓ MediaDevices (microphone access)

All modern browsers (2022+) support these.

---

## Performance Tips

### Optimize for Better Performance
1. Close other browser tabs
2. Disable browser extensions (they impact audio)
3. Update graphics drivers
4. Use wired internet (not WiFi) for stability
5. Ensure system volume not at maximum

### If FPS Drops Below 30
1. Close background apps
2. Reduce browser window size
3. Lower monitor refresh rate
4. Update graphics drivers
5. Try different browser

---

## Success Criteria

### ✅ All Fixes Successfully Applied When:

1. **Character Visualization**
   - ✓ Character appears in full vibrant color
   - ✓ Character faces you directly
   - ✓ All animations visible and smooth

2. **Voice Quality**
   - ✓ Voice sounds natural and non-robotic
   - ✓ Emotion variations in voice tone
   - ✓ Distinct voice options available

3. **Animation Synchronization**
   - ✓ Lip sync matches audio
   - ✓ Gestures match speech
   - ✓ Expressions match emotion

---

## Next Steps After Verification

If all tests pass:
- ✅ Fixes are working correctly
- ✅ Character system is fully functional
- ✅ Ready for daily use

If any test fails:
- Check browser console (F12) for errors
- Try different browser
- Clear all cache and cookies
- Reinstall requirements: `pip install -r requirements.txt`
- Contact support with error messages from console

---

## Documentation

For detailed technical documentation, see:
- `FIXES_APPLIED.md` - Complete list of all changes
- `anime.js` - Character animation engine
- `app.js` - Frontend orchestration
- `voice_agent.py` - Backend TTS system
