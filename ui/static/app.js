/* JARVIS AI — front-end app
 * Flow: boot → (no users? onboarding : login) → wake-up sequence → dashboard
 */
import { buildAnime } from './anime.js?v=4.3.7';

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
  charEditing: false,   // settings "Edit Character" flow active
  charDraft: null,      // staged appearance changes, applied on "Update"
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

let speechQueue = [];
let currentlySpeakingItem = null;
let streamOnEndCallback = null;
let streamSpeechDone = false;

function stopSpeaking() {
  speechQueue.forEach(item => {
    item.state = 'played';
  });
  speechQueue = [];
  currentlySpeakingItem = null;
  speechSynthesis.cancel();
  if (state.activeAudioSource) {
    try { state.activeAudioSource.stop(); } catch(e){}
    state.activeAudioSource = null;
  }
  if (state.avatar) {
    state.avatar.setViseme('rest');
    state.avatar.stopSpeaking();
    state.avatar.setEmotion('neutral');
  }
  if (state.callAvatar) {
    state.callAvatar.setViseme('rest');
    state.callAvatar.stopSpeaking();
    state.callAvatar.setEmotion('neutral');
  }
}

function speak(text, { onend, language } = {}) {
  if (!text) { onend && onend(); return; }
  stopSpeaking();
  
  streamOnEndCallback = onend || null;
  streamSpeechDone = true;
  
  const p = state.profile || state.draft || {};
  const isGujarati = /[\u0A80-\u0AFF]/.test(text) || language === 'gujarati' || p.language_mode === 'english_gujarati';
  
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text];
  sentences.forEach(sentence => {
    const clean = sentence.trim();
    if (clean) {
      enqueueSpeech(clean, isGujarati);
    }
  });
}

function enqueueSpeech(sentence, isGujarati) {
  const p = state.profile || state.draft || {};
  const hasIndicScript = /[\u0900-\u0D7F]/.test(sentence);
  const isLanguageGujarati = isGujarati || /[\u0A80-\u0AFF]/.test(sentence) || p.language_mode === 'english_gujarati';

  // Determine if this is Indian language/accent that needs browser voice
  const isIndianLanguage = p.language_mode && (
    p.language_mode.includes('gujarati') ||
    p.language_mode.includes('hindi') ||
    p.language_mode.includes('tamil') ||
    p.language_mode.includes('marathi') ||
    p.language_mode.includes('bengali')
  );

  // Use browser Speech API for Indian languages (better accent support)
  // Use Piper only for standard English
  const usePiper = state.piperAvailable && !isIndianLanguage;

  const item = {
    text: sentence,
    state: usePiper ? 'loading' : 'loaded',
    audioBuffer: null,
    usePiper: usePiper,
    isGujarati: isLanguageGujarati,
    languageMode: p.language_mode
  };

  speechQueue.push(item);

  if (usePiper) {
    fetchAudio(item);
  } else {
    processSpeechQueue();
  }
}

async function fetchAudio(item) {
  try {
    const p = state.profile || state.draft || {};
    const personaId = p.voice_persona || 'friday';
    let url = `/api/tts?text=${encodeURIComponent(item.text)}&voice=${encodeURIComponent(personaId)}`;

    // Pass language to TTS endpoint if set
    if (item.ttsLanguage) {
      url += `&language=${encodeURIComponent(item.ttsLanguage)}`;
    }

    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + state.token } });
    if (!res.ok) throw new Error('TTS server error');
    const arrayBuf = await res.arrayBuffer();
    const ctx = getAudioCtx();
    item.audioBuffer = await ctx.decodeAudioData(arrayBuf);
    item.state = 'loaded';
    processSpeechQueue();
  } catch (err) {
    console.warn('Failed to prefetch audio:', err);
    item.state = 'fallback';
    processSpeechQueue();
  }
}

function processSpeechQueue() {
  if (currentlySpeakingItem) {
    return;
  }
  
  const nextItem = speechQueue.find(i => i.state !== 'played');
  if (!nextItem) {
    if (streamSpeechDone && streamOnEndCallback) {
      const cb = streamOnEndCallback;
      streamOnEndCallback = null;
      streamSpeechDone = false;
      cb();
    }
    return;
  }
  
  if (nextItem.state === 'loading') {
    return;
  }
  
  currentlySpeakingItem = nextItem;
  
  const onEnd = () => {
    nextItem.state = 'played';
    currentlySpeakingItem = null;
    processSpeechQueue();
  };
  
  if (nextItem.state === 'loaded' && nextItem.audioBuffer) {
    playAudioBuffer(nextItem.audioBuffer, onEnd);
  } else {
    const p = state.profile || state.draft || {};
    const persona = state.voices[p.voice_persona] || { pitch: 1, rate: 1 };
    nextItem.state = 'playing';
    _speakBrowser(nextItem.text, persona, p, onEnd, nextItem.languageMode);
  }
}

function playAudioBuffer(audioBuf, onend) {
  try {
    const ctx = getAudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const dataArr = new Uint8Array(analyser.frequencyBinCount);

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    ctx._analyserNode = analyser;
    state.activeAudioSource = source;

    if (state.avatar) { 
      state.avatar.stopSpeaking(); 
      state.avatar.gesture('talking'); 
    }
    if (state.callAvatar) { 
      state.callAvatar.stopSpeaking(); 
      state.callAvatar.gesture('talking'); 
    }

    const visualizerBars = document.querySelectorAll('#voice-visualizer .vv-bar');
    const callBars = document.querySelectorAll('.call-lia-wave .cw-bar');

    let raf;
    let lastViseme = 'rest';
    let visemeSmoothing = 0;

    function driveVisemes() {
      analyser.getByteFrequencyData(dataArr);

      const lowFreq  = dataArr.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const midFreq  = dataArr.slice(4, 14).reduce((a, b) => a + b, 0) / 10;
      const highFreq = dataArr.slice(14, 28).reduce((a, b) => a + b, 0) / 14;
      const presFreq = dataArr.slice(28, 48).reduce((a, b) => a + b, 0) / 20;

      const lowNorm  = Math.min(1, lowFreq  / 180);
      const midNorm  = Math.min(1, midFreq  / 160);
      const highNorm = Math.min(1, highFreq / 140);
      const presNorm = Math.min(1, presFreq / 120);

      const openness = Math.min(1, (lowNorm * 0.65 + midNorm * 0.35) * 1.5);

      let vis = 'rest';
      if (openness > 0.70) {
        vis = presNorm > 0.55 ? 'A' : (highNorm > 0.55 ? 'O' : 'A');
      } else if (openness > 0.50) {
        vis = highNorm > 0.45 ? 'E' : (midNorm > 0.50 ? 'O' : 'E');
      } else if (openness > 0.28) {
        vis = presNorm > 0.35 ? 'I' : (highNorm > 0.35 ? 'E' : 'I');
      } else if (openness > 0.12) {
        vis = midNorm > 0.25 ? 'M' : 'F';
      } else {
        vis = 'rest';
      }

      if (vis !== lastViseme) {
        visemeSmoothing = 0.2;
        lastViseme = vis;
      }

      if (state.avatar) state.avatar.setViseme(vis);
      if (state.callAvatar) state.callAvatar.setViseme(vis);

      if (visualizerBars.length) {
        for (let i = 0; i < visualizerBars.length; i++) {
          const val = dataArr[i] || 0;
          const h = Math.max(3, (val / 255) * 32);
          visualizerBars[i].style.height = h + 'px';
        }
      }

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
      state.activeAudioSource = null;
      if (state.avatar) { 
        state.avatar.setViseme('rest'); 
        state.avatar.stopSpeaking();
        setTimeout(() => state.avatar && state.avatar.gesture('idle'), 500);
      }
      if (state.callAvatar) { 
        state.callAvatar.setViseme('rest'); 
        state.callAvatar.stopSpeaking();
        setTimeout(() => state.callAvatar && state.callAvatar.gesture('idle'), 500);
      }
      onend && onend();
    };

    source.start(0);
  } catch (err) {
    console.warn('Audio playback error:', err);
    onend && onend();
  }
}

function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/\[SEARCH:.*?\]/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/[*#`_]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Browser speechSynthesis — smart voice selection for natural, non-robotic sound. */
function _speakBrowser(rawText, persona, p, onend, languageMode = null) {
  if (!('speechSynthesis' in window)) { onend && onend(); return; }
  speechSynthesis.cancel();

  const text = cleanTextForSpeech(rawText);
  if (!text) { onend && onend(); return; }

  // Determine which language mode we're using
  const mode = languageMode || p.language_mode || 'auto';
  const langCode = state.ttsLang && state.ttsLang[mode] ? state.ttsLang[mode] : 'en-IN';

  const u = new SpeechSynthesisUtterance(text);

  // Always refresh — browsers load voices async
  const vv = speechSynthesis.getVoices();
  if (vv.length) voicesReady = vv;

  // Determine which language voices to prioritize
  let isIndianLanguage = mode && (mode.includes('gujarati') || mode.includes('hindi') || mode.includes('tamil') || mode.includes('marathi') || mode.includes('bengali'));

  // Premium female voice priority list - PRIORITIZE NEURAL/NATURAL VOICES ONLY
  let PREMIUM = [];

  if (mode.includes('gujarati')) {
    PREMIUM = [
      'Microsoft Dhwani Online (Natural)',
      'Google ગુજરાતી',
      'Microsoft Shruti',
      'Shruti'
    ];
  } else if (mode.includes('hindi')) {
    PREMIUM = [
      'Microsoft Swara Online (Natural)',
      'Google हिन्दी',
      'Microsoft Heera Online (Natural)',
      'Heera'
    ];
  } else if (mode.includes('tamil')) {
    PREMIUM = [
      'Google தமிழ்',
      'Microsoft Pallavi Online (Natural)',
      'Pallavi'
    ];
  } else if (mode.includes('marathi')) {
    PREMIUM = [
      'Google मराठी',
      'Microsoft Marathi Female'
    ];
  } else if (mode.includes('bengali')) {
    PREMIUM = [
      'Google বাংলা',
      'Microsoft Bengali Female'
    ];
  } else {
    // English or mixed mode - use Indian English voice
    PREMIUM = [
      'Microsoft Neerja Online (Natural)',
      'Microsoft Prabhat Online (Natural)',
      'Microsoft Aria Online (Natural)',
      'Microsoft Jenny Online (Natural)',
      'Google India English Female',
      'Google IN English Female',
      'Microsoft Neerja',
      'Microsoft Prabhat',
      'Veena',
      'Rishi',
      'Microsoft Zira',
      'Microsoft Hazel',
      'Samantha',
    ];
  }

  let v = null;

  // Language-specific voice selection for Indian languages
  if (isIndianLanguage) {
    if (mode.includes('gujarati')) {
      // 1. Try native Gujarati voices
      let langVoices = voicesReady.filter(x => x.lang.startsWith('gu') || x.lang.startsWith('gu-') || x.name.includes('Dhwani') || x.name.includes('Shruti') || x.name.includes('ગુજરાતી'));
      langVoices = langVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = langVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || langVoices[0] || null;
    } else if (mode.includes('hindi')) {
      // 1. Try native Hindi voices
      let langVoices = voicesReady.filter(x => x.lang.startsWith('hi') || x.lang.startsWith('hi-') || x.name.includes('हिन्दी'));
      langVoices = langVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = langVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || langVoices[0] || null;
    } else if (mode.includes('tamil')) {
      // 1. Try native Tamil voices
      let langVoices = voicesReady.filter(x => x.lang.startsWith('ta') || x.lang.startsWith('ta-') || x.name.includes('தமிழ்'));
      langVoices = langVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = langVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || langVoices[0] || null;
    } else if (mode.includes('marathi')) {
      // 1. Try native Marathi voices
      let langVoices = voicesReady.filter(x => x.lang.startsWith('mr') || x.lang.startsWith('mr-') || x.name.includes('मराठी'));
      langVoices = langVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = langVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || langVoices[0] || null;
    } else if (mode.includes('bengali')) {
      // 1. Try native Bengali voices
      let langVoices = voicesReady.filter(x => x.lang.startsWith('bn') || x.lang.startsWith('bn-') || x.name.includes('বাংলা'));
      langVoices = langVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = langVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name)) || langVoices[0] || null;
    }

    // 2. Try other Indian language voices as fallback
    if (!v) {
      let indianVoices = voicesReady.filter(x => x.lang.startsWith('en-IN') || x.name.includes('Neerja') || x.name.includes('Prabhat') || x.name.includes('Heera'));
      indianVoices = indianVoices.filter(x => !/male|boy|man/i.test(x.name));
      v = indianVoices.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name))
          || indianVoices[0]
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
                 /female|woman|aria|jenny|zira|hazel|heera|neerja|veena|samantha|ava|pallavi|swara/i.test(x.name);
        });
        if (v) break;
      }
    }
    // 3. Persona hints (only if not forcing Indian language)
    if (!v && !isIndianLanguage) {
      for (const h of (persona.web_voice_hint || [])) {
        v = voicesReady.find(x => x.name.toLowerCase().includes(h.toLowerCase()));
        if (v) break;
      }
    }
    // 4. Any locale-matching voice (prefer Indian English)
    if (!v) {
      let langV = voicesReady.filter(x => x.lang.startsWith('en-IN') || x.lang.startsWith('en'));
      langV = langV.filter(x => !/male|boy|man|niranjan|karan|harsh|malhar|hemant|madhur/i.test(x.name));
      v = langV.find(x => /natural|online|neural|wavenet|google|microsoft.*online/i.test(x.name))
        || langV.find(x => x.localService)
        || langV[0]
        || null;
    }
  }

  // Ultimate fallback (must be female, preferring Indian voices)
  if (!v) {
    v = voicesReady.find(x => /neerja|prabhat|heera|veena|pallavi|swara|zira|jenny|aria|samantha/i.test(x.name.toLowerCase()))
        || voicesReady[0]
        || null;
  }

  if (v) u.voice = v;

  // Transliterate if using fallback/different script voices
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text);
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const hasBengali = /[\u0980-\u09FF]/.test(text);

  if (hasGujarati || hasDevanagari || hasTamil || hasBengali) {
    const voiceLang = (v && v.lang) ? v.lang : 'en';
    // If voice is Hindi, convert Gujarati to Devanagari
    if (voiceLang.startsWith('hi')) {
      if (hasGujarati) {
        u.text = transliterateGujaratiToDevanagari(text);
      }
    }
    // If voice is not in the same language family, transliterate to Roman
    else if (!voiceLang.startsWith('gu') && !voiceLang.startsWith('hi') &&
             !voiceLang.startsWith('ta') && !voiceLang.startsWith('mr') &&
             !voiceLang.startsWith('bn') && !voiceLang.startsWith('en-IN')) {
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
    /* Start talking gesture — preserve current emotion (don't override with 'friendly') */
    if (state.avatar) {
      state.avatar.stopSpeaking();
      state.avatar.setViseme('rest');
      state.avatar.gesture('talking');
    }
    if (state.callAvatar) {
      state.callAvatar.stopSpeaking();
      state.callAvatar.setViseme('rest');
      state.callAvatar.gesture('talking');
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
    /* Smooth transition back to idle, preserving active expression */
    if (state.avatar) { 
      state.avatar.setViseme('rest'); 
      state.avatar.stopSpeaking();
      setTimeout(() => state.avatar && state.avatar.gesture('idle'), 600); 
    }
    if (state.callAvatar) { 
      state.callAvatar.setViseme('rest'); 
      state.callAvatar.stopSpeaking();
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

  // Settings "Edit Character" flow: stage changes for a live preview, but do
  // not persist until the user presses "Update Character".
  if (state.charEditing && e.target.closest('#char-editor-body') &&
      (key.startsWith('char_') || key === 'avatar_type')) {
    stageCharPick(key, btn.dataset.val);
    return;
  }

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
  // While editing, reflect the staged draft merged over the saved profile.
  const p = state.charEditing
    ? { ...(state.profile || {}), ...(state.charDraft || {}) }
    : (state.profile || {});
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
        if (state.charEditing) {
          state.charDraft = state.charDraft || {};
          state.charDraft.vrm_path = r.vrm_url;
          state.charDraft.avatar_type = 'custom';
          previewCharDraft();
        } else if (state.profile) {
          state.profile.vrm_path = r.vrm_url; state.profile.avatar_type = 'custom';
          const el = $('#dash-avatar');
          if (el) state.avatar = mountAvatar(el, state.profile);
        }
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
      // While editing, the global click handler stages this via stageCharPick().
      if (state.charEditing) return;
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
      if (state.charEditing) { stageCharPick('char_name', newName); return; }
      await saveProfilePatch({ char_name: newName });
      $('#dash-charname').textContent = newName;
    };
  }
}
/* ───────────── settings: staged "Edit Character" → "Update" flow ────────── */
function stageCharPick(key, val) {
  if (!state.charDraft) state.charDraft = {};
  state.charDraft[key] = val;
  const curName = state.charDraft.char_name ?? (state.profile || {}).char_name;

  if (key === 'avatar_type') {
    if (val === 'lia') {
      state.charDraft.char_gender = 'female';
      state.charDraft.vrm_path = '/static/LIA.vrm';
      if (curName === 'JARVIS') state.charDraft.char_name = 'LIA';
    } else if (val === 'male') {
      state.charDraft.char_gender = 'male';
      state.charDraft.vrm_path = '';
      if (curName === 'LIA') state.charDraft.char_name = 'JARVIS';
    }
    buildSettingsChar();   // reveal/hide procedural options + VRM upload area
  } else if (key === 'char_gender') {
    if (val === 'female' && curName === 'JARVIS') state.charDraft.char_name = 'LIA';
    if (val === 'male' && curName === 'LIA') state.charDraft.char_name = 'JARVIS';
    buildSettingsChar();   // refresh the name field if it changed
  }

  previewCharDraft();
}

/* Live-preview the staged draft on the dashboard avatar without persisting. */
function previewCharDraft() {
  const cfg = { ...(state.profile || {}), ...(state.charDraft || {}) };
  cfg.vrm_path = cfg.vrm_path || (cfg.avatar_type === 'male' ? '' : '/static/LIA.vrm');
  const el = $('#dash-avatar');
  if (el) state.avatar = mountAvatar(el, cfg);
  if (cfg.char_name) $('#dash-charname').textContent = cfg.char_name;
}

function openCharEditor() {
  state.charEditing = true;
  state.charDraft = {};
  buildSettingsChar();
  const ed = $('#char-editor'); if (ed) ed.style.display = 'block';
  const eb = $('#btn-edit-char'); if (eb) eb.style.display = 'none';
  const st = $('#char-editor-status'); if (st) st.textContent = '';
}

async function commitCharEditor() {
  const st = $('#char-editor-status');
  const draft = state.charDraft || {};
  if (Object.keys(draft).length) {
    if (st) st.textContent = 'Saving…';
    await saveProfilePatch(draft);   // persists to /api/profile + remounts avatar
    if ($('#dash-charname') && state.profile) $('#dash-charname').textContent = state.profile.char_name;
  }
  state.charEditing = false;
  state.charDraft = null;
  const ed = $('#char-editor'); if (ed) ed.style.display = 'none';
  const eb = $('#btn-edit-char'); if (eb) eb.style.display = '';
  if (st) st.textContent = '';
}

function cancelCharEditor() {
  state.charEditing = false;
  state.charDraft = null;
  // Restore the saved appearance on the live avatar.
  const p = state.profile || {};
  const cfg = { ...p, vrm_path: p.vrm_path || (p.avatar_type === 'male' ? '' : '/static/LIA.vrm') };
  const el = $('#dash-avatar'); if (el) state.avatar = mountAvatar(el, cfg);
  if (p.char_name) $('#dash-charname').textContent = p.char_name;
  const ed = $('#char-editor'); if (ed) ed.style.display = 'none';
  const eb = $('#btn-edit-char'); if (eb) eb.style.display = '';
}

$('#btn-edit-char')   && ($('#btn-edit-char').onclick   = openCharEditor);
$('#btn-update-char') && ($('#btn-update-char').onclick = commitCharEditor);
$('#btn-cancel-char') && ($('#btn-cancel-char').onclick = cancelCharEditor);

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
  if (t.dataset.tab === 'memory') { loadMemories(); loadVault(); }
  if (t.dataset.tab === 'device') { loadDevice(); loadProcesses(); }
  if (t.dataset.tab === 'files') loadExplorer();
  if (t.dataset.tab === 'settings' && state.charEditing) cancelCharEditor();
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

async function streamChat(text, onToken, onDone) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.token
    },
    body: JSON.stringify({ message: text, stream: true })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Request failed');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj.type === 'text') {
          onToken(obj.content);
        } else if (obj.type === 'done') {
          onDone(obj);
        }
      } catch (err) {
        console.warn("Failed to parse stream line:", trimmed, err);
      }
    }
  }
  
  if (buffer.trim()) {
    try {
      const obj = JSON.parse(buffer.trim());
      if (obj.type === 'text') {
        onToken(obj.content);
      } else if (obj.type === 'done') {
        onDone(obj);
      }
    } catch (err) {}
  }
}

async function sendMessage(text, speakResponse = false) {
  text = (text || $('#chat-input').value).trim();
  
  if (typeof attachedFiles !== 'undefined' && attachedFiles.length) {
    const fileSummary = attachedFiles.map(f => `[Attached ${f.type.startsWith('image/') ? 'Image' : f.type.startsWith('video/') ? 'Video' : 'File'}: ${f.name} -> ${f.url}]`).join('\n');
    text = (text ? text + '\n\n' : '') + fileSummary;
    attachedFiles = [];
    if (typeof renderAttachmentStrip === 'function') renderAttachmentStrip();
  }
  
  if (!text) return;
  $('#chat-input').value = '';

  stopSpeaking();

  // INSTANT reaction — avatar snaps to reacting/thinking posture immediately (<16ms)
  if (state.avatar) {
    state.avatar.setEmotion('focused');
    state.avatar.gesture('reacting');
  }
  if (state.callAvatar) {
    state.callAvatar.setEmotion('focused');
    state.callAvatar.gesture('reacting');
  }

  addMsg('user', text);
  const thinking = addMsg('ai', '…', 'thinking');
  
  let aiBubble = null;
  let textBuffer = "";
  let sentencesSpoken = 0;
  
  try {
    const p = state.profile || state.draft || {};
    
    await streamChat(text,
      (token) => {
        if (!aiBubble) {
          thinking.remove();
          aiBubble = addMsg('ai', '');
          // First token arrived — avatar transitions from reacting → thinking
          if (state.avatar) { state.avatar.setEmotion('thinking'); state.avatar.gesture('thinking'); }
          if (state.callAvatar) { state.callAvatar.setEmotion('thinking'); state.callAvatar.gesture('thinking'); }
        }
        aiBubble.textContent += token;
        $('#chat-log').scrollTop = 1e9;
        
        if (speakResponse) {
          textBuffer += token;
          const isGujarati = /[\u0A80-\u0AFF]/.test(textBuffer) || p.language_mode === 'english_gujarati';
          const matches = textBuffer.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
          if (matches.length > sentencesSpoken) {
            for (let i = sentencesSpoken; i < matches.length; i++) {
              const sentence = matches[i].trim();
              if (sentence) {
                enqueueSpeech(sentence, isGujarati);
              }
              sentencesSpoken++;
            }
          }
        }
      },
      (res) => {
        if (!aiBubble) {
          thinking.remove();
          aiBubble = addMsg('ai', res.reply);
        } else {
          aiBubble.textContent = res.reply;
        }
        $('#chat-log').scrollTop = 1e9;
        
        addActivity('ai', 'LIA', res.reply);
        
        if (res.emotion) {
          if (state.avatar) {
            /* If speaking, update face expression only and keep talking gesture */
            if (state.avatar._isSpeaking) {
              state.avatar.setExpression(res.emotion);
            } else {
              state.avatar.setEmotion(res.emotion);
            }
          }
          if (state.callAvatar) {
            if (state.callAvatar._isSpeaking) {
              state.callAvatar.setExpression(res.emotion);
            } else {
              state.callAvatar.setEmotion(res.emotion);
            }
          }
        }
        
        if (res.engine === 'coder') {
          if (res.is_web_app && res.preview_url) {
            const appCard = document.createElement('div');
            appCard.className = 'agent-card webapp-card';
            appCard.innerHTML = `
              <div class="agent-card-header">
                <span class="agent-card-title">🚀 Interactive Web App: ${res.project_name || 'App'}</span>
                <div>
                  <a href="${res.preview_url}" target="_blank" class="action-link-btn" style="background:#53D7F0; color:#060A13; margin-right:8px;">🔗 Open Full Window</a>
                  <a href="${res.download_url}" download class="action-link-btn">📦 Download ZIP</a>
                </div>
              </div>
              <div class="iframe-container">
                <iframe src="${res.preview_url}"></iframe>
              </div>
            `;
            $('#chat-log').appendChild(appCard);
            $('#chat-log').scrollTop = 1e9;
          } else if (res.code) {
            const pre = document.createElement('pre');
            pre.className = 'code-block';
            pre.innerHTML = `<div class="code-head">📄 ${res.filename || 'code'} — opened in your editor</div><code></code>`;
            pre.querySelector('code').textContent = res.code;
            $('#chat-log').appendChild(pre);
            $('#chat-log').scrollTop = 1e9;
          }
        }

        // (Obsolete static video card removed in favor of interactive player block)

        if (res.engine === 'presentation' && res.slides) {
          const presCard = document.createElement('div');
          presCard.className = 'agent-card presentation-card';
          let slideIdx = 0;
          const slides = res.slides;
          const cardId = 'pres-' + Math.random().toString(36).substr(2, 6);
          presCard.innerHTML = `
            <div class="agent-card-header">
              <span class="agent-card-title">📊 Presentation Deck: ${res.topic || 'Slides'}</span>
              <a href="${res.download_url}" target="_blank" download class="action-link-btn">📥 Download HTML Slides</a>
            </div>
            <div class="slide-box-card" id="${cardId}">
              <h2 style="color:#53D7F0; margin-top:0;">${slides[0].title}</h2>
              <h4 style="color:#94a3b8;">${slides[0].subtitle}</h4>
              <ul style="line-height:1.7; color:#E2E8F0; padding-left:20px;">
                ${slides[0].bullets.map(b => `<li>${b}</li>`).join('')}
              </ul>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
              <button class="btn ghost sm" id="${cardId}-prev">◀ Previous</button>
              <span id="${cardId}-count" style="color:#53D7F0; font-weight:bold;">1 / ${slides.length}</span>
              <button class="btn solid sm" id="${cardId}-next">Next ▶</button>
            </div>
          `;
          $('#chat-log').appendChild(presCard);
          $('#chat-log').scrollTop = 1e9;

          setTimeout(() => {
            const renderSlide = () => {
              const box = $(`#${cardId}`);
              if (!box) return;
              const s = slides[slideIdx];
              box.innerHTML = `
                <h2 style="color:#53D7F0; margin-top:0;">${s.title}</h2>
                <h4 style="color:#94a3b8;">${s.subtitle}</h4>
                <ul style="line-height:1.7; color:#E2E8F0; padding-left:20px;">
                  ${s.bullets.map(b => `<li>${b}</li>`).join('')}
                </ul>
              `;
              $(`#${cardId}-count`).textContent = `${slideIdx + 1} / ${slides.length}`;
            };
            $(`#${cardId}-prev`).onclick = () => { if (slideIdx > 0) { slideIdx--; renderSlide(); } };
            $(`#${cardId}-next`).onclick = () => { if (slideIdx < slides.length - 1) { slideIdx++; renderSlide(); } };
          }, 50);
        }

        if (res.engine === 'article' && res.content) {
          const artCard = document.createElement('div');
          artCard.className = 'agent-card article-card';
          const htmlContent = window.marked ? marked.parse(res.content) : res.content.replace(/\n/g, '<br>');
          artCard.innerHTML = `
            <div class="agent-card-header">
              <span class="agent-card-title">📝 Article / Blog: ${res.title || 'Post'}</span>
              <a href="${res.download_url}" target="_blank" download class="action-link-btn">📥 Download Markdown</a>
            </div>
            <div class="article-reader-box">${htmlContent}</div>
          `;
          $('#chat-log').appendChild(artCard);
          $('#chat-log').scrollTop = 1e9;
        }

        if (res.engine === 'analysis' && res.chart_config) {
          const chartCard = document.createElement('div');
          chartCard.className = 'agent-card chart-card';
          const canvasId = 'chart-' + Math.random().toString(36).substr(2, 6);
          chartCard.innerHTML = `
            <div class="agent-card-header">
              <span class="agent-card-title">📈 Data Analysis & Visual Metrics</span>
              <span style="color:#10B981; font-weight:bold;">Total: ${res.summary ? res.summary.total : ''} | Avg: ${res.summary ? res.summary.average : ''}</span>
            </div>
            <div class="chart-container-box">
              <canvas id="${canvasId}"></canvas>
            </div>
          `;
          $('#chat-log').appendChild(chartCard);
          $('#chat-log').scrollTop = 1e9;

          setTimeout(() => {
            const ctx = document.getElementById(canvasId);
            if (ctx && window.Chart) {
              new Chart(ctx, res.chart_config);
            }
          }, 100);
        }

        if (res.engine === 'scraper' && res.scrape_data) {
          const scrapeCard = document.createElement('div');
          scrapeCard.className = 'agent-card scrape-card';
          const sd = res.scrape_data;
          let contentHtml = '';
          if (sd.results) {
            contentHtml = sd.results.map(r => `
              <div class="search-item" style="margin-bottom:8px;">
                <a href="${r.url}" target="_blank" class="search-title">${r.title}</a>
                <div class="search-url">${r.url}</div>
                <div class="search-snippet">${r.snippet}</div>
              </div>
            `).join('');
          } else if (sd.content) {
            contentHtml = `<div style="max-height:200px; overflow-y:auto; font-size:13px; color:#cbd5e1; white-space:pre-wrap;">${sd.content}</div>`;
          }
          scrapeCard.innerHTML = `
            <div class="agent-card-header">
              <span class="agent-card-title">🕷 Web Scraper Results</span>
            </div>
            <div>${contentHtml}</div>
          `;
          $('#chat-log').appendChild(scrapeCard);
          $('#chat-log').scrollTop = 1e9;
        }

        if (res.engine === 'automation' && res.logs) {
          const autoCard = document.createElement('div');
          autoCard.className = 'agent-card automation-card';
          autoCard.innerHTML = `
            <div class="agent-card-header">
              <span class="agent-card-title">⚡ Automation Workflow: ${res.task_name || 'Task'}</span>
            </div>
            <pre style="background:#080b12; padding:12px; border-radius:6px; font-family:monospace; color:#10B981; font-size:13px;">${res.logs.join('\n')}</pre>
          `;
          $('#chat-log').appendChild(autoCard);
          $('#chat-log').scrollTop = 1e9;
        }

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

        // ── Long-Form Video Production: background progress card ──
        if (res.engine === 'longform_video' && res.status === 'processing' && res.project_id) {
          const pid = res.project_id;
          const prog = document.createElement('div');
          prog.className = 'agent-card longform-progress-card';
          prog.style.cssText = 'background:#0b1120; border:1px solid rgba(0,242,254,0.3); border-radius:12px; padding:16px; margin-top:12px; margin-bottom:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5);';
          prog.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="color:#00f2fe; font-weight:700; font-size:15px;">🎬 Producing: ${(res.topic || 'Video Project')}</span>
              <span id="lf-pct-${pid}" style="color:#94a3b8; font-size:12px;">0%</span>
            </div>
            <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; margin-bottom:8px;">
              <div id="lf-bar-${pid}" style="width:0%; height:100%; background:linear-gradient(90deg,#00f2fe,#4facfe); transition:width 0.4s ease;"></div>
            </div>
            <div id="lf-status-${pid}" style="font-size:12px; color:#94a3b8;">Target: ${res.target_duration || ''} · ${res.estimated_scenes || '?'} scenes · queued…</div>
          `;
          $('#chat-log').appendChild(prog);
          $('#chat-log').scrollTop = 1e9;

          const poll = async () => {
            let st;
            try {
              st = await api(res.poll_url || `/api/video/longform/${pid}`);
            } catch (e) {
              setTimeout(poll, 6000);
              return;
            }
            const bar = $(`#lf-bar-${pid}`), pct = $(`#lf-pct-${pid}`), statusEl = $(`#lf-status-${pid}`);
            if (bar) bar.style.width = `${st.progress_percent || 0}%`;
            if (pct) pct.textContent = `${st.progress_percent || 0}%`;
            if (statusEl) statusEl.textContent = `${st.scenes_done || 0}/${st.scenes_total || '?'} scenes · ${st.checkpoint || st.status}`;

            if (st.status === 'done') {
              prog.remove();
              const scenes = st.scenes || [];
              const done = document.createElement('div');
              done.className = 'agent-card video-player-card';
              done.style.cssText = 'background:#0b1120; border:1px solid rgba(0,242,254,0.3); border-radius:12px; padding:16px; margin-top:12px; margin-bottom:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5);';
              const failedNote = (st.qc && st.qc.scenes_failed && st.qc.scenes_failed.length)
                ? `<div style="color:#fbbf24; font-size:12px; margin-top:8px;">⚠ ${st.qc.scenes_failed.length} of ${st.qc.scenes_total} scenes could not be generated and were skipped.</div>`
                : '';
              done.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <span style="color:#00f2fe; font-weight:700; font-size:15px;">📹 ${(st.topic || 'Video').toUpperCase()} — Production Complete</span>
                  <span style="background:rgba(0,242,254,0.15); color:#00f2fe; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">⏱ ${st.total_duration || ''}</span>
                </div>
                <div style="width:100%; border-radius:8px; overflow:hidden; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                  <video controls style="width:100%; max-height:420px; background:#000;" poster="${st.thumbnail || ''}">
                    <source src="${st.mp4_url || st.video_url}" type="video/mp4">
                  </video>
                </div>
                <div style="display:flex; gap:6px; overflow-x:auto; margin-bottom:12px;">
                  ${scenes.map(s => `<img src="${s.image_url}" title="${s.title}" style="height:60px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);" />`).join('')}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <a href="${st.mp4_url || st.video_url}" download class="btn solid sm" style="background:linear-gradient(135deg,#00f2fe,#4facfe); color:#000; font-weight:700; text-decoration:none;">📥 Download MP4</a>
                  ${st.srt_url ? `<a href="${st.srt_url}" download class="btn ghost sm" style="text-decoration:none; color:#00f2fe; border-color:rgba(0,242,254,0.4);">📝 Download Subtitles</a>` : ''}
                </div>
                ${failedNote}
              `;
              $('#chat-log').appendChild(done);
              $('#chat-log').scrollTop = 1e9;
              return;
            }
            if (st.status === 'failed') {
              if (statusEl) statusEl.textContent = `Failed: ${st.error || 'unknown error'}`;
              return;
            }
            setTimeout(poll, 6000);
          };
          setTimeout(poll, 6000);
        }

        // ── Video Agent Interactive Playable Card ──
        if (res.engine === 'video' || res.video_id || res.scenes) {
          const vidId = res.video_id || ('vid_' + Math.random().toString(36).substring(2, 8));
          const scenes = res.scenes || [];
          const videoCard = document.createElement('div');
          videoCard.className = 'agent-card video-player-card';
          videoCard.style.cssText = 'background:#0b1120; border:1px solid rgba(0,242,254,0.3); border-radius:12px; padding:16px; margin-top:12px; margin-bottom:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5);';

          videoCard.innerHTML = `
            <div class="agent-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span class="agent-card-title" style="color:#00f2fe; font-weight:700; font-size:15px;">📹 AI Video Preview: ${(res.topic || 'Video').toUpperCase()}</span>
              <span style="background:rgba(0,242,254,0.15); color:#00f2fe; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">⏱ ${res.total_duration || '00:20'}</span>
            </div>

            <div class="video-viewport" style="position:relative; width:100%; height:280px; background:#000; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); margin-bottom:12px;">
              ${res.mp4_url ? `
                <video id="v-vid-${vidId}" controls autoplay loop muted playsinline poster="${(scenes[0] && scenes[0].image_url) || res.thumbnail || '/static/placeholder.jpg'}" style="width:100%; height:100%; object-fit:cover;">
                  <source src="${res.mp4_url}" type="video/mp4">
                  Your browser does not support playing this MP4 video.
                </video>
              ` : `
                <img id="v-img-${vidId}" src="${(scenes[0] && scenes[0].image_url) || res.thumbnail || '/static/placeholder.jpg'}" style="width:100%; height:100%; object-fit:cover; filter:brightness(0.85); transition:transform 8s ease, filter 0.4s ease;" />
                <div style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:space-between; padding:14px; background:linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 40%, rgba(0,0,0,0.85) 100%);">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span id="v-tag-${vidId}" style="background:rgba(0,242,254,0.25); color:#00f2fe; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">Scene 1: ${scenes[0] ? scenes[0].title : ''}</span>
                    <span style="color:#94a3b8; font-size:11px; background:rgba(0,0,0,0.5); padding:3px 8px; border-radius:8px;">2K QHD (2560x1440)</span>
                  </div>
                  <button id="v-play-${vidId}" style="align-self:center; width:58px; height:58px; border-radius:50%; background:linear-gradient(135deg, #00f2fe, #4facfe); border:none; color:#000; font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 0 24px rgba(0,242,254,0.6); transition:transform 0.2s;">▶</button>
                  <div id="v-cap-${vidId}" style="background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); padding:8px 14px; border-radius:6px; color:#fff; font-size:13px; text-align:center; border:1px solid rgba(255,255,255,0.1); line-height:1.4; max-height:65px; overflow-y:auto; word-break:break-word;">
                    ${scenes[0] ? scenes[0].audio : ''}
                  </div>
                </div>
                <div style="position:absolute; bottom:0; left:0; right:0; height:4px; background:rgba(255,255,255,0.15);">
                  <div id="v-prog-${vidId}" style="width:0%; height:100%; background:linear-gradient(90deg, #00f2fe, #4facfe); transition:width 0.1s linear;"></div>
                </div>
              `}
            </div>

            <div id="v-chips-${vidId}" style="display:flex; gap:8px; overflow-x:auto; margin-bottom:12px; padding-bottom:4px;">
              ${scenes.map((s, idx) => `
                <button class="scene-btn-${vidId} ${idx === 0 ? 'active' : ''}" data-idx="${idx}" title="${s.title}" style="background:${idx === 0 ? 'rgba(0,242,254,0.2)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${idx === 0 ? '#00f2fe' : 'rgba(255,255,255,0.1)'}; color:${idx === 0 ? '#00f2fe' : '#94a3b8'}; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; white-space:nowrap; max-width:240px; overflow:hidden; text-overflow:ellipsis;">
                  🎬 Scene ${s.scene}: ${s.title}
                </button>
              `).join('')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              ${res.mp4_url ? `<a href="${res.mp4_url}" download class="btn solid sm" style="background:linear-gradient(135deg, #00f2fe, #4facfe); color:#000; font-weight:700; text-decoration:none; box-shadow:0 0 12px rgba(0,242,254,0.4);">📥 Download MP4 Video File</a>` : '<div></div>'}
              <a href="${res.video_url || '#'}" target="_blank" class="btn ghost sm" style="text-decoration:none; color:#00f2fe; border-color:rgba(0,242,254,0.4);">↗ Open Interactive Video Player</a>
            </div>
          `;

          $('#chat-log').appendChild(videoCard);
          $('#chat-log').scrollTop = 1e9;

          setTimeout(() => {
            let curIdx = 0, isPlaying = false, timer = null;
            const vImg = $(`#v-img-${vidId}`);
            const vTag = $(`#v-tag-${vidId}`);
            const vCap = $(`#v-cap-${vidId}`);
            const vProg = $(`#v-prog-${vidId}`);
            const vPlay = $(`#v-play-${vidId}`);

            const switchScene = (idx) => {
              curIdx = idx;
              const s = scenes[curIdx] || {};
              if (vTag) vTag.textContent = `Scene ${s.scene || (curIdx + 1)}: ${s.title || ''}`;
              if (vCap) vCap.textContent = s.audio || '';
              if (vImg && s.image_url) vImg.src = s.image_url;
              if (vProg) vProg.style.width = `${((curIdx + 1) / scenes.length) * 100}%`;
              document.querySelectorAll(`.scene-btn-${vidId}`).forEach((btn, i) => {
                const active = i === curIdx;
                btn.style.background = active ? 'rgba(0,242,254,0.2)' : 'rgba(255,255,255,0.06)';
                btn.style.borderColor = active ? '#00f2fe' : 'rgba(255,255,255,0.1)';
                btn.style.color = active ? '#00f2fe' : '#94a3b8';
              });
              if ('speechSynthesis' in window) {
                speechSynthesis.cancel();
                if (isPlaying && s.audio) {
                  const ut = new SpeechSynthesisUtterance(s.audio);
                  speechSynthesis.speak(ut);
                }
              }
            };

            document.querySelectorAll(`.scene-btn-${vidId}`).forEach(btn => {
              btn.onclick = () => switchScene(parseInt(btn.dataset.idx, 10));
            });

            if (vPlay) {
              vPlay.onclick = () => {
                isPlaying = !isPlaying;
                vPlay.textContent = isPlaying ? '⏸' : '▶';
                if (vImg) vImg.style.transform = isPlaying ? 'scale(1.12)' : 'scale(1.0)';
                if (isPlaying) {
                  switchScene(curIdx);
                  let step = 0;
                  clearInterval(timer);
                  timer = setInterval(() => {
                    step += 1;
                    if (vProg) vProg.style.width = `${Math.min(100, (((curIdx * 20) + step) / (scenes.length * 20)) * 100)}%`;
                    if (step >= 20) {
                      step = 0;
                      curIdx = (curIdx + 1) % scenes.length;
                      switchScene(curIdx);
                    }
                  }, 400);
                } else {
                  clearInterval(timer);
                  if ('speechSynthesis' in window) speechSynthesis.cancel();
                }
              };
            }
          }, 50);
        }

        // ── Presentation Agent Interactive Slide Viewer Card ──
        if (res.engine === 'presentation' || res.presentation_id || res.slides) {
          const presId = res.presentation_id || ('pres_' + Math.random().toString(36).substring(2, 8));
          const slides = res.slides || [];
          const presCard = document.createElement('div');
          presCard.className = 'agent-card presentation-card';
          presCard.style.cssText = 'background:#0b1120; border:1px solid rgba(0,242,254,0.3); border-radius:12px; padding:18px; margin-top:12px; margin-bottom:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5);';

          const scenes_bullets_html = (arr) => {
            return (arr || []).map(b => `<li style="margin-bottom:6px; position:relative; padding-left:18px;"><span style="position:absolute; left:0; color:#00f2fe;">▸</span>${b}</li>`).join('');
          };

          presCard.innerHTML = `
            <div class="agent-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
              <span class="agent-card-title" style="color:#00f2fe; font-weight:700; font-size:15px;">📊 Presentation Deck: ${(res.topic || 'Slides').toUpperCase()}</span>
              <span id="p-counter-${presId}" style="background:rgba(0,242,254,0.15); color:#00f2fe; padding:4px 12px; border-radius:12px; font-size:12px; font-weight:600;">1 / ${slides.length}</span>
            </div>

            <!-- SLIDE CANVAS VIEWPORT -->
            <div class="slide-viewport" style="background:#070b14; border-radius:10px; padding:24px; min-height:220px; border:1px solid rgba(255,255,255,0.08); margin-bottom:14px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div id="p-tag-${presId}" style="font-size:11px; color:#00f2fe; background:rgba(0,242,254,0.12); padding:3px 10px; border-radius:10px; width:fit-content; margin-bottom:10px; font-weight:600;">Slide 1 of ${slides.length}</div>
                <h3 id="p-title-${presId}" style="font-size:20px; color:#f8fafc; font-weight:700; margin-bottom:6px;">${slides[0] ? slides[0].title : ''}</h3>
                <div id="p-sub-${presId}" style="font-size:13px; color:#94a3b8; margin-bottom:16px;">${slides[0] ? slides[0].subtitle : ''}</div>
                <ul id="p-bullets-${presId}" style="list-style:none; padding:0; margin:0; line-height:1.8; font-size:14px; color:#cbd5e1;">
                  ${scenes_bullets_html(slides[0] ? slides[0].bullets : [])}
                </ul>
              </div>
              <div id="p-notes-${presId}" style="background:rgba(0,0,0,0.4); border-left:3px solid #00f2fe; padding:8px 12px; border-radius:4px; font-size:12px; color:#94a3b8; margin-top:14px;">
                💡 Note: ${slides[0] ? slides[0].notes : ''}
              </div>
            </div>

            <!-- SLIDE CONTROLS BAR -->
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; gap:8px;">
                <button id="p-prev-${presId}" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; padding:8px 16px; border-radius:6px; font-size:13px; cursor:pointer; font-weight:600;">◄ Previous</button>
                <button id="p-next-${presId}" style="background:linear-gradient(135deg, #00f2fe, #4facfe); border:none; color:#000; padding:8px 18px; border-radius:6px; font-size:13px; cursor:pointer; font-weight:700; box-shadow:0 0 12px rgba(0,242,254,0.3);">Next ►</button>
              </div>
              <a href="${res.download_url || '#'}" target="_blank" class="btn ghost sm" style="text-decoration:none; color:#00f2fe; border-color:rgba(0,242,254,0.4); font-size:12px;">↗ Open Deck Presentation</a>
            </div>
          `;

          $('#chat-log').appendChild(presCard);
          $('#chat-log').scrollTop = 1e9;

          setTimeout(() => {
            let pIdx = 0;
            const pTitle = $(`#p-title-${presId}`);
            const pSub = $(`#p-sub-${presId}`);
            const pBul = $(`#p-bullets-${presId}`);
            const pNot = $(`#p-notes-${presId}`);
            const pTag = $(`#p-tag-${presId}`);
            const pCount = $(`#p-counter-${presId}`);
            const pPrev = $(`#p-prev-${presId}`);
            const pNext = $(`#p-next-${presId}`);

            const renderSlide = (i) => {
              pIdx = i;
              const s = slides[pIdx] || {};
              if (pTag) pTag.textContent = `Slide ${pIdx + 1} of ${slides.length}`;
              if (pTitle) pTitle.textContent = s.title || '';
              if (pSub) pSub.textContent = s.subtitle || '';
              if (pBul) pBul.innerHTML = scenes_bullets_html(s.bullets);
              if (pNot) pNot.textContent = `💡 Note: ${s.notes || ''}`;
              if (pCount) pCount.textContent = `${pIdx + 1} / ${slides.length}`;
            };

            if (pPrev) pPrev.onclick = () => { if (pIdx > 0) renderSlide(pIdx - 1); };
            if (pNext) pNext.onclick = () => { if (pIdx < slides.length - 1) renderSlide(pIdx + 1); };
          }, 50);
        }

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
        
        if (res.task) {
          promptSecureApproval(res.task);
        }

        // ── vault recall: show memories in chat as a soft card ──
        if (res.vault_recalled && res.vault_memories && res.vault_memories.length) {
          const vaultCard = document.createElement('div');
          vaultCard.className = 'vault-chat-card';
          vaultCard.innerHTML = `<div class="vault-chat-head">🔮 Heart Vault</div>` +
            res.vault_memories.slice(0, 10).map(m =>
              `<div class="vault-chat-item"><span>${(m.content || '').replace(/</g,'&lt;')}</span><small>${m.saved_at || ''}</small></div>`
            ).join('');
          $('#chat-log').appendChild(vaultCard);
          $('#chat-log').scrollTop = 1e9;
          loadVault();
        }

        // ── vault saved: refresh vault panel quietly ──
        if (res.vault_saved) loadVault();

        const engineLabel =
          res.engine === 'ollama' ? 'Local LLM · Ollama' :
          res.engine === 'vault'  ? '🔮 Heart Vault' :
          res.engine === 'coder'  ? 'Coder · wrote a file' :
          res.engine === 'image'  ? 'Image Gen · Pollinations' :
          state.piperAvailable    ? 'Piper TTS · ready'    : 'Browser TTS · ready';
        $('#engine-status').textContent = engineLabel;

        if (res.emotion) addActivity('ai', 'EMOTION', res.emotion.toUpperCase());
        state.lastDetectedLanguage = res.language_detected;
        
        if (speakResponse) {
          const matches = textBuffer.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
          const remaining = textBuffer.replace(matches.join(""), "").trim();
          const isGujarati = /[\u0A80-\u0AFF]/.test(textBuffer) || p.language_mode === 'english_gujarati';
          if (remaining) {
            enqueueSpeech(remaining, isGujarati);
          }
          streamSpeechDone = true;
          processSpeechQueue();
        }
      }
    );
  } catch (e) { 
    if (thinking && thinking.parentNode) {
      thinking.textContent = '⚠ ' + e.message; 
      thinking.classList.remove('thinking'); 
    } else {
      addMsg('ai', '⚠ ' + e.message);
    }
  }
}

/* ──────────────────────── File / Folder Attachment Manager ──────────────────────── */
let attachedFiles = [];

function renderAttachmentStrip() {
  const strip = $('#chat-attachment-strip');
  if (!strip) return;
  if (!attachedFiles.length) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }
  strip.style.display = 'flex';
  strip.innerHTML = attachedFiles.map((file, idx) => `
    <div class="attachment-chip" style="display:inline-flex; align-items:center; gap:6px; background:rgba(83,215,240,0.15); border:1px solid rgba(83,215,240,0.3); border-radius:16px; padding:4px 10px; font-size:12px; color:#53D7F0; flex-shrink:0;">
      <span>${file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '📹' : '📄'} ${file.name}</span>
      <button onclick="removeAttachedFile(${idx})" style="background:none; border:none; color:#F2647C; cursor:pointer; font-weight:bold; font-size:13px; margin-left:4px;">✕</button>
    </div>
  `).join('');
}

window.removeAttachedFile = function(idx) {
  attachedFiles.splice(idx, 1);
  renderAttachmentStrip();
};

const fileInputEl = $('#chat-file-input');
const uploadBtnEl = $('#btn-upload-file');
if (uploadBtnEl && fileInputEl) {
  uploadBtnEl.onclick = () => fileInputEl.click();
  fileInputEl.onchange = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    
    try {
      const headers = {};
      if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (data.ok && data.files) {
        data.files.forEach((sf, i) => {
          attachedFiles.push({
            name: sf.original_name,
            url: sf.url,
            type: sf.content_type,
            fileObj: files[i]
          });
        });
        renderAttachmentStrip();
      }
    } catch (err) {
      console.warn("File upload error:", err);
    }
    fileInputEl.value = '';
  };
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
  rec.onresult = e => sendMessage(e.results[0][0].transcript, true);
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
      const lipCenterY = (lipLeft.y + lipRight.y) / 2;
      const lipAvgY = (lipTop.y + lipBottom.y) / 2;
      const cornersDrooping = (lipLeft.y > lipAvgY + 0.01) && (lipRight.y > lipAvgY + 0.01);
      const mouthOpen = Math.abs(lipBottom.y - lipTop.y) > 0.035;
      const browInnerDist = Math.abs((landmarks[107]?.x || 0) - (landmarks[336]?.x || 0));
      const browRaised = landmarks[70] && landmarks[159] && (landmarks[70].y < landmarks[159].y - 0.06);

      let detectedExpr = "neutral";
      if (smileRatio > 5.2 || (lipLeft.y < lipAvgY - 0.008 && lipRight.y < lipAvgY - 0.008)) {
        detectedExpr = "happy";
      } else if (cornersDrooping) {
        detectedExpr = "sad";
      } else if (browInnerDist > 0 && browInnerDist < 0.065 && !mouthOpen) {
        detectedExpr = "angry";
      } else if (mouthOpen && browRaised) {
        detectedExpr = "surprised";
      } else if (landmarks[159] && landmarks[145] && Math.abs(landmarks[159].y - landmarks[145].y) < 0.008) {
        detectedExpr = "tired";
      }

      const expressionCard = $('#tel-expression');
      const exprConfig = {
        happy:     { label: "Happy 😊",     color: "#10B981", aura: "aura-happy",     vrm: "happy" },
        sad:       { label: "Sad 😢",       color: "#48CAE4", aura: "aura-sad",       vrm: "sad" },
        angry:     { label: "Angry 😠",     color: "#F2647C", aura: "aura-angry",     vrm: "angry" },
        surprised: { label: "Surprised 😲", color: "#9D7BF0", aura: "aura-stressed",  vrm: "surprised" },
        tired:     { label: "Tired 🥱",     color: "#F59E0B", aura: "aura-stressed",  vrm: "relaxed" },
        neutral:   { label: "Neutral 😐",   color: "#53D7F0", aura: "",               vrm: "neutral" },
      };

      const cfg = exprConfig[detectedExpr] || exprConfig.neutral;
      if (expressionCard) {
        expressionCard.textContent = cfg.label;
        expressionCard.style.color = cfg.color;
      }

      // Update 3D avatar expression and mood aura ring
      if (state.lastDetectedExpr !== detectedExpr) {
        state.lastDetectedExpr = detectedExpr;
        if (state.avatar) state.avatar.setEmotion(cfg.vrm);
        updateAvatarMoodAura(detectedExpr);
        emitEmotionParticles(detectedExpr);

        // Throttle backend telemetry to once every 5s per expression change
        const nowMs = Date.now();
        if (!state.lastExprTelemetryTime || (nowMs - state.lastExprTelemetryTime) > 5000) {
          state.lastExprTelemetryTime = nowMs;
          sendTelemetryEvent("expression_change", detectedExpr);
        }
      }
    } else {
      // User Left Desk
      const presentCard = $('#tel-presence');
      if (presentCard) {
        presentCard.textContent = "Absent";
        presentCard.className = "value";
      }
      const att = $('#tel-attention'); if (att) att.textContent = "--";
      const exp = $('#tel-expression'); if (exp) exp.textContent = "--";
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

/* ── Mood Aura & Emotion Visual Particles ── */
function updateAvatarMoodAura(emotion) {
  const ring = $('#pod-aura-ring');
  if (!ring) return;

  ring.className = "pod-aura-ring";

  if (emotion === "happy") {
    ring.classList.add("aura-happy");
  } else if (emotion === "sad") {
    ring.classList.add("aura-sad");
  } else if (emotion === "angry") {
    ring.classList.add("aura-angry");
  } else if (emotion === "tired" || emotion === "surprised") {
    ring.classList.add("aura-stressed");
  } else {
    ring.classList.add("aura-love");
  }
}

let activeParticles = [];
function emitEmotionParticles(emotion) {
  const canvas = $('#emotion-particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.clientWidth || 220;
  canvas.height = canvas.clientHeight || 220;

  const particleChar = (emotion === "happy" || emotion === "neutral") ? "💕" : (emotion === "sad" ? "✨" : "⭐");

  for (let i = 0; i < 6; i++) {
    activeParticles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 80,
      y: canvas.height / 2 + (Math.random() - 0.5) * 60,
      vy: -1.2 - Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.8,
      size: 14 + Math.random() * 10,
      opacity: 1.0,
      char: particleChar
    });
  }

  if (!state.particleLoopActive) {
    state.particleLoopActive = true;
    requestAnimationFrame(renderParticles);
  }
}

function renderParticles() {
  const canvas = $('#emotion-particles-canvas');
  if (!canvas) { state.particleLoopActive = false; return; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  activeParticles = activeParticles.filter(p => p.opacity > 0.05);

  for (const p of activeParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.opacity -= 0.02;

    ctx.globalAlpha = Math.max(0, p.opacity);
    ctx.font = `${p.size}px sans-serif`;
    ctx.fillText(p.char, p.x, p.y);
  }

  if (activeParticles.length > 0) {
    requestAnimationFrame(renderParticles);
  } else {
    state.particleLoopActive = false;
  }
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

/* ─────────────────────────── vault panel ───────────────────────────── */
async function loadVault() {
  const list = await api('/api/vault').catch(() => []);
  const el = $('#vault-list');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(m => `<li>
        <span class="vault-content">${m.content.replace(/</g,'&lt;')}</span>
        <span class="vault-ts">🕰 ${m.saved_at}</span>
      </li>`).join('')
    : '<li class="dim" style="color:var(--text-dim);font-size:12px;">Nothing saved yet — share something close to your heart and say "remember this".</li>';
}

$('#btn-add-vault').onclick = async () => {
  const v = $('#vault-input').value.trim();
  if (!v) return;
  await api('/api/vault', { method: 'POST', body: JSON.stringify({ content: v }) }).catch(() => {});
  $('#vault-input').value = '';
  loadVault();
  // gentle pulse acknowledgment
  const btn = $('#btn-add-vault');
  btn.textContent = '✓ Saved';
  setTimeout(() => { btn.textContent = 'Save to Vault'; }, 1800);
};

/* ──────────────── device / process / explorer ─────────────────── */
async function loadDevice() {
  const d = await api('/api/device').catch(() => null);
  if (!d) return;
  const cpuTxt = (d.cpu_percent ?? '--') + '%';
  const ramTxt = (d.ram_percent ?? '--') + '%';
  const batTxt = d.battery != null ? d.battery + '%' : '--';
  ['hud-cpu', 'hud-cpu-top', 'hud-cpu-ctx'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = cpuTxt; });
  ['hud-ram', 'hud-ram-top', 'hud-ram-ctx'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ramTxt; });
  ['hud-bat', 'hud-bat-ctx'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = batTxt; });
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
    
    stopSpeaking();
    
    setCallStatus('THINKING…', 'pulse-gold');
    addMsg('user', text);
    
    let aiBubble = null;
    let textBuffer = "";
    let sentencesSpoken = 0;
    
    streamOnEndCallback = () => {
      if (state.inCall) {
        autoRestartRec = true;
        try { callRec.start(); } catch(err){}
      }
    };
    streamSpeechDone = false;
    
    try {
      const p = state.profile || {};
      await streamChat(text,
        (token) => {
          if (!aiBubble) {
            aiBubble = addMsg('ai', '');
            setCallStatus('SPEAKING…', 'pulse-blue');
          }
          aiBubble.textContent += token;
          $('#chat-log').scrollTop = 1e9;
          
          textBuffer += token;
          const isGujarati = /[\u0A80-\u0AFF]/.test(textBuffer) || p.language_mode === 'english_gujarati';
          const matches = textBuffer.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
          if (matches.length > sentencesSpoken) {
            for (let i = sentencesSpoken; i < matches.length; i++) {
              const sentence = matches[i].trim();
              if (sentence) {
                enqueueSpeech(sentence, isGujarati);
              }
              sentencesSpoken++;
            }
          }
        },
        (res) => {
          if (!aiBubble) {
            aiBubble = addMsg('ai', res.reply);
          } else {
            aiBubble.textContent = res.reply;
          }
          $('#chat-log').scrollTop = 1e9;
          
          addActivity('ai', 'LIA', res.reply);
          
          state.lastDetectedLanguage = res.language_detected;
          if (res.emotion && state.callAvatar) {
            if (state.callAvatar._isSpeaking) {
              state.callAvatar.setExpression(res.emotion);
            } else {
              state.callAvatar.setEmotion(res.emotion);
            }
          }
          
          const matches = textBuffer.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
          const remaining = textBuffer.replace(matches.join(""), "").trim();
          const isGujarati = /[\u0A80-\u0AFF]/.test(textBuffer) || p.language_mode === 'english_gujarati';
          if (remaining) {
            enqueueSpeech(remaining, isGujarati);
          }
          streamSpeechDone = true;
          processSpeechQueue();
        }
      );
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

// Wire Quick Agent toolbar buttons
document.addEventListener('click', e => {
  const btn = e.target.closest('.agent-btn');
  if (btn && btn.dataset.prompt) {
    const input = $('#chat-input');
    if (input) {
      input.value = btn.dataset.prompt;
      sendMessage(btn.dataset.prompt, false);
    }
  }
});

boot();

