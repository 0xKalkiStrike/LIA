# LIA Character Animation System

LIA is now fully animated and lifelike with sophisticated character expressions, lip-sync, hand gestures, and natural movements.

## 🎭 **Character Features**

### **1. Mouth & Lip-Sync**
- **Real-time lip-sync** synchronized to speech
- **8 viseme shapes** (aa, ee, ih, oh, ou, and variations)
- **Smooth transitions** between phonemes
- **Variable timing** — each viseme has natural duration
- **Mouth openness** — dynamic control based on speech intensity
- **Emotional lips** — lip shape changes with emotion (smile, pout, etc.)

### **2. Eye Animations**
- **Eye tracking** — follows mouse movement naturally
- **Natural blinking** — random interval between blinks (150-250ms)
- **Look-around** — eyes glance around when not speaking (idle behavior)
- **Gaze direction** — constrained realistic eye movement
- **Sleeping eyes** — eyes close and look down when sleeping

### **3. Facial Expressions**
- **Smile** — dynamic smiling while speaking (0-1 intensity)
- **Happy/Friendly** — happy expression with smile blend
- **Excited** — extreme smile + raised eyebrows
- **Sad/Concerned** — downturned mouth + frown
- **Angry** — furrowed brows + tightened mouth
- **Surprised** — wide eyes + open mouth
- **Thinking** — contemplative expression
- **Nervous** — subtle concern + surprise blend
- **Confident** — strong smile + relaxed eyes

### **4. Hand & Arm Gestures (6 Phases)**
1. **Open Palm** — welcoming, explaining gesture
2. **Hand Raised High** — emphasizing, pointing
3. **Relaxed Gesture** — casual pointing
4. **Hand Down** — neutral position
5. **Both Hands Together** — counting, describing
6. **Sweeping Gesture** — grand statement

Each gesture:
- Flows naturally with arms
- Varies with continuous movement
- Matches speech rhythm
- Returns to neutral when not speaking

### **5. Body Movements**
- **Breathing** — realistic chest expansion (varies by speaking/sleeping)
- **Body Sway** — subtle weight shifts (0.4s cycle)
- **Spine Tilt** — gentle bending
- **Hip Movement** — natural posture variation
- **Shoulder Shrug** — micro-movements for life-like quality
- **Head Tilt** — varies with mood and speech
- **Head Rotation** — follows gaze target

### **6. Idle Animations**
- **Arm Sway** — gentle arm movement when idle
- **Breathing Cycle** — continuous even rhythm
- **Head Micro-movements** — natural fidgeting
- **Eye Look-Around** — glancing at different points
- **Subtle Smile** — resting friendly expression (0.15 intensity)

## 🎯 **How Animations Are Triggered**

### **Speech Mode** → More Expressive
When speaking (`isSpeaking === true`):
- Lip-sync activates with full viseme cycling
- Hand gestures cycle through 6 different poses
- Arms gesture more dramatically
- Smile increases (0.3 base)
- Eye movements follow gaze target
- Body breathing accelerates (2.5x rate)

### **Idle Mode** → Subtle & Natural
When not speaking:
- Eyes look around naturally
- Arms do gentle sway
- Subtle smile maintained (0.15)
- Breathing relaxes (1.8x rate)
- Head does gentle tilt variations
- No dramatic gestures

### **Emotion-Based Modulation**
All animations adjust based on emotion:
- **Mouth curve** — smile curves vs frown curves
- **Mouth height** — wide smile vs tight mouth
- **Eyebrow height** — raised vs lowered
- **Expression blends** — combinations like "excited" (happy + surprised)

## 📊 **Viseme Details**

| Viseme | Duration | Mouth Shape | Examples |
|--------|----------|-------------|----------|
| aa | 100ms | Very wide, tall | "ah", "father" |
| ee | 110ms | Wide, flat | "see", "beat" |
| ih | 95ms | Moderate width | "bit", "sit" |
| oh | 120ms | Rounded, tall | "go", "no" |
| ou | 105ms | Very round, small | "blue", "zoo" |
| rest | — | Neutral smile | Between words |

## 💬 **Emotion Expressions**

### Happy / Friendly
```
Smile: 0.7
Happy: 0.85
Relaxed: 0.3
Mouth Curve: +0.045
```

### Excited
```
Smile: 0.9
Happy: 1.0
Surprised: 0.3
Mouth Curve: +0.070
Mouth Height: 1.25x
```

### Sad / Concerned
```
Sad: 0.9
Relaxed: 0.2
Mouth Curve: -0.060
```

### Surprised
```
Surprised: 1.0
Happy: 0.2
Mouth Height: 1.7x
Mouth Width: 0.8x
```

## 🎨 **Animation Performance Notes**

- **Frame Rate:** 60 FPS (requestAnimationFrame)
- **Lip-Sync Delay:** ~80-120ms (natural speech delay)
- **Gesture Update Rate:** Every 40-160ms
- **Blink Rate:** 3-4 per minute (natural human rate)
- **Eye Look-Around:** Every 400-1000ms

## 🔧 **Customization Points**

### In `ThreeCanvas.tsx`:

**Adjust Smiling:**
```typescript
// Line ~252: Smile control
targetSmileFactor = 0.3 + Math.sin(time * 3) * 0.1; // Change 0.3 for base smile
```

**Adjust Gesture Frequency:**
```typescript
// Line ~280: Gesture interval
gestureInterval = 40 + Math.random() * 120; // Adjust range
```

**Adjust Eye Look-Around:**
```typescript
// Line ~245: Eye look interval
eyeLookInterval = 400 + Math.random() * 600; // Adjust range
```

**Adjust Viseme Timing:**
```typescript
// Lines ~71-76: VISEME_PATTERNS
{ viseme: "aa", duration: 100 }, // Change duration in ms
```

**Adjust Blinking:**
```typescript
// Line ~330: Blink interval
nextBlinkFrame = 150 + Math.random() * 250; // Adjust range
```

## 📝 **Example: Making LIA "Happier"**

To increase default happiness:

1. **Increase smile factor:**
   ```typescript
   targetSmileFactor = 0.4 + Math.sin(time * 3) * 0.12; // More smile
   ```

2. **Change resting expression:**
   ```typescript
   mouth: { w: 0.070, h: 0.025, curve: 0.025 }, // Bigger smile curve
   ```

3. **Adjust emotion blending:**
   ```typescript
   // In getEmotionBlend:
   return { ...defaults, smile: 0.4, relaxed: 0.5 }; // Higher default smile
   ```

## 🚀 **Advanced Features**

### Smooth Animation Interpolation
All changes use `THREE.MathUtils.lerp()` for smooth, natural transitions:
- Mouth shape: 0.15 lerp factor (responds in ~100ms)
- Expressions: 0.08 lerp factor (soft blend)
- Head rotation: 0.04 lerp factor (subtle tracking)

### Natural Speech Rhythm
- Viseme patterns have variable durations
- Gesture phases vary (40-160ms intervals)
- Transitions are smooth, not abrupt
- Blink patterns are randomized

### Emotion Blending
Emotions aren't binary—they blend:
- "Excited" = Happy + Surprised + Smile
- "Nervous" = Surprised + Sad
- "Confident" = Smile + Relaxed + Angry (focused)

## 📱 **Browser Support**

- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Full support)
- ✅ Safari (Full support)
- ✅ Mobile browsers (Optimized)

## 🐛 **Troubleshooting**

### Lips not moving?
- Check WebSocket connection for speech data
- Verify `isSpeaking` prop is updating
- Check browser console for Three.js errors

### Gestures look frozen?
- Check `gesturePhase` is incrementing
- Verify WebSocket is connected
- Try browser refresh

### Emotions not showing?
- Verify emotion string is one of the recognized types
- Check `getEmotionBlend()` has the emotion
- Try adding new emotion type if missing

### Eyes not tracking?
- Check mouse move event is firing
- Verify camera/gaze target setup
- Check for CSS pointer-events: none on canvas

## 🎬 **Future Enhancements**

- [ ] Facial muscle tension (stress visualization)
- [ ] Hair physics simulation
- [ ] Cloth simulation for outfit movement
- [ ] Eye pupil dilation (emotion intensity)
- [ ] Sweat/tears for extreme emotions
- [ ] Head tilt based on emotion
- [ ] Voice-driven expression intensity
- [ ] Custom animation sequences
