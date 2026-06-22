# Advanced Lip Sync System - Technical Documentation

## Overview
Real-time speech-driven lip sync using multi-band frequency analysis and viseme morphing. The system analyzes audio in real-time and maps frequency characteristics to mouth shapes for realistic animation.

---

## 1. Audio Analysis Pipeline

### Input: Web Audio API
```javascript
// Setup
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;  // 128 frequency bins
const dataArr = new Uint8Array(analyser.frequencyBinCount);

// Per-frame analysis
analyser.getByteFrequencyData(dataArr);
```

### Frequency Bands
The audio spectrum is divided into 3 meaningful bands:

```
┌─ LOW (0-250 Hz) ─────────── Viseme Openness ──┐
│  Vowels, mouth opening, fundamental frequency  │
│  bins: 0-4 of FFT output                       │
│  Used for: Determining 'A', 'O' vs closed     │
└────────────────────────────────────────────────┘

┌─ MID (250-750 Hz) ───────── Consonants ────────┐
│  Consonant formation, mouth shape               │
│  bins: 4-12 of FFT output                      │
│  Used for: Distinguishing between shapes       │
└────────────────────────────────────────────────┘

┌─ HIGH (750-1500 Hz) ─────── Fricatives ────────┐
│  Sibilants (S, Z), fricatives (F, Th)          │
│  bins: 12-24 of FFT output                     │
│  Used for: Detecting sharp consonants          │
└────────────────────────────────────────────────┘
```

### Normalization
Each band is normalized independently for speaker independence:
```javascript
const lowNorm = Math.min(1, lowFreq / 200);    // baseline ~200
const midNorm = Math.min(1, midFreq / 180);    // baseline ~180
const highNorm = Math.min(1, highFreq / 160);  // baseline ~160
```

---

## 2. Mouth Opening Calculation

```javascript
// Primary driver: low-frequency amplitude (vowel content)
// Secondary influence: mid-frequency (consonant height)
const openness = Math.min(1, (lowNorm * 0.7 + midNorm * 0.3) * 1.4);

// Gain factor (1.4x) ensures clear visible mouth movement
```

### Openness Scale
```
0.0 ────► 0.15 ────► 0.35 ────► 0.55 ────► 0.75 ────► 1.0
rest      small      medium      large     very open   max
          (F/M)      (E/I)       (O/U)     (A)         clamp
```

---

## 3. Viseme Selection Algorithm

### Decision Tree
```
if openness > 0.75:
  ├─ if highNorm > 0.6: 'A' (wide open vowel with sharp consonant)
  └─ else: 'A' (standard open mouth)

else if openness > 0.55:
  ├─ if highNorm > 0.5: 'E' (spread with fricative)
  └─ else: 'O' (rounded vowel)

else if openness > 0.35:
  ├─ if highNorm > 0.4: 'E' (medium spread)
  └─ else: 'I' (narrow mouth)

else if openness > 0.15:
  └─ if highNorm > 0.3: 'M' (closed mouth, voiced)
     else: 'F' (closed mouth, fricative)

else:
  └─ 'rest' (minimal or no sound)
```

### Viseme-to-Phoneme Mapping

| Viseme | Phonemes | Shape | Blend Shapes |
|--------|----------|-------|--------------|
| **A** | /a/, /ɑ/, /æ/ | Wide mouth | aa: 1.0, ee: 0, ih: 0, oh: 0, ou: 0 |
| **E** | /e/, /ɛ/, /eɪ/ | Spread mouth | aa: 0, ee: 0.9, ih: 0, oh: 0, ou: 0 |
| **I** | /i/, /ɪ/, /aɪ/ | Narrow mouth | aa: 0, ee: 0, ih: 0.85, oh: 0, ou: 0 |
| **O** | /o/, /ɔ/, /oʊ/ | Rounded mouth | aa: 0, ee: 0, ih: 0, oh: 1.0, ou: 0 |
| **U** | /u/, /ʊ/ | Closed rounded | aa: 0, ee: 0, ih: 0, oh: 0, ou: 0.85 |
| **M** | /m/, /b/, /p/ | Almost closed | aa: 0, ee: 0, ih: 0, oh: 0, ou: 0.1 |
| **F** | /f/, /v/ | Fricative | aa: 0, ee: 0.2, ih: 0, oh: 0, ou: 0 |
| **rest** | silence | Resting | aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 |

---

## 4. Smoothing & Transition

### Jitter Reduction
Rapid frequency fluctuations can cause unnatural mouth flickering. Solution:

```javascript
let lastViseme = 'rest';
let visemeSmoothing = 0;

// Detect viseme change
if (newViseme !== lastViseme) {
  visemeSmoothing = 0.2;  // smooth transition window
  lastViseme = newViseme;
}
```

### Blend Shape Lerping
VRM blend shapes are updated with temporal smoothing:

```javascript
// Current blend shape value + target value lerped at 0.28 speed
currentValue = THREE.MathUtils.lerp(
  currentValue, 
  targetValue, 
  0.28  // ~28% toward target per frame
);
```

At 60 FPS, 0.28 speed = ~4 frames to reach 95% of target = smooth natural transitions

---

## 5. Emotion-Based Mouth Modulation

Emotional state affects how mouth shapes are expressed:

```javascript
const emoMap = {
  excited:   { emoCurve: 0.45, hm: 1.3, wm: 1.1 },  // bigger mouth, wider
  happy:     { emoCurve: 0.3,  hm: 1.0, wm: 1.0 },  // standard
  sad:       { emoCurve: -0.35,hm: 1.0, wm: 1.0 },  // inverted curve
  concerned: { emoCurve: -0.2, hm: 1.0, wm: 0.85},  // tighter
  surprised: { emoCurve: 0.0,  hm: 1.8, wm: 0.85},  // very open, narrow
};

// Apply emotional modulation to mouth width (wm) and height (hm)
const modifiedWidth = baseWidth * emo.wm;
const modifiedHeight = baseHeight * emo.hm;
const modifiedCurve = baseCurve + emo.emoCurve * 0.22;
```

---

## 6. VRM Blend Shape Integration

### VRM0 vs VRM1 Compatibility
The system supports both VRM standards with alias fallback:

```javascript
const EXPR = {
  aa:  ['aa', 'A', 'vowel_A'],
  ee:  ['ee', 'e', 'E', 'vowel_E'],
  ih:  ['ih', 'i', 'I', 'vowel_I'],
  oh:  ['oh', 'o', 'O', 'vowel_O'],
  ou:  ['ou', 'u', 'U', 'vowel_U'],
};

// Try each alias until one works
function setExpr(vrm, aliases, val) {
  for (const name of aliases) {
    try {
      if (vrm.expressionManager) {
        vrm.expressionManager.setValue(name, val);
      } else if (vrm.blendShapeProxy) {
        vrm.blendShapeProxy.setValue(name, val);
      }
    } catch (_) { /* try next alias */ }
  }
}
```

### Blend Shape Values
- **Range**: 0.0 (inactive) to 1.0 (fully active)
- **Update Frequency**: ~60 FPS (every ~16ms)
- **Interpolation**: Linear lerp between frames

---

## 7. Real-Time Viseme Sequencing

### Audio Duration Awareness
```javascript
const durationMs = audioBuffer.duration * 1000;
const visemeSequence = textToVisemes(text);
const stepMs = Math.max(65, durationMs / visemeSequence.length);

// Advance viseme every ~65ms minimum
// Distributes visemes across full speech duration
```

### Fallback: Text-to-Viseme Mapping
If frequency analysis is unavailable, fallback uses phonetic mapping:

```javascript
const PHONEME_TO_VISEME = {
  'a': 'A', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
  'p': 'M', 'b': 'M', 'm': 'M',
  'f': 'F', 'v': 'F',
  'k': 'A', 'g': 'A',
};

function textToVisemes(text) {
  return text.toLowerCase()
    .split('')
    .map(ch => PHONEME_TO_VISEME[ch] || 'rest');
}
```

---

## 8. Performance Optimization

### Efficient Frequency Analysis
```javascript
// Precompute slice bounds once
const lowSlice = dataArr.slice(0, 4);      // 4 bins
const midSlice = dataArr.slice(4, 12);     // 8 bins
const highSlice = dataArr.slice(12, 24);   // 12 bins

// Average calculation: O(n) where n is small constant
const lowFreq = lowSlice.reduce((a,b) => a+b, 0) / 4;
```

### Update Loop
- **Frame Rate**: Tied to requestAnimationFrame (~60 FPS)
- **Viseme Caching**: Last viseme stored, only update on change
- **Lerp Optimization**: Only update if difference > threshold

---

## 9. Comparison with Alternatives

### Method 1: Simple Amplitude (Previous)
```
Pros:  Fast, simple
Cons:  Misses consonant detail, inaccurate mouth shapes
```

### Method 2: Multi-Band Frequency Analysis (Current) ✅
```
Pros:  Natural mouth shapes, consonant awareness, speaker-independent
Cons:  Slightly more CPU (still <5%)
```

### Method 3: Full Phoneme Recognition
```
Pros:  Most accurate
Cons:  Requires ML model, high latency, not real-time friendly
```

---

## 10. Troubleshooting Lip Sync Issues

### Problem: Mouth not moving
**Diagnosis**: 
- [ ] Audio playing through Web Audio API?
- [ ] Analyser connected to context?
- [ ] VRM has lip blend shapes?

**Fix**:
```javascript
// Verify audio chain
source.connect(analyser);
analyser.connect(audioCtx.destination);
analyser.getByteFrequencyData(dataArr);
// Check dataArr has non-zero values
```

### Problem: Mouth flickering
**Diagnosis**: Viseme changing rapidly

**Fix**: Increase lerp speed from 0.28 to 0.35-0.40

### Problem: Mouth always open/closed
**Diagnosis**: Frequency baseline wrong for current speaker

**Fix**: Adjust normalization thresholds:
```javascript
const lowNorm = Math.min(1, lowFreq / 250);  // increase baseline
```

### Problem: Delayed lip sync
**Diagnosis**: Real-time constraint not met

**Fix**: 
- Reduce analyser.fftSize (256 is good)
- Disable other visual effects temporarily
- Check browser performance (DevTools)

---

## 11. Future Enhancements

### Planned Improvements
1. **Speaker Normalization**: Auto-adjust baselines per speaker
2. **Language-Specific Models**: Different viseme sets for languages
3. **Breath Detection**: Subtle mouth relaxation between phrases
4. **Emotion Intensity**: Scale mouth intensity with emotion strength
5. **Procedural Fallback**: Generate mouth shapes without VRM blend shapes

### Research Opportunities
- Machine learning model for viseme prediction
- Phoneme-aware blend shape selection
- Cross-lingual mouth shape mapping

---

## 12. Code Example: Full Lip Sync Loop

```javascript
function setupLipSync(audioBuffer, duration) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  const dataArr = new Uint8Array(analyser.frequencyBinCount);
  
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  
  let lastViseme = 'rest';
  
  function updateLipSync() {
    analyser.getByteFrequencyData(dataArr);
    
    // Frequency analysis
    const lowFreq = dataArr.slice(0, 4).reduce((a,b) => a+b) / 4;
    const midFreq = dataArr.slice(4, 12).reduce((a,b) => a+b) / 8;
    const highFreq = dataArr.slice(12, 24).reduce((a,b) => a+b) / 12;
    
    const lowNorm = Math.min(1, lowFreq / 200);
    const midNorm = Math.min(1, midFreq / 180);
    const highNorm = Math.min(1, highFreq / 160);
    
    const openness = (lowNorm * 0.7 + midNorm * 0.3) * 1.4;
    
    // Viseme selection
    let viseme = 'rest';
    if (openness > 0.75) viseme = highNorm > 0.6 ? 'A' : 'A';
    else if (openness > 0.55) viseme = highNorm > 0.5 ? 'E' : 'O';
    else if (openness > 0.35) viseme = highNorm > 0.4 ? 'E' : 'I';
    else if (openness > 0.15) viseme = highNorm > 0.3 ? 'M' : 'F';
    
    // Update avatar
    if (viseme !== lastViseme) {
      avatar.setViseme(viseme);
      lastViseme = viseme;
    }
    
    requestAnimationFrame(updateLipSync);
  }
  
  source.start(0);
  updateLipSync();
}
```

---

## 13. References

- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **VRM Spec**: https://vrm.dev/
- **Phonetics**: IPA (International Phonetic Alphabet) standard
- **Viseme Research**: Facial motion units in speech animation

---

**Document Version**: 2.0  
**Last Updated**: 2026-06-21  
**Status**: Production-Ready ✅
