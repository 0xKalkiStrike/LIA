# LIA Animation Demo Guide

**App is now running at:** `http://localhost:3000`

## What You'll See

### 1. **Login Screen (First Page)**
- 3D character avatar on the left side (smaller now - fixed scaling!)
- Registration form on the right
- Character should be animating in the background (breathing, blinking, subtle movements)

### 2. **Log In**
- Use any username and secret word (the system will create a new profile)
- Click "Initialize & Launch LIA"

### 3. **Main Chat Dashboard**
- Character pod on the **left** (now properly sized at 100% zoom)
- Chat interface in the **center**
- Sensory stream on the **right**

## Animation Features to Look For

### **Idle/Resting State** (before you type)
✨ **You should see:**
- ✓ **Breathing**: Character's chest rises and falls smoothly (emotion-responsive rate)
- ✓ **Blinking**: Eyes close and open naturally at varying intervals
- ✓ **Eye Look-Around**: Eyes glance around gently (not just staring forward)
- ✓ **Head Tilts**: Subtle head movements side-to-side
- ✓ **Occasional Head Nods**: Random affirmation nods (listening behavior)
- ✓ **Body Sway**: Very subtle weight shifts and micro-movements
- ✓ **Arm Positioning**: Arms in relaxed pose, slight sway

### **Speaking State** (after you send a message)
✨ **You should see:**
- ✓ **Mouth Animation (Lip Sync)**: Mouth cycles through different shapes as LIA speaks
  - Wide open (AA sound)
  - Spread lips (EE sound)
  - Rounded (OH sound)
  - And more intermediate shapes!
- ✓ **Hand Gestures**: Arms animate with natural talking gestures
  - Hands open and close
  - Arms raise for emphasis
  - Natural hand curls during speech
- ✓ **Breathing Changes**: Faster, deeper breathing while speaking
- ✓ **Head Movement**: More animated head turns while talking
- ✓ **Shoulder Movement**: Shoulders lift and relax (emotion-based tension)
- ✓ **Dynamic Smile**: Character smiles more while talking

### **Emotion-Driven Changes**
The backend automatically detects emotion in LIA's responses. Try these:

**Excited/Happy responses:**
- Wider mouth shapes (mouth opens more)
- Eye squinting (Duchenne smile)
- More energetic gestures
- Faster breathing
- More body sway

**Thinking/Contemplative:**
- Slower blinking
- Head tilts larger
- Hand gestures slower
- Deeper breathing

**Nervous/Surprised:**
- More frequent blinking (1.5x normal rate)
- Raised shoulders
- Faster, shallower breathing

**Focused/Determined:**
- Fewer blinks (concentrated stare)
- Steady posture
- Precise hand movements

## Test Commands to Try

1. **"I love this!"** → Should show excited, happy emotion
   - Watch for: Big smile, eye squint, energetic gestures

2. **"Let me think about that"** → Should show thinking emotion
   - Watch for: Slower movements, larger head tilts

3. **"That surprised me!"** → Should show surprised emotion
   - Watch for: More blinking, raised shoulders

4. **"Let me focus on this task"** → Should show focused emotion
   - Watch for: Fewer blinks, steady hands

## Technical Details

### Files Modified
- `frontend/src/components/ThreeCanvas.tsx` - Main animation engine
  - 1000+ lines of Three.js animation code
  - VRM bone manipulation for 20+ joints
  - Emotion-driven parameters
  - Viseme cycling for lip sync

### Animation Features Code
- **10+ Viseme Positions**: Phoneme-based lip shapes
- **Emotion-Driven Gesture Library**: 3 gesture types with 2-4 poses each
- **Breathing**: Rate/depth vary by emotion (±30%)
- **Eye Animation**: Blink frequency, squinting, look-around
- **Head Movement**: Nodding, tilting, emotion-responsive
- **Shoulder Tension**: Emotion-based muscle simulation
- **Hand Gestures**: Dual-arm coordination with finger micromotion

### Performance
- **60 FPS** with minimal overhead
- Uses Three.js `requestAnimationFrame`
- Efficient bone updates per frame
- No expensive DOM mutations

## Common Questions

**Q: Why does the character look different than before?**
A: The animations have been significantly enhanced. All bones (arms, head, spine, shoulders, hips) now have continuous subtle movements based on emotion and activity state.

**Q: The mouth movements are too fast/slow?**
A: This is by design - viseme timing is based on phoneme frequency. English speech naturally has varied timing between sounds.

**Q: Why does the character blink more when nervous?**
A: This mimics human behavior - nervous people tend to blink more frequently as a stress response.

**Q: Can I customize the animation speeds?**
A: Currently the speeds are emotion-tuned. They can be adjusted in `ThreeCanvas.tsx` lines 518-529 (breath rate/depth modifiers).

## Next Steps

1. Open `http://localhost:3000` in your browser
2. Log in with any credentials
3. Send a chat message
4. Watch the character animate!
5. Try different messages to see emotion-based changes

---

**Enjoy the enhanced LIA animations! 🎬✨**
