"""Image Agent — JARVIS generates images and saves them to static folder.

Uses the free Pollinations AI image generation API.
"""
import urllib.parse
import urllib.request
import re
import uuid
from pathlib import Path
from core.config import ROOT

GENERATED_DIR = ROOT / "ui" / "static" / "generated"

IMAGE_TRIGGERS = (
    "generate an image", "generate image", "create an image", "create image",
    "draw an image", "draw image", "draw a picture", "generate a picture",
    "create a picture", "make an image", "make a picture", "paint a picture",
    "generate art", "create art", "draw art", "paint an image", "paint image"
)

def looks_like_image_request(message: str) -> bool:
    low = message.lower()
    return any(t in low for t in IMAGE_TRIGGERS) or (
        any(w in low for w in ("generate", "create", "draw", "make", "paint")) and
        any(w in low for w in ("image", "picture", "photo", "art", "illustration", "sketch", "drawing"))
    )

def _clean_prompt(message: str) -> str:
    # Remove phrases like "generate an image of", "draw a picture of", etc.
    low = message.lower()
    
    # Order by length descending so longer phrases match first
    phrases = sorted(list(IMAGE_TRIGGERS), key=len, reverse=True)
    
    cleaned = low
    for phrase in phrases:
        # Match phrase followed by optional "of"
        pattern = r"\b" + re.escape(phrase) + r"\b(?:\s+of)?\s*"
        cleaned = re.sub(pattern, "", cleaned)
        
    # Also clean general action words and target nouns if they are leftover
    cleaned = re.sub(r"\b(of|a|an|the|draw|generate|create|make|paint|image|picture|photo|art|drawing|illustration|sketch|paintings?|photos?|images?|pictures?)\b\s*", "", cleaned)
    
    # Strip double spaces and surrounding whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    
    if not cleaned:
        cleaned = "beautiful neon cyberpunk digital art"
    return cleaned

def generate_and_save(message: str, user_id: str) -> dict:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    
    prompt = _clean_prompt(message)
    # Add neon/cyberpunk aesthetics if not specified to fit LIA's theme perfectly
    enhanced_prompt = prompt
    if not any(w in prompt.lower() for w in ("cyberpunk", "neon", "futuristic", "sci-fi")):
        enhanced_prompt = f"{prompt}, cyberpunk aesthetic, detailed background, neon lighting"
        
    encoded_prompt = urllib.parse.quote(enhanced_prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?nologo=true"
    
    fname = f"gen_{uuid.uuid4().hex[:8]}.jpg"
    dest_path = GENERATED_DIR / fname
    
    try:
        # Request with a standard User-Agent so we don't get blocked
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            image_data = response.read()
            dest_path.write_bytes(image_data)
            
        return {
            "ok": True,
            "spoken": f"Done! I generated the image of '{prompt}' and saved it for you.",
            "image_url": f"/static/generated/{fname}",
            "filename": fname,
            "prompt": prompt
        }
    except Exception as e:
        return {
            "ok": False,
            "spoken": f"I tried to generate the image, but the image generation server encountered an error: {str(e)}",
            "image_url": None
        }
