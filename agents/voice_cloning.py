"""Voice Cloning & Customization Agent.

Saves uploaded voice recordings (with consent) and applies pitch-shifting
to WAV audio by modifying the audio header sample rate.
"""
import io
import os
import wave
from pathlib import Path
from core.config import ROOT

CUSTOM_VOICE_DIR = ROOT / "data" / "custom_voices"
CUSTOM_VOICE_DIR.mkdir(parents=True, exist_ok=True)

def save_voice_clip(user_id: str, file_name: str, file_bytes: bytes) -> str:
    """Save an uploaded custom voice clip to the user's directory."""
    user_dir = CUSTOM_VOICE_DIR / f"user_{user_id}"
    user_dir.mkdir(exist_ok=True)
    
    # Ensure safe filename
    safe_name = "".join(c for c in file_name if c.isalnum() or c in (".", "_", "-")).strip()
    if not safe_name:
        safe_name = "voice_sample.wav"
        
    dest_path = user_dir / safe_name
    dest_path.write_bytes(file_bytes)
    return f"/static/custom_voices/user_{user_id}/{safe_name}"

def delete_voice_clip(user_id: str, file_name: str):
    """Delete the custom voice file."""
    user_dir = CUSTOM_VOICE_DIR / f"user_{user_id}"
    safe_name = "".join(c for c in file_name if c.isalnum() or c in (".", "_", "-")).strip()
    dest_path = user_dir / safe_name
    if dest_path.exists():
        dest_path.unlink()

def adjust_voice_pitch(wav_bytes: bytes, pitch: float = 1.0, speed: float = 1.0) -> bytes:
    """Adjust pitch and speed of WAV audio.
    
    We pitch-shift by scaling the sampling framerate.
    Speed changes can be applied by the browser playbackRate to avoid distortion,
    or scaled here if needed.
    """
    if pitch == 1.0 and speed == 1.0:
        return wav_bytes
        
    try:
        in_io = io.BytesIO(wav_bytes)
        with wave.open(in_io, "rb") as wf_in:
            params = wf_in.getparams()
            nchannels, sampwidth, framerate, nframes, comptype, compnames = params
            frames = wf_in.readframes(nframes)
            
        # Scale framerate to adjust pitch.
        # Speed can be adjusted on-the-fly or baked into framerate scale
        new_framerate = int(framerate * pitch * speed)
        
        out_io = io.BytesIO()
        with wave.open(out_io, "wb") as wf_out:
            wf_out.setnchannels(nchannels)
            wf_out.setsampwidth(sampwidth)
            wf_out.setframerate(new_framerate)
            wf_out.writeframes(frames)
            
        return out_io.getvalue()
    except Exception as e:
        print(f"[VoiceCloning] Error adjusting WAV: {e}")
        return wav_bytes
