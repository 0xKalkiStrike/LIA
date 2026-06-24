/* JARVIS AI — front-end app
 * Flow: boot → (no users? onboarding : login) → wake-up sequence → dashboard
 */
import { buildAnime } from './anime.js?v=4.0.0';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    state.token = null;
    localStorage.removeItem('jarvis_token');
  }
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
};

const state = {
  token: localStorage.getItem('jarvis_token') || null,
  voices: {}, langModes: {}, ttsLang: {},
  profile: null,
  avatar: null,
  piperAvailable: false,   // true when /api/tts/status confirms Piper is ready
  currentPath: "C:/hacker/LIA",
  activeTaskToApprove: null,
  webcamActive: false,
  cameraStream: null,
  mediaPipeCamera: null,
  continuousListening: false,
  draft: { // onboarding selections
    char_gender: 'female', char_skin: 'fair', char_hair_style: 'long',
    char_hair_color: 'black', char_eyes: 'sapphire', char_outfit: 'cyan',
    char_style: 'anime', char_name: 'LIA',
    voice_persona: 'friday', language_mode: 'auto',
    avatar_type: 'lia',   // lia | male | custom
    vrm_path: '',
  },
};

function show(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

/* build the anime character from a profile/draft object into `el` */
function mountAvatar(el, src, opts = {}) {
  return buildAnime(el, { ...src, asleep: opts.asleep || false });
}

/* ─────────────────────────── speech engine ─────────────────────────── */
let voicesReady = [];
speechSynthesis.onvoiceschanged = () => { voicesReady = speechSynthesis.getVoices(); };
voicesReady = speechSynthesis.getVoices();

/** Transliterates Gujarati script to Devanagari script */
function transliterateGujaratiToDevanagari(text) {
  return text.replace(/[\u0A80-\u0AFF]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x0180);
  });
}

/** Transliterates Gujarati and Devanagari script to Romanized text */
function transliterateIndicToRoman(text) {
  let normalizedText = text.replace(/[\u0900-\u097F]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x0180);
  });

  const mapping = {
    '\u0A85': 'a', '\u0A86': 'aa', '\u0A87': 'i', '\u0A88': 'ee', '\u0A89': 'u', '\u0A8A': 'oo', '\u0A8B': 'ru',
    '\u0A8F': 'e', '\u0A90': 'ai', '\u0A93': 'o', '\u0A94': 'au',
    '\u0A95': 'k', '\u0A96': 'kh', '\u0A97': 'g', '\u0A98': 'gh', '\u0A99': 'ng',
    '\u0A9A': 'ch', '\u0A9B': 'chh', '\u0A9C': 'j', '\u0A9D': 'jh', '\u0A9E': 'ny',
    '\u0A9F': 't', '\u0AA0': 'th', '\u0AA1': 'd', '\u0AA2': 'dh', '\u0AA3': 'n',
    '\u0AA4': 't', '\u0AA5': 'th', '\u0AA6': 'd', '\u0AA7': 'dh', '\u0AA8': 'n',
    '\u0AAA': 'p', '\u0AAB': 'f', '\u0AAC': 'b', '\u0AAD': 'bh', '\u0AAE': 'm',
    '\u0AAF': 'y', '\u0AB0': 'r', '\u0AB2': 'l', '\u0AB3': 'l', '\u0AB5': 'v',
    '\u0AB6': 'sh', '\u0AB7': 'sh', '\u0AB8': 's', '\u0AB9': 'h',
    '\u0ABE': 'a', '\u0ABF': 'i', '\u0AC0': 'ee', '\u0AC1': 'u', '\u0AC2': 'oo', '\u0AC3': 'ru',
    '\u0AC7': 'e', '\u0AC8': 'ai', '\u0ACB': 'o', '\u0ACC': 'au',
    '\u0ACD': '', '\u0A82': 'n', '\u0A83': 'h'
  };
  
  let result = '';
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const code = char.charCodeAt(0);
    
    if (code >= 0x0A80 && code <= 0x0AFF) {
      const isConsonant = (code >= 0x0A95 && code <= 0x0AB9) || code === 0x0AB3;
      const nextChar = normalizedText[i + 1];
      const nextCode = nextChar ? nextChar.charCodeAt(0) : 0;
      
      result += mapping[char] || '';
      
      if (isConsonant) {
        const nextIsGujaratiLetter = nextCode >= 0x0A80 && nextCode <= 0x0AFF;
        if (nextIsGujaratiLetter && !(nextCode >= 0x0ABE && nextCode <= 0x0ACD)) {
          result += 'a';
        }
      }
    } else {
      result += char;
    }
  }
  return result;
}

// Shared AudioContext for Piper playback + viseme extraction
let _audioCtxTTS = null;
function getAudioCtx() {
  if (!_audioCtxTTS || _audioCtxTTS.state === 'closed') {
    _audioCtxTTS = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtxTTS;
}

/**
 * speak() — primary TTS entry point.
 * If Piper is available (state.piperAvailable), fetch audio from /api/tts and
 * drive lip-sync from real audio amplitude via Web Audio API AnalyserNode.
 * Otherwise fall back to browser speechSynthesis with estimated lip-sync timing.
 */
function speak(text, { onend, language } = {}) {
  if (!text) { onend && onend(); return; }
  const p = state.profile || state.draft;
  const persona = state.voices[p.voice_persona] || { pitch: 1, rate: 1 };

  const hasIndicScript = /[\u0900-\u0D7F]/.test(text);
  const isGujarati = /[\u0A80-\u0AFF]/.test(text) || language === 'gujarati' || p.language_mode === 'english_gujarati';
  const isNonEnglish = isGujarati || hasIndicScript || (language && language !== 'english') || (p.language_mode && p.language_mode !== 'english' && p.language_mode !== 'auto');

  if (state.piperAvailable && !isNonEnglish) {
    _speakPiper(text, p.voice_persona, onend);
  } else {
    _speakBrowser(text, persona, p, onend, isGujarati);
  }
}

/** Piper TTS path — fetches WAV from /api/tts, decodes, plays, and drives visemes. */
async function _speakPiper(text, personaId, onend) {
  try {
    const res = await fetch(
      `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(personaId)}`,
      { headers: { Authorization: 'Bearer ' + state.token } }
    );
    if (!res.ok) throw new Error('TTS server error');

    const arrayBuf = await res.arrayBuffer();
    const ctx = getAudioCtx();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);

    // Analyser for real-time viseme driving
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    // Store analyser on context so _driveLiaCallWave can access it
    ctx._analyserNode = analyser;

    const durationMs = audioBuf.duration * 1000;

    // Initialize avatar state for talking
    if (state.avatar) { 
      state.avatar.stopSpeaking(); 
      state.avatar.setEmotion('excited'); 
      state.avatar.gesture('talking'); 
    }
    if (state.callAvatar) { 
      state.callAvatar.stopSpeaking(); 
      state.callAvatar.setEmotion('excited'); 
      state.callAvatar.gesture('talking'); 
    }

    // Update voice visualizer bars while speaking
    const visualizerBars = document.querySelectorAll('#voice-visualizer .vv-bar');
    const callBars = document.querySelectorAll('.call-lia-wave .cw-bar');

    let raf;
    let emotionCycle = 0;  /* Vary emotion during long speeches */
    let lastViseme = 'rest';
    let visemeSmoothing = 0;
    function driveVisemes() {
      analyser.getByteFrequencyData(dataArr);

      /* Enhanced frequency analysis for realistic lip sync */
      const lowFreq = dataArr.slice(0, 4).reduce((a, b) => a + b, 0) / 4;     /* 0-250Hz: vowels/openness */
      const midFreq = dataArr.slice(4, 12).reduce((a, b) => a + b, 0) / 8;   /* 250-750Hz: consonants */
      const highFreq = dataArr.slice(12, 24).reduce((a, b) => a + b, 0) / 12; /* 750-1500Hz: fricatives */

      /* Normalize frequencies with dynamic range */
      const lowNorm = Math.min(1, lowFreq / 200);
      const midNorm = Math.min(1, midFreq / 180);
      const highNorm = Math.min(1, highFreq / 160);

      /* Mouth openness primarily driven by low frequencies */
      const openness = Math.min(1, (lowNorm * 0.7 + midNorm * 0.3) * 1.4);

      /* Select viseme based on frequency characteristics */
      let vis = 'rest';
      if (openness > 0.75) {
        vis = highNorm > 0.6 ? 'A' : (midNorm > 0.6 ? 'O' : 'A');  /* Very open mouth */
      } else if (openness > 0.55) {
        vis = highNorm > 0.5 ? 'E' : (midNorm > 0.5 ? 'O' : 'E');  /* Medium-wide mouth */
      } else if (openness > 0.35) {
        vis = highNorm > 0.4 ? 'E' : (midNorm > 0.4 ? 'I' : 'E');  /* Medium mouth */
      } else if (openness > 0.15) {
        vis = highNorm > 0.3 ? 'M' : 'F';  /* Closed mouth */
      } else {
        vis = 'rest';  /* Resting mouth */
      }

      /* Smooth viseme transitions to prevent jittering */
      if (vis !== lastViseme) {
        visemeSmoothing = 0.2;
        lastViseme = vis;
      }

      if (state.avatar) state.avatar.setViseme(vis);
      if (state.callAvatar) state.callAvatar.setViseme(vis);

      /* Vary emotion during long speeches for more dynamic feel */
      emotionCycle += 0.016;  /* ~60fps delta */
      if (emotionCycle > 3) {
        emotionCycle = 0;
        const emotions = ['excited', 'friendly', 'happy'];
        const nextEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        if (state.avatar) state.avatar.setEmotion(nextEmotion);
        if (state.callAvatar) state.callAvatar.setEmotion(nextEmotion);
      }

      // Update voice visualizer
      if (visualizerBars.length) {
        for (let i = 0; i < visualizerBars.length; i++) {
          const val = dataArr[i] || 0;
          const h = Math.max(3, (val / 255) * 32);
          visualizerBars[i].style.height = h + 'px';
        }
      }

      // Update call wave
      if (callBars.length) {
        for (let i = 0; i < callBars.length; i++) {
          const val = dataArr[i + 8] || 0;
          const h = Math.max(8, (val / 255) * 44);
          callBars[i].style.height = h + 'px';
        }
      }

      raf = requestAnimationFrame(driveVisemes);
    }
    driveVisemes();

    source.onended = () => {
      cancelAnimationFrame(raf);
      ctx._analyserNode = null;
      if (state.avatar) { 
        state.avatar.setViseme('rest'); 
        state.avatar.stopSpeaking();
        state.avatar.setEmotion('neutral');
        setTimeout(() => state.avatar && state.avatar.gesture('idle'), 500);
      }
      if (state.callAvatar) { 
        state.callAvatar.setViseme('rest'); 
        state.callAvatar.stopSpeaking();
        state.callAvatar.setEmotion('neutral');
        setTimeout(() => state.callAvatar && state.callAvatar.gesture('idle'), 500);
      }
      onend && onend();
    };

    source.start(0);
  } catch (err) {
    console.warn('Piper TTS failed, falling back to browser:', err);
    state.piperAvailable = false;
    _speakBrowser(text, state.voices[(state.profile || state.draft).voice_persona] || { pitch: 1, rate: 1 }, state.profile || state.draft, onend);
  }
}

/** Browser speechSynthesis — smart voice selection for natural, non-robotic sound. */
function _speakBrowser(text, persona, p, onend, isGujarati = false) {
  if (!('speechSynthesis' in window)) { onend && onend(); return; }
  speechSynthesis.cancel();
  const langCode = isGujarati ? 'gu-IN' : (state.ttsLang[p.language_mode] || 'en-IN');
  const u = new SpeechSynthesisUtterance(text);

  // Always refresh — browsers load voices async
  const vv = speechSynthesis.getVoices();
  if (vv.length) voicesReady = vv;

  // Premium female voice priority list - PRIORITIZE NEURAL/NATURAL VOICES ONLY
  const PREMIUM = isGujarati ? [
    'Microsoft Dhwani Online (Natural)',
    'Google ગુજરાતી',
    'Microsoft Shruti',
    'Shruti'
  ] : [
    // NEURAL/NATURAL VOICES ONLY for non-robotic sound
    'Microsoft Neerja Online (Natural)',
    'Microsoft Aria Online (Natural)',
    'Microsoft Jenny Online (Natural)',
    'Microsoft Ava Online',
    // Indian English neural voices (natural accent)
    'Google India English Female',
    'Google IN English Female',
    // Premium US English neural voices
    'Microsoft Aria',
    'Microsoft Jenny',
    'Google US English',
    'Google Wavenet-C',
    'Google Wavenet-F',
    // Fallback natural voices
    'Microsoft Neerja',
    'Microsoft Heera',
    'Veena',
    'Microsoft Zira',
    'Microsoft Hazel',
    'Samantha',
    'Google UK English Female',
    'Google Australia',
  ];

  let v = null;

  if (isGujarati) {
    // 1. Try native Gujarati voices (female preferred)
    let guVoices = voicesReady.filter(x => x.lang.startsWith('gu') || x.lang.startsWith('gu-') || x.name.includes('Dhwani') || x.name.includes('Shruti') || x.name.includes('ગુજરાતી'));
    guVoices = guVoices.filter(x => !/male|boy|man|niranjan|karan|harsh|malhar|hemant|madhur|ravi|david|mark/i.test(x.name));
    v = guVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || guVoices[0] || null;

    // 2. Try Hindi voices (female preferred)
    if (!v) {
      let hiVoices = voicesReady.filter(x => x.lang.startsWith('hi') || x.lang.startsWith('hi-') || x.name.includes('हिन्दी') || x.name.includes('Hindi'));
      hiVoices = hiVoices.filter(x => !/male|boy|man|niranjan|karan|harsh|malhar|hemant|madhur|ravi|david|mark/i.test(x.name));
      v = hiVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || hiVoices[0] || null;
    }

    // 3. Try Indian English voices (female preferred, but allow male to preserve Indian accent)
    if (!v) {
      let inVoices = voicesReady.filter(x => x.lang.startsWith('en-IN') || x.name.includes('India') || x.name.includes('Ravi') || x.name.includes('Heera'));
      let inFemale = inVoices.filter(x => !/male|boy|man|niranjan|karan|harsh|malhar|hemant|madhur|ravi|david|mark/i.test(x.name));
      v = inFemale.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) 
          || inFemale[0] 
          || inVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) 
          || inVoices[0] 
          || null;
    }
  }

  if (!v) {
    // 1. Exact premium match
    for (const name of PREMIUM) {
      v = voicesReady.find(x => x.name === name);
      if (v) break;
    }
    // 2. Partial premium match (more flexible, check word presence)
    if (!v) {
      for (const name of PREMIUM) {
        const keywords = name.split(' ').filter(x => x.length > 3).map(x => x.toLowerCase());
        v = voicesReady.find(x => {
          const nameLower = x.name.toLowerCase();
          return keywords.some(k => nameLower.includes(k)) &&
                 /female|woman|aria|jenny|zira|hazel|heera|neerja|veena|samantha|ava/i.test(x.name);
        });
        if (v) break;
      }
    }
    // 3. Persona hints (only if not forcing Gujarati)
    if (!v && !isGujarati) {
      for (const h of (persona.web_voice_hint || [])) {
        v = voicesReady.find(x => x.name.toLowerCase().includes(h.toLowerCase()));
        if (v) break;
      }
    }
    // 4. Any locale-matching voice
    if (!v) {
      const filterLang = 'en';
      let langV = voicesReady.filter(x => x.lang.startsWith(filterLang) || x.lang.startsWith(filterLang + '-'));
      langV = langV.filter(x => !/male|boy|man|niranjan|karan|harsh|malhar|hemant|madhur|ravi|david|mark/i.test(x.name));
      v = langV.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name))
        || langV.find(x => x.localService)
        || langV[0]
        || null;
    }
  }
  
  // Ultimate fallback (must be female)
  if (!v) {
    v = voicesReady.find(x => /heera|zira|jerry|jenny|aria|samantha|veena|neerja/i.test(x.name.toLowerCase())) 
        || voicesReady[0] 
        || null;
  }

  if (v) u.voice = v;

  // Transliterate if using fallback/different script voices
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text);
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasGujarati || hasDevanagari) {
    const voiceLang = (v && v.lang) ? v.lang : 'en';
    if (voiceLang.startsWith('hi')) {
      if (hasGujarati) {
        u.text = transliterateGujaratiToDevanagari(text);
      }
    } else if (!voiceLang.startsWith('gu') && !voiceLang.startsWith('hi')) {
      u.text = transliterateIndicToRoman(text);
    }
  }

  /* FORCE NATURAL SETTINGS - prevent robot voice */
  const isNeuralVoice = v && /natural|online|neural|wavenet|google|microsoft.*online/i.test(v.name);

  // ALWAYS use natural settings for best quality
  u.pitch  = persona.pitch  ?? 1.0;   /* Natural pitch - no squeaking */
  u.rate   = persona.rate   ?? 0.95;  /* Slightly slower = clearer, more human */
  u.volume = 1.0;
  u.lang   = v ? v.lang : langCode;

  // If NOT a neural voice, avoid pitch-shifting to prevent robotic metallic distortion
  if (!isNeuralVoice && v) {
    u.pitch = 1.0;
    u.rate = 0.90;  /* Even slower for non-neural voices to maximize clarity */
  }

  /* Dynamic prosody: adjust pitch & rate based on emotional state for more natural expression */
  const mood = state.profile?.current_mood || 'neutral';
  if (mood === 'excited' || mood === 'happy') { 
    u.pitch = Math.min(1.15, u.pitch * 1.06);  /* natural slight elevation */
    u.rate  = Math.min(1.15, u.rate * 1.05);   /* slightly faster */
  }
  else if (mood === 'sad') { 
    u.pitch = Math.max(0.85, u.pitch * 0.94);  /* subtle down-pitch */
    u.rate  = Math.max(0.75, u.rate * 0.85);   /* slower, more natural pause */
  }
  else if (mood === 'angry') { 
    u.pitch = Math.min(1.15, u.pitch * 1.03);  /* crisp, slightly higher tension */
    u.rate  = Math.min(1.20, u.rate * 1.08);   /* faster delivery */
  }

  const words = Math.max(1, text.trim().split(/\s+/).length);
  const estMs = (words / (2.6 * (persona.rate || 1))) * 1000;

  u.onstart = () => {
    /* Start talking gesture with full animation */
    if (state.avatar) { 
      state.avatar.stopSpeaking(); 
      state.avatar.setViseme('rest'); 
      state.avatar.gesture('talking');
      state.avatar.setEmotion('friendly');  /* friendly expression while talking */
    }
    if (state.callAvatar) { 
      state.callAvatar.stopSpeaking(); 
      state.callAvatar.setViseme('rest'); 
      state.callAvatar.gesture('talking');
      state.callAvatar.setEmotion('friendly');
    }
  };
  u.onboundary = (event) => {
    if (event.name === 'word') {
      const charIndex = event.charIndex;
      const spokenText = u.text || text;
      const remainingText = spokenText.slice(charIndex);
      const nextSpace = remainingText.search(/\s/);
      const word = nextSpace === -1 ? remainingText : remainingText.slice(0, nextSpace);
      
      const vis = _wordToViseme(word);
      
      if (state.avatar) state.avatar.setViseme(vis);
      if (state.callAvatar) state.callAvatar.setViseme(vis);
      
      clearTimeout(u._boundaryTimer);
      const duration = Math.max(150, Math.min(450, word.length * 60));
      u._boundaryTimer = setTimeout(() => {
        if (state.avatar) state.avatar.setViseme('rest');
        if (state.callAvatar) state.callAvatar.setViseme('rest');
      }, duration);
    }
  };
  u.onend = () => {
    clearTimeout(u._boundaryTimer);
    /* Smooth transition back to idle with neutral expression */
    if (state.avatar) { 
      state.avatar.setViseme('rest'); 
      state.avatar.stopSpeaking();
      state.avatar.setEmotion('neutral');
      setTimeout(() => state.avatar && state.avatar.gesture('idle'), 600); 
    }
    if (state.callAvatar) { 
      state.callAvatar.setViseme('rest'); 
      state.callAvatar.stopSpeaking();
      state.callAvatar.setEmotion('neutral');
      setTimeout(() => state.callAvatar && state.callAvatar.gesture('idle'), 600); 
    }
    onend && onend();
  };
  u.onerror = () => {
    clearTimeout(u._boundaryTimer);
    if (state.avatar) { state.avatar.setViseme('rest'); state.avatar.stopSpeaking(); state.avatar.gesture('idle'); }
    if (state.callAvatar) { state.callAvatar.setViseme('rest'); state.callAvatar.stopSpeaking(); state.callAvatar.gesture('idle'); }
    onend && onend();
  };
  speechSynthesis.speak(u);
}

function _wordToViseme(word) {
  word = transliterateIndicToRoman(word);
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 'rest';
  
  const rules = [
    [/[aæ]/g,     'A'],
    [/[eɛ]/g,     'E'],
    [/[iɪy]/g,    'I'],
    [/[oɔ]/g,     'O'],
    [/[uʊ]/g,     'U'],
    [/[mbp]/g,    'M'],
    [/[fv]/g,     'F'],
    [/[tdnlrsz]/g,'E'],
    [/[kg]/g,     'A'],
    [/[wh]/g,     'O'],
  ];
  for (const letter of word) {
    for (const [re, vis] of rules) {
      if (re.test(letter)) return vis;
    }
  }
  return 'E';
}

/** Check Piper availability on boot and update state.piperAvailable. */
async function checkPiperStatus() {
  try {
    if (!state.token) return;
    const s = await api('/api/tts/status');
    state.piperAvailable = s.piper_available && s.installed_voices.length > 0;
    const el = document.getElementById('engine-status');
    if (el) {
      el.textContent = state.piperAvailable
        ? 'Piper TTS · ready'
        : 'Browser TTS · ready';
    }
    updateAgentMonitor();
    if (state.piperAvailable) {
      addActivity('sys', 'SYSTEM', 'Piper TTS engine online — ' + s.installed_voices.join(', '));
    }
  } catch (_) {}
}

/* ─────────────────────────────── boot ──────────────────────────────── */
async function boot() {
  try {
    const s = await api('/api/state');
    state.voices = s.voices; state.langModes = s.language_modes; state.ttsLang = s.tts_lang;
    buildVoiceCards($('#voice-cards'));
    buildLangCards($('#lang-cards'));
    setTimeout(() => {
      if (s.has_users && state.token) return enterDashboard().catch(() => showLogin(s.has_users));
      showLogin(s.has_users);
    }, 900);
  } catch (e) {
    $('#boot-status').textContent = 'Cannot reach the JARVIS server — run: python run.py';
  }
}

function showLogin(hasUsers) {
  state.token = null; localStorage.removeItem('jarvis_token');
  if (!hasUsers) return startOnboarding();
  show('#screen-login');
  mountAvatar($('#login-avatar'), { skin: 'fair', hair: 'black', eyes: 'sapphire',
    outfit: 'cyan', asleep: true });
}

/* ───────────────────────── onboarding wizard ───────────────────────── */
// Steps: 0=companion, 1=gender, 2=skin, 3=hair, 4=suit+name, 5=voice, 6=lang, 7=account
const STEPS = 8;
let step = 0;

// Steps to skip when LIA VRM is chosen (gender/skin/hair/suit are irrelevant for VRM)
const LIA_SKIP_STEPS = new Set([1, 2, 3, 4]); // skip character customisation for VRM avatar

function startOnboarding() {
  show('#screen-onboard');
  step = 0;
  $('#ob-steps').innerHTML = Array.from({ length: STEPS }, () => '<i></i>').join('');
  renderObAvatar();
  renderStep();
  $$('[data-key]').forEach(row => {
    const key = row.dataset.key;
    row.querySelectorAll('[data-val]').forEach(btn => {
      btn.classList.toggle('sel', btn.dataset.val === state.draft[key]);
    });
  });
}

function _shouldSkip(s) {
  // Skip procedural character steps when using LIA VRM or custom VRM
  const type = state.draft.avatar_type || 'lia';
  if ((type === 'lia' || type === 'custom') && LIA_SKIP_STEPS.has(s)) return true;
  // Skip the gender step (1-gender) when visible — it shares step=1 slot
  return false;
}

function renderObAvatar() {
  const d = state.draft;
  // Pick correct VRM path for preview
  let vrmPath = '';
  if (d.avatar_type === 'lia') vrmPath = '/static/LIA.vrm';
  else if (d.avatar_type === 'custom') vrmPath = d.vrm_path || '/static/LIA.vrm';
  state.obAvatar = mountAvatar($('#ob-avatar'), { ...d, vrm_path: vrmPath });
  state.obAvatar.wake();
  $('#ob-charname').textContent = d.char_name || 'LIA';
}

function renderStep() {
  // Map logical step to DOM data-step (we use numeric steps 0-7, plus '1-gender')
  $$('.ob-step').forEach(s => {
    const ds = s.dataset.step;
    const numDs = ds === '1-gender' ? 1 : +ds;
    s.classList.toggle('active', numDs === step);
  });
  $$('#ob-steps i').forEach((dot, i) => dot.classList.toggle('done', i <= step));
  $('#ob-back').style.visibility = step === 0 ? 'hidden' : 'visible';
  $('#ob-next').textContent = step === STEPS - 1 ? 'Create my AI ⚡' : 'Next';

  // Show/hide companion type-specific sections
  const type = state.draft.avatar_type || 'lia';
  const uploadArea = $('#vrm-upload-area');
  if (uploadArea) uploadArea.style.display = type === 'custom' ? 'block' : 'none';
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-val]');
  if (!btn) return;
  const row = btn.closest('[data-key]');
  if (!row) return;
  const key = row.dataset.key;
  row.querySelectorAll('[data-val]').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  state.draft[key] = btn.dataset.val;

  // Handle avatar_type selection side-effects
  if (key === 'avatar_type') {
    if (btn.dataset.val === 'lia') {
      state.draft.char_gender = 'female';
      state.draft.char_name = 'LIA';
    } else if (btn.dataset.val === 'male') {
      state.draft.char_gender = 'male';
      state.draft.char_name = 'JARVIS';
    }
    renderStep();
  }

  // Smart name auto-updates when gender changes
  if (key === 'char_gender') {
    const isDash = $('#screen-dash').classList.contains('active');
    if (isDash) {
      if (state.profile.char_name === 'JARVIS' && btn.dataset.val === 'female') {
        state.profile.char_name = 'LIA';
        saveProfilePatch({ char_gender: 'female', char_name: 'LIA' });
        $('#dash-charname').textContent = 'LIA';
        return;
      } else if (state.profile.char_name === 'LIA' && btn.dataset.val === 'male') {
        state.profile.char_name = 'JARVIS';
        saveProfilePatch({ char_gender: 'male', char_name: 'JARVIS' });
        $('#dash-charname').textContent = 'JARVIS';
        return;
      }
    } else {
      if (state.draft.char_name === 'JARVIS' && btn.dataset.val === 'female') {
        state.draft.char_name = 'LIA';
        const input = $('#in-charname');
        if (input) input.value = 'LIA';
        $('#ob-charname').textContent = 'LIA';
      } else if (state.draft.char_name === 'LIA' && btn.dataset.val === 'male') {
        state.draft.char_name = 'JARVIS';
        const input = $('#in-charname');
        if (input) input.value = 'JARVIS';
        $('#ob-charname').textContent = 'JARVIS';
      }
    }
  }

  if (key.startsWith('char_')) renderObAvatar();
  if (key === 'voice_persona') speakSample(btn.dataset.val);
  if ($('#screen-dash').classList.contains('active')) saveProfilePatch({ [key]: btn.dataset.val });
});

// Custom VRM file upload during onboarding
$('#vrm-file-input') && $('#vrm-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = $('#vrm-upload-status');
  status.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/avatar/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (state.token || '') },
      body: fd,
    });
    const data = await res.json();
    if (data.ok) {
      state.draft.vrm_path = data.vrm_url;
      state.draft.avatar_type = 'custom';
      status.textContent = '✓ VRM uploaded — preview updated.';
      renderObAvatar();
    } else {
      status.textContent = '✗ Upload failed.';
    }
  } catch (err) {
    status.textContent = '✗ ' + err.message;
  }
});

$('#in-charname').addEventListener('input', e => {
  state.draft.char_name = e.target.value.trim() || 'LIA';
  $('#ob-charname').textContent = state.draft.char_name;
});

$('#ob-back').onclick = () => {
  if (step > 0) {
    step--;
    while (_shouldSkip(step) && step > 0) step--;
    renderStep();
  }
};
$('#ob-next').onclick = async () => {
  if (step < STEPS - 1) {
    step++;
    while (_shouldSkip(step) && step < STEPS - 1) step++;
    renderStep();
    return;
  }
  const username = $('#in-username').value.trim();
  const secret = $('#in-secret').value;
  const err = $('#signup-error');
  err.textContent = '';
  try {
    const res = await api('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        username,
        display_name: username,
        secret_word: secret,
        profile: state.draft,
      }),
    });
    state.token = res.token; localStorage.setItem('jarvis_token', res.token);
    state.profile = res.profile;
    enterDashboard(true);
  } catch (e) { err.textContent = e.message; }
};

/* voice & language cards */
function buildVoiceCards(root) {
  root.innerHTML = Object.entries(state.voices).map(([id, v]) => `
    <div class="voice-card" data-val="${id}">
      <div class="v-name">${v.label}</div>
      <div class="v-style">${v.style}</div>
      <button class="v-play" data-play="${id}">▶ Preview</button>
    </div>`).join('');
}
function buildLangCards(root) {
  root.innerHTML = Object.entries(state.langModes).map(([id, m]) => `
    <div class="lang-card" data-val="${id}">
      <div class="l-name">${m.label}</div>
      <div class="l-sample">“${m.sample}”</div>
    </div>`).join('');
}
async function saveProfilePatch(patch) {
  try {
    const updated = await api('/api/profile', {
      method: 'POST',
      body: JSON.stringify(patch)
    });
    state.profile = updated;
    
    // Check if we need to remount the 3D avatar
    let needsRemount = false;
    let needsSettingsRefresh = false;
    for (const k in patch) {
      if (k.startsWith('char_') || k === 'avatar_type') {
        needsRemount = true;
      }
      if (k === 'avatar_type' || k === 'char_gender') {
        needsSettingsRefresh = true;
      }
    }
    if (needsRemount && state.avatar) {
      const avatarCfg = {
        ...state.profile,
        vrm_path: state.profile.vrm_path || (state.profile.avatar_type === 'male' ? '' : '/static/LIA.vrm'),
      };
      const el = $('#dash-avatar');
      if (el) state.avatar = mountAvatar(el, avatarCfg);
    }
    if (needsSettingsRefresh) {
      buildSettingsChar();
    }
    return updated;
  } catch (err) {
    console.error("Failed to save profile patch:", err);
  }
}

function buildSettingsChar() {
  const root = $('#settings-char');
  if (!root) return;
  const p = state.profile || {};
  const cur = p.avatar_type || 'lia';
  root.innerHTML = `
    <div class="pick-row companion-row" data-key="avatar_type">
      <button class="pick-card big companion-card${cur==='lia'?' sel':''}" data-val="lia">
        <span class="pick-emoji">✨</span><strong>LIA</strong><small>Default · Female VRM</small>
      </button>
      <button class="pick-card big companion-card${cur==='male'?' sel':''}" data-val="male">
        <span class="pick-emoji">🤖</span><strong>Procedural Companion</strong><small>Customisable · 3D</small>
      </button>
      <button class="pick-card big companion-card${cur==='custom'?' sel':''}" data-val="custom">
        <span class="pick-emoji">📁</span><strong>Import Custom VRM</strong><small>Upload your own .vrm</small>
      </button>
    </div>
    <div id="settings-vrm-area" style="display:${cur==='custom'?'block':'none'};margin-top:12px;">
      <label class="field-label">Upload VRM file</label>
      <input type="file" id="settings-vrm-input" accept=".vrm" class="text-input" style="padding:6px;"/>
      <p class="hint" id="settings-vrm-status"></p>
    </div>
  `;

  if (cur === 'male') {
    root.innerHTML += `
      <div class="settings-procedural-group" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
        <div class="field-label">Character Gender</div>
        <div class="pick-row" data-key="char_gender">
          <button class="pick-card big${p.char_gender==='male'?' sel':''}" data-val="male"><span class="pick-emoji">👨</span>Male</button>
          <button class="pick-card big${p.char_gender==='female'?' sel':''}" data-val="female"><span class="pick-emoji">👩</span>Female</button>
        </div>

        <div class="field-label">Skin Tone</div>
        <div class="pick-row swatches" data-key="char_skin">
          <button class="swatch${p.char_skin==='porcelain'?' sel':''}" data-val="porcelain" style="--c:#F6E3D5"><i></i>Porcelain</button>
          <button class="swatch${p.char_skin==='fair'?' sel':''}" data-val="fair" style="--c:#F0C8A8"><i></i>Fair</button>
          <button class="swatch${p.char_skin==='tan'?' sel':''}" data-val="tan" style="--c:#D9A06E"><i></i>Tan</button>
          <button class="swatch${p.char_skin==='brown'?' sel':''}" data-val="brown" style="--c:#A86A3E"><i></i>Brown</button>
          <button class="swatch${p.char_skin==='deep'?' sel':''}" data-val="deep" style="--c:#6E4426"><i></i>Deep</button>
        </div>

        <div class="field-label">Hair Style</div>
        <div class="pick-row wrap" data-key="char_hair_style">
          <button class="pick-card${p.char_hair_style==='long'?' sel':''}" data-val="long">Long</button>
          <button class="pick-card${p.char_hair_style==='wave'?' sel':''}" data-val="wave">Wavy</button>
          <button class="pick-card${p.char_hair_style==='bun'?' sel':''}" data-val="bun">Bun</button>
          <button class="pick-card${p.char_hair_style==='curly'?' sel':''}" data-val="curly">Curly</button>
          <button class="pick-card${p.char_hair_style==='short'?' sel':''}" data-val="short">Short</button>
          <button class="pick-card${p.char_hair_style==='spiky'?' sel':''}" data-val="spiky">Spiky</button>
        </div>

        <div class="field-label">Hair Color</div>
        <div class="pick-row swatches" data-key="char_hair_color">
          <button class="swatch${p.char_hair_color==='black'?' sel':''}" data-val="black" style="--c:#2A2533"><i></i>Black</button>
          <button class="swatch${p.char_hair_color==='brown'?' sel':''}" data-val="brown" style="--c:#5A3A22"><i></i>Brown</button>
          <button class="swatch${p.char_hair_color==='blonde'?' sel':''}" data-val="blonde" style="--c:#E7C273"><i></i>Blonde</button>
          <button class="swatch${p.char_hair_color==='pink'?' sel':''}" data-val="pink" style="--c:#E87BA8"><i></i>Pink</button>
          <button class="swatch${p.char_hair_color==='blue'?' sel':''}" data-val="blue" style="--c:#4E74C8"><i></i>Blue</button>
          <button class="swatch${p.char_hair_color==='violet'?' sel':''}" data-val="violet" style="--c:#7A5CC0"><i></i>Violet</button>
          <button class="swatch${p.char_hair_color==='white'?' sel':''}" data-val="white" style="--c:#D9DCE6"><i></i>White</button>
        </div>

        <div class="field-label">Eye Color</div>
        <div class="pick-row swatches" data-key="char_eyes">
          <button class="swatch${p.char_eyes==='sapphire'?' sel':''}" data-val="sapphire" style="--c:#3B6FD4"><i></i>Sapphire</button>
          <button class="swatch${p.char_eyes==='emerald'?' sel':''}" data-val="emerald" style="--c:#2E9C72"><i></i>Emerald</button>
          <button class="swatch${p.char_eyes==='amber'?' sel':''}" data-val="amber" style="--c:#C98A2E"><i></i>Amber</button>
          <button class="swatch${p.char_eyes==='violet'?' sel':''}" data-val="violet" style="--c:#8B5CD6"><i></i>Violet</button>
          <button class="swatch${p.char_eyes==='rose'?' sel':''}" data-val="rose" style="--c:#D45C82"><i></i>Rose</button>
          <button class="swatch${p.char_eyes==='crimson'?' sel':''}" data-val="crimson" style="--c:#C0392B"><i></i>Crimson</button>
        </div>

        <div class="field-label">Suit Accent</div>
        <div class="pick-row swatches" data-key="char_outfit">
          <button class="swatch${p.char_outfit==='cyan'?' sel':''}" data-val="cyan" style="--c:#53D7F0"><i></i>Arc Cyan</button>
          <button class="swatch${p.char_outfit==='gold'?' sel':''}" data-val="gold" style="--c:#E8B44A"><i></i>Gold</button>
          <button class="swatch${p.char_outfit==='rose'?' sel':''}" data-val="rose" style="--c:#FF8FB1"><i></i>Rose</button>
          <button class="swatch${p.char_outfit==='crimson'?' sel':''}" data-val="crimson" style="--c:#F2647C"><i></i>Crimson</button>
          <button class="swatch${p.char_outfit==='violet'?' sel':''}" data-val="violet" style="--c:#9D7BF0"><i></i>Violet</button>
        </div>

        <div class="field-label">Name your AI</div>
        <input id="settings-charname" class="text-input" value="${p.char_name || 'JARVIS'}" maxlength="24" autocomplete="off"/>
      </div>
    `;
  }

  // Re-bind file upload for custom VRM
  const vrmInput = $('#settings-vrm-input');
  if (vrmInput) vrmInput.onchange = async () => {
    const f = vrmInput.files[0]; if (!f) return;
    const st = $('#settings-vrm-status');
    if (st) st.textContent = 'Uploading…';
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch('/api/avatar/upload', { method:'POST', headers:{ Authorization:'Bearer '+state.token }, body: fd }).then(x=>x.json());
      if (r.vrm_url) {
        if (state.profile) { state.profile.vrm_path = r.vrm_url; state.profile.avatar_type = 'custom'; }
        const el = $('#dash-avatar');
        if (el) state.avatar = mountAvatar(el, state.profile);
        if (st) st.textContent = '✓ Custom VRM loaded';
        buildSettingsChar();
      } else {
        if (st) st.textContent = '✗ Upload failed';
      }
    } catch (err) {
      if (st) st.textContent = '✗ ' + err.message;
    }
  };

  // Re-bind companion cards click
  root.querySelectorAll('.companion-card').forEach(btn => {
    btn.onclick = async () => {
      const val = btn.dataset.val;
      root.querySelectorAll('.companion-card').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      const vrmArea = $('#settings-vrm-area');
      if (vrmArea) vrmArea.style.display = val === 'custom' ? 'block' : 'none';
      if (val !== 'custom') {
        const vrm_path = val === 'lia' ? '/static/LIA.vrm' : '';
        const updated = await api('/api/profile', { method:'POST', body: JSON.stringify({ avatar_type: val, vrm_path }) });
        state.profile = updated;
        const el = $('#dash-avatar');
        if (el) state.avatar = mountAvatar(el, updated);
        buildSettingsChar();
      }
    };
  });

  // Re-bind settings name input change
  const nameInput = $('#settings-charname');
  if (nameInput) {
    nameInput.onchange = async (e) => {
      const newName = e.target.value.trim() || 'JARVIS';
      await saveProfilePatch({ char_name: newName });
      $('#dash-charname').textContent = newName;
    };
  }
}
const SAMPLES = {
  jarvis_classic: 'At your service, commander. All systems are online.',
  friday: 'Hello! FRIDAY here — ready when you are.',
  nova: 'Hey! Nova online — let’s do something fun!',
  sage: 'Greetings. I am Sage. Take your time — I am listening.',
};
function speakSample(id) {
  const persona = state.voices[id];
  const u = new SpeechSynthesisUtterance(SAMPLES[id] || 'Hello, commander.');
  u.pitch = persona.pitch; u.rate = persona.rate;
  // Reuse female-first voice selection logic
  const vv2 = speechSynthesis.getVoices(); if (vv2.length) voicesReady = vv2;
  const hints2 = (persona.web_voice_hint || []);
  let v = null;
  for (const h of hints2) { v = voicesReady.find(x => x.name.toLowerCase().includes(h.toLowerCase())); if (v) break; }
  if (!v) { const inLang = voicesReady.filter(x => x.lang.startsWith('en')); v = inLang.find(x => /female|woman|zira|hazel|aria|jenny|samantha/i.test(x.name)) || inLang[0] || null; }
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
document.addEventListener('click', e => {
  const play = e.target.closest('[data-play]');
  if (play) { e.stopPropagation(); speakSample(play.dataset.play); }
});

/* ───────────────────────────── login ───────────────────────────────── */
$('#btn-login').onclick = async () => {
  const err = $('#login-error'); err.textContent = '';
  try {
    const res = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('#login-username').value, secret_word: $('#login-secret').value }),
    });
    state.token = res.token; localStorage.setItem('jarvis_token', res.token);
    state.profile = res.profile;
    enterDashboard(true);
  } catch (e) { err.textContent = e.message; }
};
$('#login-secret').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-login').click(); });
$('#btn-new-account').onclick = startOnboarding;

/* ───────────────── dashboard + WAKE-UP SEQUENCE ────────────────────── */
async function enterDashboard(freshLogin = false) {
  if (!state.profile) state.profile = await api('/api/profile');
  const p = state.profile;
  show('#screen-dash');
  $('#dash-charname').textContent = p.char_name;
  $('#commander-tag').textContent = '⚡ ' + (p.display_name || '').toUpperCase();

  // Mount LIA with correct VRM path from profile
  const avatarCfg = {
    ...p,
    vrm_path: p.vrm_path || (p.avatar_type === 'male' ? '' : '/static/LIA.vrm'),
  };
  state.avatar = mountAvatar($('#dash-avatar'), avatarCfg, { asleep: true });

  buildVoiceCards($('#settings-voices'));
  buildLangCards($('#settings-langs'));
  buildSettingsChar();

  // Mark currently selected voice/lang cards
  const p2 = state.profile;
  $$('.voice-card').forEach(c => c.classList.toggle('sel', c.dataset.val === p2.voice_persona));
  $$('.lang-card').forEach(c => c.classList.toggle('sel', c.dataset.val === p2.language_mode));

  // Check Piper availability (non-blocking)
  checkPiperStatus();

  const g = await api('/api/greeting');

  // WAKE-UP sequence
  const pod = $('#dash-pod');
  pod.classList.add('waking');
  setTimeout(async () => {
    await state.avatar.wake();
    state.avatar.wave();
    pod.classList.remove('waking');
    const bubble = $('#greet-bubble');
    bubble.hidden = false;
    typewriter($('#greet-text'), g.greeting);
    speak(g.greeting);
    addMsg('ai', g.greeting);
  }, 1300);

  addActivity('sys', 'SYSTEM', `LIA Command Center online — ${new Date().toLocaleString()}`);
  addActivity('sys', 'LIA', g.greeting);

  loadMemories();
  loadDevice();
  loadExplorer();
  loadProcesses();
  setupVoiceInterruption();
  updateAgentMonitor();
  
  // Wire mobile sensory sidebar drawer toggles
  const sensorsBtn = $('#btn-toggle-sensors-panel');
  const sensorsCloseBtn = $('#btn-close-sensors-panel');
  const sidebar = $('#dash-right-sidebar');
  if (sensorsBtn && sidebar) {
    sensorsBtn.onclick = () => {
      sidebar.classList.add('active');
      if (!state.webcamActive) {
        const webcamToggle = $('#btn-toggle-webcam');
        if (webcamToggle) webcamToggle.click();
      }
    };
  }
  if (sensorsCloseBtn && sidebar) {
    sensorsCloseBtn.onclick = () => {
      sidebar.classList.remove('active');
    };
  }

  // HUD + agent monitor update timer
  setInterval(() => { loadDevice(); updateAgentMonitor(); }, 3000);
}

function typewriter(el, text, i = 0) {
  el.textContent = text.slice(0, i);
  if (i <= text.length) setTimeout(() => typewriter(el, text, i + 1), 22);
}

$('#btn-logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  speechSynthesis.cancel();
  stopWebcamSensor();
  state.token = null; state.profile = null;
  localStorage.removeItem('jarvis_token');
  location.reload();
};

/* tabs */
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tab-panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $(`[data-panel="${t.dataset.tab}"]`).classList.add('active');
  if (t.dataset.tab === 'memory') loadMemories();
  if (t.dataset.tab === 'device') { loadDevice(); loadProcesses(); }
  if (t.dataset.tab === 'files') loadExplorer();
});

/* ────────────────────────────── chat ───────────────────────────────── */
function addMsg(who, text, cls = '') {
  const div = document.createElement('div');
  div.className = `msg ${who} ${cls}`;
  div.textContent = text;
  $('#chat-log').appendChild(div);
  $('#chat-log').scrollTop = 1e9;
  // Mirror to activity feed
  addActivity(who === 'ai' ? 'ai' : 'user', who === 'ai' ? 'LIA' : 'YOU', text);
  return div;
}

/* ─────────────────────────── activity feed ─────────────────────────── */
function addActivity(type, tag, msg) {
  const feed = $('#activity-feed');
  if (!feed) return;
  const now = new Date();
  const t = now.getHours().toString().padStart(2,'0') + ':' +
            now.getMinutes().toString().padStart(2,'0');
  const entry = document.createElement('div');
  entry.className = `af-entry ${type}`;
  entry.innerHTML = `<span class="af-time">${t}</span><span class="af-tag">${tag}</span><span class="af-msg">${msg}</span>`;
  feed.appendChild(entry);
  feed.scrollTop = 1e9;
  // Keep feed to 200 entries max
  while (feed.children.length > 200) feed.removeChild(feed.firstChild);
}

function updateAgentMonitor() {
  // Update Piper TTS dot based on availability
  const piperDot = document.getElementById('am-piper-dot');
  if (piperDot) piperDot.className = 'am-dot' + (state.piperAvailable ? ' active' : '');
  const visionDot = document.getElementById('am-vision-dot');
  if (visionDot) visionDot.className = 'am-dot' + (state.webcamActive ? ' active' : '');
}

async function sendMessage(text) {
  text = (text || $('#chat-input').value).trim();
  if (!text) return;
  $('#chat-input').value = '';
  addMsg('user', text);
  const thinking = addMsg('ai', '…', 'thinking');
  try {
    const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
    thinking.remove();
    addMsg('ai', res.reply);
    
    // Set 3D avatar expression
    if (res.emotion && state.avatar) {
      state.avatar.setEmotion(res.emotion);
    }
    
    // Display code preview
    if (res.engine === 'coder' && res.code) {
      const pre = document.createElement('pre');
      pre.className = 'code-block';
      pre.innerHTML = `<div class="code-head">📄 ${res.filename || 'code'} — opened in your editor</div><code></code>`;
      pre.querySelector('code').textContent = res.code;
      $('#chat-log').appendChild(pre);
      $('#chat-log').scrollTop = 1e9;
    }

    // Display generated image preview
    if (res.engine === 'image' && res.image_url) {
      const imgBlock = document.createElement('div');
      imgBlock.className = 'image-block';
      imgBlock.innerHTML = `
        <div class="image-head">🎨 Generated Image: ${res.filename || 'image'}</div>
        <div class="image-body">
          <img src="${res.image_url}" alt="Generated Image" />
        </div>
      `;
      $('#chat-log').appendChild(imgBlock);
      $('#chat-log').scrollTop = 1e9;
    }

    // Display web search results card
    if (res.search_results && res.search_results.length) {
      const escapeHtml = str => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const searchBlock = document.createElement('div');
      searchBlock.className = 'search-block';
      
      let itemsHtml = '';
      res.search_results.forEach(r => {
        itemsHtml += `
          <div class="search-item">
            <a href="${r.link}" target="_blank" class="search-title">${escapeHtml(r.title)}</a>
            <div class="search-url">${escapeHtml(r.link)}</div>
            <div class="search-snippet">${escapeHtml(r.snippet)}</div>
          </div>
        `;
      });
      
      searchBlock.innerHTML = `
        <div class="search-head">🔍 Google Search: "${escapeHtml(res.search_query)}"</div>
        <div class="search-body">${itemsHtml}</div>
      `;
      $('#chat-log').appendChild(searchBlock);
      $('#chat-log').scrollTop = 1e9;
    }
    
    // Handle desktop tasks requiring security prompts
    if (res.task) {
      promptSecureApproval(res.task);
    }

    const engineLabel =
      res.engine === 'ollama' ? 'Local LLM · Ollama' :
      res.engine === 'coder'  ? 'Coder · wrote a file' :
      res.engine === 'image'  ? 'Image Gen · Pollinations' :
      state.piperAvailable    ? 'Piper TTS · ready'    : 'Browser TTS · ready';
    $('#engine-status').textContent = engineLabel;

    if (res.emotion) addActivity('ai', 'EMOTION', res.emotion.toUpperCase());
    state.lastDetectedLanguage = res.language_detected;
    speak(res.reply, { language: res.language_detected });
  } catch (e) { thinking.textContent = '⚠ ' + e.message; thinking.classList.remove('thinking'); }
}
$('#btn-send').onclick = () => sendMessage();
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

/* mic — Web Speech API (Chrome/Edge) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const rec = new SR();
  rec.interimResults = false;
  let isListening = false;
  $('#btn-mic').onclick = () => {
    if (isListening) {
      rec.stop();
      return;
    }
    const p = state.profile || state.draft || {};
    let recLang = state.ttsLang[p.language_mode] || 'en-IN';
    if (state.lastDetectedLanguage === 'gujarati' || p.language_mode === 'english_gujarati') {
      recLang = 'gu-IN';
    }
    rec.lang = recLang;
    $('#btn-mic').classList.add('listening');
    try {
      rec.start();
      isListening = true;
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
      $('#btn-mic').classList.remove('listening');
      isListening = false;
    }
  };
  rec.onresult = e => sendMessage(e.results[0][0].transcript);
  rec.onend = () => {
    isListening = false;
    $('#btn-mic').classList.remove('listening');
  };
  rec.onerror = () => {
    isListening = false;
    $('#btn-mic').classList.remove('listening');
  };
} else {
  $('#btn-mic').title = 'Voice input needs Chrome or Edge';
}

/* ──────────────────────── Voice Interruption ────────────────────────── */
function setupVoiceInterruption() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    microphone.connect(analyser);

    // Poll the analyser with setInterval — avoids deprecated ScriptProcessorNode
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) sum += freqData[i];
      const average = sum / freqData.length;

      // If user speaks loud enough while AI is speaking, interrupt it
      // Disabled to prevent self-interruption from speaker playback.
      /*
      if (average > 38 && speechSynthesis.speaking) {
        speechSynthesis.cancel();
        if (state.avatar) state.avatar.stopSpeaking();
        if (state.callAvatar) state.callAvatar.stopSpeaking();
      }
      */
    }, 80); // ~12.5 fps — sufficient for interruption detection
  }).catch(err => console.warn("Voice interruption mic connection failed:", err));
}

/* ──────────────────────── Secure Desktop Automation Modal ──────────── */
function promptSecureApproval(task) {
  state.activeTaskToApprove = task;
  $('#approval-task-type').textContent = task.type === 'launch_app' ? 'Launch Application' : 'Run Terminal Command';
  $('#approval-task-target').textContent = task.type === 'launch_app' ? task.app : task.command;
  $('#execution-approval-overlay').classList.add('active');
}

$('#btn-approve-task').onclick = async () => {
  const task = state.activeTaskToApprove;
  if (!task) return;
  $('#execution-approval-overlay').classList.remove('active');
  state.activeTaskToApprove = null;

  try {
    const taskName = task.type === 'launch_app' ? task.app : (task.type === 'list_files' ? 'list files' : task.command);
    addMsg('ai', `Approved. Executing: ${taskName}...`);
    const payload = {
      task_type: task.type,
      target: task.type === 'launch_app' ? task.app : (task.type === 'list_files' ? '' : task.command)
    };
    const res = await api('/api/desktop/execute', { method: 'POST', body: JSON.stringify(payload) });
    
    if (task.type === 'execute_command') {
      const statusClass = res.ok ? 'sys' : 'err';
      const termOutput = $('#terminal-stdout');
      
      const cmdLine = document.createElement('div');
      cmdLine.className = 'term-line cmd';
      cmdLine.textContent = `$ ${task.command}`;
      
      const outLine = document.createElement('div');
      outLine.className = `term-line ${statusClass}`;
      outLine.textContent = res.ok ? res.stdout : res.stderr;
      
      termOutput.appendChild(cmdLine);
      termOutput.appendChild(outLine);
      termOutput.scrollTop = 1e9;
      
      addMsg('ai', res.ok ? "Task executed successfully. Logs printed in shell." : "Task failed. Check shell logs.");
    } else if (task.type === 'list_files') {
      loadExplorer();
      addMsg('ai', "Workspace files list refreshed successfully.");
    } else {
      addMsg('ai', res.message || "App launched successfully.");
    }
  } catch (e) {
    addMsg('ai', `Security Execution Error: ${e.message}`);
  }
};

$('#btn-deny-task').onclick = () => {
  $('#execution-approval-overlay').classList.remove('active');
  state.activeTaskToApprove = null;
  addMsg('ai', "Action denied by commander.");
};

/* ──────────────────────── Workspace File Explorer ────────────────── */
async function loadExplorer(path = null) {
  try {
    const queryPath = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await api(`/api/desktop/files${queryPath}`);
    
    const list = $('#explorer-file-list');
    list.innerHTML = '';
    
    if (res.files && res.files.length) {
      res.files.forEach(f => {
        const li = document.createElement('li');
        const icon = f.is_dir ? '📁' : '📄';
        const size = f.is_dir ? '' : ` (${formatBytes(f.size)})`;
        li.innerHTML = `<span class="icon">${icon}</span><span class="f-name">${f.name}</span><span class="f-size">${size}</span>`;
        
        li.onclick = () => {
          if (f.is_dir) {
            state.currentPath = f.path;
            $('#current-file-path').textContent = f.path;
            loadExplorer(f.path);
          } else {
            addMsg('user', `explain file ${f.name}`);
            sendMessage(`Explain the purpose of this file: ${f.path}`);
          }
        };
        list.appendChild(li);
      });
    } else {
      list.innerHTML = '<li class="dim">Folder is empty.</li>';
    }
  } catch (e) {
    $('#explorer-file-list').innerHTML = `<li class="err">Failed to read workspace: ${e.message}</li>`;
  }
}

$('#btn-up-dir').onclick = () => {
  const parts = state.currentPath.split('/');
  if (parts.length > 1) {
    parts.pop();
    const upPath = parts.join('/');
    state.currentPath = upPath;
    $('#current-file-path').textContent = upPath;
    loadExplorer(upPath);
  }
};

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* ──────────────────────── Terminal Shell Runs ──────────────────────── */
$('#btn-run-terminal').onclick = () => {
  const input = $('#terminal-input').value.trim();
  if (!input) return;
  $('#terminal-input').value = '';
  
  // Route to the security approval panel
  promptSecureApproval({
    type: 'execute_command',
    command: input
  });
};
$('#terminal-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-run-terminal').click(); });

/* ──────────────────────── Active System Processes ──────────────────── */
async function loadProcesses() {
  try {
    const res = await api('/api/device/processes');
    const tbody = $('#process-list-body');
    tbody.innerHTML = '';
    
    if (res.processes && res.processes.length) {
      res.processes.slice(0, 15).forEach(p => { // Top 15 in UI
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.pid}</td>
          <td>${p.name || 'Unknown'}</td>
          <td>${p.cpu_percent ? p.cpu_percent.toFixed(1) : '0.0'}%</td>
          <td>${p.memory_percent ? p.memory_percent.toFixed(1) : '0.0'}%</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="4" class="center dim">No processes list.</td></tr>';
    }
  } catch (e) {
    $('#process-list-body').innerHTML = `<tr><td colspan="4" class="center err">Sensor failed: ${e.message}</td></tr>`;
  }
}

/* ──────────────────────── Sensory Webcam FaceMesh & Hands ────────── */
let trackerFace = null;
let trackerHands = null;
let webcamCamera = null;

async function setupMediaPipeSensors() {
  const videoElement = $('#webcam-video');
  const canvasElement = $('#webcam-overlay');
  const canvasCtx = canvasElement.getContext('2d');
  
  // Set canvas dimension matching container
  canvasElement.width = videoElement.clientWidth || 320;
  canvasElement.height = videoElement.clientHeight || 240;

  // 1. FaceMesh Setup
  trackerFace = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  
  trackerFace.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  trackerFace.onResults(results => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      // Update Presence Metric
      const presentCard = $('#tel-presence');
      presentCard.textContent = "Present";
      presentCard.className = "value active";

      // Draw custom Cyber Mesh face points in neon blue
      canvasCtx.fillStyle = '#53D7F0';
      canvasCtx.strokeStyle = 'rgba(83, 215, 240, 0.4)';
      canvasCtx.lineWidth = 0.5;
      
      landmarks.forEach((pt, i) => {
        if (i % 6 !== 0) return; // Sparse landmarks for sci-fi look
        const x = pt.x * canvasElement.width;
        const y = pt.y * canvasElement.height;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 1, 0, 2 * Math.PI);
        canvasCtx.fill();
      });

      // Face Pose Angle math (Euler Yaw and Pitch)
      const noseTip = landmarks[4];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      
      // Tilt head of 3D avatar based on nose relative center
      const yaw = -(noseTip.x - 0.5);
      const pitch = -(noseTip.y - 0.5);
      if (state.avatar) {
        state.avatar.lookAt(yaw * 1.5, pitch * 1.5);
      }

      // Attention score check
      const eyeDist = Math.abs(leftEye.x - rightEye.x);
      const attentionCard = $('#tel-attention');
      if (Math.abs(yaw) < 0.12) {
        attentionCard.textContent = "Focused";
        attentionCard.style.color = "#10B981";
      } else {
        attentionCard.textContent = "Distracted";
        attentionCard.style.color = "#F59E0B";
      }

      // Smile Recognition
      const lipLeft = landmarks[61];
      const lipRight = landmarks[291];
      const lipTop = landmarks[13];
      const lipBottom = landmarks[14];
      
      const lipWidth = Math.sqrt(Math.pow(lipLeft.x - lipRight.x, 2) + Math.pow(lipLeft.y - lipRight.y, 2));
      const lipHeight = Math.sqrt(Math.pow(lipTop.x - lipBottom.x, 2) + Math.pow(lipTop.y - lipBottom.y, 2));
      
      const smileRatio = lipWidth / (lipHeight || 0.01);
      const expressionCard = $('#tel-expression');
      
      if (smileRatio > 5.5) {
        expressionCard.textContent = "Smile Detected";
        expressionCard.style.color = "#10B981";
        
        // Dynamic smile reaction trigger
        if (state.avatar) state.avatar.setEmotion('happy');
        sendTelemetryEvent("smile", "Smiling at JARVIS");
      } else {
        expressionCard.textContent = "Neutral";
        expressionCard.style.color = "#53D7F0";
      }
    } else {
      // User Left Desk
      const presentCard = $('#tel-presence');
      presentCard.textContent = "Absent";
      presentCard.className = "value";
      $('#tel-attention').textContent = "--";
      $('#tel-expression').textContent = "--";
    }
  });

  // 2. Hands Detection
  trackerHands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  trackerHands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  let lastWaveTime = 0;
  trackerHands.onResults(results => {
    const gestureCard = $('#tel-gesture');
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw green dots on hands
      canvasCtx.fillStyle = '#10B981';
      landmarks.forEach(pt => {
        const x = pt.x * canvasElement.width;
        const y = pt.y * canvasElement.height;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 2.5, 0, 2 * Math.PI);
        canvasCtx.fill();
      });

      // Wave Detection (checking horizontal velocity of fingers relative to wrist)
      const wrist = landmarks[0];
      const indexFinger = landmarks[8];
      const speed = Math.abs(indexFinger.x - wrist.x);
      
      const nowMs = Date.now();
      if (speed > 0.35 && (nowMs - lastWaveTime) > 4000) {
        lastWaveTime = nowMs;
        gestureCard.textContent = "Wave";
        gestureCard.style.color = "#10B981";
        
        // Avatar waves back
        if (state.avatar) state.avatar.wave();
        sendTelemetryEvent("hand_wave", "Hand waving detected");
      }
    } else {
      gestureCard.textContent = "--";
      gestureCard.style.color = "var(--text-dim)";
    }
  });

  // Start Camera Capture Feed
  state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
  videoElement.srcObject = state.cameraStream;
  videoElement.play();

  // MediaPipe orchestration loops
  webcamCamera = new Camera(videoElement, {
    onFrame: async () => {
      if (!state.webcamActive) return;
      await trackerFace.send({ image: videoElement });
      await trackerHands.send({ image: videoElement });
    },
    width: 320,
    height: 240
  });
  
  webcamCamera.start();
}

async function sendTelemetryEvent(evt, details) {
  try {
    await api('/api/vision/telemetry', {
      method: 'POST',
      body: JSON.stringify({ event: evt, meta: details })
    });
  } catch (err) {}
}

function stopWebcamSensor(errorText = "Vision Sensors Inactive") {
  state.webcamActive = false;
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
  }
  if (webcamCamera) {
    webcamCamera.stop();
  }
  const placeholder = $('#webcam-placeholder');
  if (placeholder) {
    placeholder.style.opacity = '1';
    placeholder.textContent = errorText;
  }
  $('#btn-toggle-webcam').textContent = "Engage Vision Sensors";
  $('#tel-presence').textContent = "Offline";
  $('#tel-presence').className = "value";
  $('#tel-attention').textContent = "--";
  $('#tel-expression').textContent = "--";
  $('#tel-gesture').textContent = "--";
}

$('#btn-toggle-webcam').onclick = async () => {
  if (state.webcamActive) {
    stopWebcamSensor();
  } else {
    try {
      state.webcamActive = true;
      $('#btn-toggle-webcam').textContent = "Stop Vision Sensors";
      const placeholder = $('#webcam-placeholder');
      if (placeholder) placeholder.textContent = "Connecting…";
      $('#webcam-placeholder').style.opacity = '0';
      await setupMediaPipeSensors();
    } catch (err) {
      console.warn("Failed to activate webcam sensor:", err);
      let errMsg = "Vision Sensors Inactive";
      if (err.name === "NotReadableError") {
        errMsg = "Error: Camera is in use by another application.";
      } else if (err.name === "NotAllowedError") {
        errMsg = "Error: Camera permission was denied.";
      } else if (err.name === "NotFoundError") {
        errMsg = "Error: No camera hardware found.";
      } else {
        errMsg = "Error: Could not start video source.";
      }
      stopWebcamSensor(errMsg);
    }
  }
};

/* ─────────────────────────── memory panel ──────────────────────────── */
async function loadMemories() {
  const list = await api('/api/memories').catch(() => []);
  $('#memory-list').innerHTML = list.length
    ? list.map(m => `<li><span class="cat">${m.category}</span>${m.content}</li>`).join('')
    : '<li class="dim">Nothing yet — chat with your AI or teach it something above.</li>';
}
$('#btn-add-memory').onclick = async () => {
  const v = $('#memory-input').value.trim();
  if (!v) return;
  await api('/api/memories', { method: 'POST', body: JSON.stringify({ content: v, category: 'fact' }) }).catch(() => {});
  $('#memory-input').value = '';
  loadMemories();
};

/* ──────────────── device / process / explorer ─────────────────── */
async function loadDevice() {
  const d = await api('/api/device').catch(() => null);
  if (!d) return;
  $('#hud-cpu').textContent = (d.cpu_percent ?? '--') + '%';
  $('#hud-ram').textContent = (d.ram_percent ?? '--') + '%';
  $('#hud-bat').textContent = d.battery != null ? d.battery + '%' : '--';
  const grid = $('#device-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(d).map(([k, v]) =>
    `<div class="stat-card glass"><div class="stat-val">${v}</div><div class="stat-lbl">${k}</div></div>`
  ).join('');
}

/* ─────────────────────────── live call ──────────────────────────── */
let callRec = null, autoRestartRec = false;
let _callAudioCtx = null, _callAnalyser = null, _callSource = null, _callStream = null;

function setCallStatus(text, dotClass) {
  const el = $('#call-status-text');
  if (el) el.textContent = text;
  const dot = $('#call-status-dot');
  if (!dot) return;
  dot.className = 'call-status-dot';
  if (dotClass) dot.classList.add(dotClass);
}

async function startMicVisualizer() {
  try {
    _callStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _callAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _callAnalyser = _callAudioCtx.createAnalyser();
    _callAnalyser.fftSize = 32;
    _callSource = _callAudioCtx.createMediaStreamSource(_callStream);
    _callSource.connect(_callAnalyser);
    const buf = new Uint8Array(_callAnalyser.frequencyBinCount);
    const userBars = $$('#user-waveform .bar');
    const liaBars  = $$('.call-lia-wave .cw-bar');
    function draw() {
      if (!state.inCall) return;
      requestAnimationFrame(draw);
      _callAnalyser.getByteFrequencyData(buf);
      userBars.forEach((b, i) => {
        const v = buf[i % buf.length] || 0;
        b.style.height = Math.max(4, (v / 255) * 28) + 'px';
      });
    }
    draw();
    // LIA wave driven by TTS audio context separately via _driveLiaCallWave
    _driveLiaCallWave();
  } catch(e) { console.warn('Mic visualizer:', e); }
}

function _driveLiaCallWave() {
  const bars = $$('.call-lia-wave .cw-bar');
  if (!bars.length) return;
  // Use the shared TTS audio context from Piper playback when available
  function frame() {
    if (!state.inCall) { bars.forEach(b => b.style.height = '8px'); return; }
    requestAnimationFrame(frame);
    const ctx = _audioCtxTTS;
    if (!ctx || !ctx._analyserNode) {
      // Animate idle wave while waiting for TTS
      const t = Date.now() / 180;
      bars.forEach((b, i) => { b.style.height = (8 + Math.sin(t + i * 0.7) * 6) + 'px'; });
      return;
    }
    const buf2 = new Uint8Array(ctx._analyserNode.frequencyBinCount);
    ctx._analyserNode.getByteFrequencyData(buf2);
    bars.forEach((b, i) => {
      const v = buf2[i % buf2.length] || 0;
      b.style.height = Math.max(8, (v / 255) * 44) + 'px';
    });
  }
  frame();
}

function stopMicVisualizer() {
  if (_callStream) _callStream.getTracks().forEach(t => t.stop());
  if (_callAudioCtx) _callAudioCtx.close();
  _callStream = null; _callAudioCtx = null; _callSource = null; _callAnalyser = null;
}

function startCallRecognition() {
  if (!SR) { setCallStatus('NO MIC SUPPORT', 'pulse-gold'); return; }
  callRec = new SR();
  callRec.interimResults = false;
  callRec.continuous = true;
  const p = state.profile || {};
  let recLang = state.ttsLang[p.language_mode] || 'en-IN';
  if (state.lastDetectedLanguage === 'gujarati' || p.language_mode === 'english_gujarati') {
    recLang = 'gu-IN';
  }
  callRec.lang = recLang;
  callRec.onstart = () => { if (state.inCall) setCallStatus('LISTENING…', 'pulse-green'); };
  callRec.onresult = async (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        text = e.results[i][0].transcript.trim();
        break;
      }
    }
    if (!text) return;
    autoRestartRec = false;
    try { if (callRec) callRec.stop(); } catch(e) {}
    setCallStatus('THINKING…', 'pulse-gold');
    addMsg('user', text);
    try {
      const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
      addMsg('ai', res.reply);
      state.lastDetectedLanguage = res.language_detected;
      if (res.emotion && state.callAvatar) {
        state.callAvatar.setEmotion(res.emotion);
      }
      setCallStatus('SPEAKING…', 'pulse-blue');
      speak(res.reply, {
        language: res.language_detected,
        onend: () => {
          if (state.inCall) { autoRestartRec = true; try { callRec.start(); } catch(err){} }
        }
      });
    } catch(err) {
      addMsg('ai', '⚠ ' + err.message);
      state.callAvatar?.setEmotion('concerned');
      speak('I encountered an error. Please try again.', {
        onend: () => {
          if (state.inCall) { autoRestartRec = true; try { callRec.start(); } catch(err){} }
        }
      });
    }
  };
  callRec.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    if (state.inCall && autoRestartRec) {
      const delay = e.error === 'no-speech' ? 800 : 300;
      setTimeout(() => { try { callRec.start(); } catch(err){} }, delay);
    }
  };
  callRec.onend = () => {
    if (state.inCall && autoRestartRec) setTimeout(() => { try { callRec.start(); } catch(err){} }, 300);
  };
  autoRestartRec = true;
  try { callRec.start(); } catch(err) { console.warn('Failed to start recognition:', err); }
}

function stopCallRecognition() {
  autoRestartRec = false;
  if (callRec) { try { callRec.stop(); } catch(e){} }
  callRec = null;
}

// Start user webcam in call
async function _startCallCam() {
  const vid = $('#call-webcam');
  if (!vid) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    vid.srcObject = s;
    state.callCamOn = true;
    state._callCamStream = s;
    vid.style.display = '';
    const btn = $('#btn-call-cam');
    if (btn) { btn.classList.remove('off'); btn.textContent = '📷'; }
  } catch(e) {
    const vid2 = $('#call-webcam');
    if (vid2) vid2.style.display = 'none';
    console.warn('Call cam:', e);
    let errorMsg = 'CAMERA ERROR';
    if (e.name === 'NotReadableError') {
      errorMsg = 'CAMERA IN USE';
    } else if (e.name === 'NotAllowedError') {
      errorMsg = 'CAMERA DENIED';
    }
    setCallStatus(errorMsg, 'pulse-red');
  }
}
function _stopCallCam() {
  if (state._callCamStream) { state._callCamStream.getTracks().forEach(t => t.stop()); state._callCamStream = null; }
  const vid = $('#call-webcam'); if (vid) vid.srcObject = null;
  state.callCamOn = false;
}

$('#btn-live-call').onclick = async () => {
  if (!state.profile) return;

  // Clean up dashboard avatar to release WebGL context and resources
  if (state.avatar) {
    if (state.avatar._cleanup) state.avatar._cleanup();
    state.avatar = null;
  }

  // Release dashboard camera first to prevent NotReadableError source lock
  state.restoreWebcamAfterCall = state.webcamActive;
  if (state.webcamActive) {
    stopWebcamSensor();
  }

  state.inCall = true; state.isMuted = false; state.callCamOn = false;
  $('#live-call-overlay').classList.add('active');
  $('#btn-call-mute').classList.remove('muted');
  const nameEl = document.getElementById('call-lia-name');
  if (nameEl) nameEl.textContent = state.profile.char_name || 'LIA';
  // Mount full VRM avatar with full-size rendering
  const callCfg = {
    ...state.profile,
    vrm_path: state.profile.vrm_path || (state.profile.avatar_type === 'male' ? '' : '/static/LIA.vrm'),
  };
  state.callAvatar = mountAvatar($('#call-avatar'), callCfg);
  // Wake with a slight delay so the full-screen canvas initialises at correct size
  setTimeout(async () => {
    if (state.callAvatar) {
      await state.callAvatar.wake();
      state.callAvatar.gesture('friendly');
      // Cycle through gestures during idle in call
      state._callGestureInterval = setInterval(() => {
        if (!state.inCall || !state.callAvatar) return;
        const g = ['friendly', 'listening', 'talking', 'idle'][Math.floor(Math.random() * 4)];
        if (state.callAvatar.gesture) state.callAvatar.gesture(g);
      }, 8000);
    }
  }, 300);
  _startCallCam();
  await startMicVisualizer();
  startCallRecognition();
  setCallStatus('READY', 'pulse-green');
};

function hangUpCall() {
  state.inCall = false;
  speechSynthesis.cancel();
  $('#live-call-overlay').classList.remove('active');
  stopMicVisualizer();
  stopCallRecognition();
  _stopCallCam();
  // Clear call gesture cycling interval
  if (state._callGestureInterval) {
    clearInterval(state._callGestureInterval);
    state._callGestureInterval = null;
  }
  if (state.callAvatar) {
    if (state.callAvatar._cleanup) state.callAvatar._cleanup();
    state.callAvatar = null;
  }
  setCallStatus('CONNECTING…', null);

  // Remount dashboard avatar since it was cleaned up
  const avatarCfg = {
    ...state.profile,
    vrm_path: state.profile.vrm_path || (state.profile.avatar_type === 'male' ? '' : '/static/LIA.vrm'),
  };
  state.avatar = mountAvatar($('#dash-avatar'), avatarCfg);
  setTimeout(async () => {
    if (state.avatar) {
      await state.avatar.wake();
    }
  }, 100);

  // Restore dashboard webcam if it was active before the call
  if (state.restoreWebcamAfterCall) {
    state.restoreWebcamAfterCall = false;
    setTimeout(async () => {
      try {
        state.webcamActive = true;
        const btn = $('#btn-toggle-webcam');
        if (btn) btn.textContent = "Stop Vision Sensors";
        const placeholder = $('#webcam-placeholder');
        if (placeholder) placeholder.style.opacity = '0';
        await setupMediaPipeSensors();
      } catch (err) {
        console.warn("Failed to restore dashboard webcam:", err);
        stopWebcamSensor();
      }
    }, 500);
  }
}

$('#btn-end-call').onclick = hangUpCall;
$('#btn-close-call').onclick = hangUpCall;

$('#btn-call-mute').onclick = () => {
  if (!state.inCall) return;
  state.isMuted = !state.isMuted;
  $('#btn-call-mute').classList.toggle('muted', state.isMuted);
  if (state.isMuted) { stopCallRecognition(); setCallStatus('MUTED', 'pulse-gold'); }
  else { startCallRecognition(); }
};

$('#btn-call-cam').onclick = () => {
  if (state.callCamOn) {
    _stopCallCam();
    $('#btn-call-cam').classList.add('off');
    $('#btn-call-cam').textContent = '🚫';
  } else {
    _startCallCam();
  }
};

boot();
