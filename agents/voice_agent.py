"""Voice Agent -- STT, TTS (Piper), voiceprint.

TTS priority:
  1. Piper (piper-tts Python package)  -- fully offline, low-latency
  2. Browser Speech API (client-side)  -- zero-install fallback (handled in JS)
"""
import io
import subprocess
import sys
import wave
from pathlib import Path

from core.config import load, ROOT

# ---- Piper TTS ---------------------------------------------------------------

_VOICES_DIR = ROOT / "data" / "piper_voices"
_VOICES_DIR.mkdir(parents=True, exist_ok=True)

_piper_module = None
_voice_cache = {}


def _try_import_piper():
    global _piper_module
    if _piper_module is not None:
        return _piper_module
    try:
        from piper.voice import PiperVoice
        _piper_module = PiperVoice
        return _piper_module
    except ImportError:
        return None


def _model_path(voice_id):
    candidates = list(_VOICES_DIR.glob(f"{voice_id}*.onnx"))
    return candidates[0] if candidates else None


def install_piper():
    """Install piper-tts package and download high-quality female voice."""
    results = []
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "piper-tts", "--quiet"],
            timeout=180,
        )
        results.append("piper-tts installed")
    except Exception as e:
        results.append(f"piper-tts install failed: {e}")
        return {"ok": False, "steps": results}

    # High-quality voice model (better natural speech than default)
    default_voice = "en_US-libritts-high"  # LibriTTS-High has most natural prosody
    onnx_path = _VOICES_DIR / f"{default_voice}.onnx"
    json_path = _VOICES_DIR / f"{default_voice}.onnx.json"
    if not onnx_path.exists():
        try:
            import urllib.request
            base_url = (
                "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
                "/en/en_US/libritts/high"
            )
            urllib.request.urlretrieve(
                f"{base_url}/en_US-libritts-high.onnx", onnx_path
            )
            urllib.request.urlretrieve(
                f"{base_url}/en_US-libritts-high.onnx.json", json_path
            )
            results.append(f"Downloaded {default_voice} (high-quality voice)")
        except Exception as e:
            results.append(f"Voice download failed: {e}")
            return {"ok": False, "steps": results}

    _voice_cache.clear()
    return {"ok": True, "steps": results}


def _get_voice(model_name):
    PiperVoice = _try_import_piper()
    if PiperVoice is None:
        return None
    if model_name in _voice_cache:
        return _voice_cache[model_name]
    onnx = _model_path(model_name)
    if onnx is None:
        # Prefer high-quality voices in fallback order
        onnx = _model_path("en_US-libritts-high")  # Most natural prosody
    if onnx is None:
        onnx = _model_path("en_US-amy-medium")     # Warm female fallback
    if onnx is None:
        # Use any available voice (prefer higher quality models)
        all_voices = sorted(list(_VOICES_DIR.glob("*.onnx")), key=lambda p: p.name)
        # Prioritize high-quality models
        for pref in ["libritts-high", "libritts-medium", "amy-medium"]:
            onnx = next((v for v in all_voices if pref in v.name), None)
            if onnx:
                break
        if onnx is None:
            onnx = all_voices[0] if all_voices else None
    if onnx is None:
        return None
    try:
        v = PiperVoice.load(str(onnx), config_path=str(onnx) + ".json", use_cuda=False)
        _voice_cache[model_name] = v
        return v
    except Exception:
        return None


def _piper_model_for_persona(persona_id):
    personas = load("voices").get("personas", {})
    p = personas.get(persona_id, {})
    return p.get("piper_model", "en_US-amy-medium")


def synthesize(text, persona_id="friday"):
    """Synthesize speech and return WAV bytes. Raises RuntimeError if Piper unavailable."""
    model_name = _piper_model_for_persona(persona_id)
    voice = _get_voice(model_name)
    if voice is None:
        raise RuntimeError(
            "Piper TTS not available. Call POST /api/tts/install to set it up."
        )
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(voice.config.sample_rate)
        voice.synthesize(text, wf)
    return buf.getvalue()


def tts_status():
    """Return availability and installed voices."""
    PiperVoice = _try_import_piper()
    installed_voices = [p.stem for p in sorted(_VOICES_DIR.glob("*.onnx"))]
    return {
        "piper_available": PiperVoice is not None,
        "installed_voices": installed_voices,
        "voices_dir": str(_VOICES_DIR),
    }


# ---- STT (Whisper) -----------------------------------------------------------

try:
    from faster_whisper import WhisperModel
    _whisper = WhisperModel("small", device="cpu", compute_type="int8")
except Exception:
    _whisper = None


def transcribe(wav_path):
    if not _whisper:
        raise RuntimeError(
            "Install faster-whisper for server-side STT: pip install faster-whisper"
        )
    segments, _ = _whisper.transcribe(wav_path)
    return " ".join(s.text for s in segments).strip()


# ---- Voiceprint (resemblyzer) ------------------------------------------------

try:
    from resemblyzer import VoiceEncoder
    _encoder = VoiceEncoder()
except Exception:
    _encoder = None


def voiceprint(wav_path):
    if not _encoder:
        raise RuntimeError(
            "Install resemblyzer for voice auth: pip install resemblyzer"
        )
    from resemblyzer import preprocess_wav
    return _encoder.embed_utterance(preprocess_wav(wav_path))


def is_same_speaker(emb_a, emb_b, threshold=0.75):
    import numpy as np
    sim = float(np.dot(emb_a, emb_b) / (np.linalg.norm(emb_a) * np.linalg.norm(emb_b)))
    return sim >= threshold


# ---- misc --------------------------------------------------------------------

def persona(persona_id):
    return load("voices")["personas"].get(
        persona_id, load("voices")["personas"]["friday"]
    )
