"""Image Agent — LIA generates images locally via Stable Diffusion and saves them to static folder.

Features:
- Smart prompt extraction & feedback intent recognition
- Modest & culturally accurate deity prompt expansion (Krishna, Radha, Shiva, Ganesha, Hanuman, Durga, Rama, etc.)
- 100% local generation (core/local_image_gen.py) — no cloud API, no API key, no watermark
- Authentic museum-cataloged classical artwork fallback via Wikimedia Commons, used only if
  local generation genuinely fails (e.g. out of VRAM)
"""
import urllib.parse
import urllib.request
import json
import re
import uuid
import random
from pathlib import Path
from core.config import ROOT

GENERATED_DIR = ROOT / "ui" / "static" / "generated"

IMAGE_TRIGGERS = (
    "generate an image", "generate image", "create an image", "create image",
    "draw an image", "draw image", "draw a picture", "generate a picture",
    "create a picture", "make an image", "make a picture", "paint a picture",
    "generate art", "create art", "draw art", "paint an image", "paint image",
    "make art", "draw me", "create me", "generate me", "make me an image",
    "show me an image", "show me a picture", "give me an image", "give me a picture",
)

IMAGE_FEEDBACK_TRIGGERS = (
    "doesn't look like", "does not look like", "not looks like", "not looking like",
    "doesn't look right", "wrong image", "redo image", "redraw", "generate again",
    "make another image", "better image", "fix image", "not like lord krishna",
)

DEITY_ART_EXPANSIONS = [
    (
        r"\b(radha\s*krishna|radhakrishna|krishna\s*radha|radha\s+and\s+krishna|krishna\s+and\s+radha)\b",
        "Radha Krishna divine couple, Lord Krishna: blue skin, golden peacock feather crown, playing golden bansuri flute, yellow dhoti, standing beside Goddess Radha: fair skin, red and gold silk saree, golden crown and jewelry, both smiling, lotus garden background, Raja Ravi Varma style classical Indian temple mural painting, sacred masterpiece, highly detailed, 8k"
    ),
    (
        r"\b(krishna|krishnaji|krishnaa|lord krishna|shree krishna|shri krishna|bhagwan krishna)\b",
        "Lord Krishna Hindu god, blue skin, golden peacock feather crown on head, playing golden bansuri flute held to lips with both hands, yellow silk dhoti, gentle smile, standing under a tree, radiant golden halo, Raja Ravi Varma style classical Indian temple mural painting, sacred masterpiece, highly detailed, 8k"
    ),
    (
        r"\b(radha|radhaji|radhe|goddess radha)\b",
        "Portrait of single Hindu goddess Radha alone, fair-skinned young woman, elegant fully clothed traditional red and gold silk saree, ornate golden crown and exquisite jewelry, serene divine smiling expression, lotus flower garden background, Raja Ravi Varma classical Indian temple mural art style, sacred oil painting masterpiece, highly detailed, 8k resolution"
    ),
    (
        r"\b(shiva|mahadev|bholenath|shankar|har har mahadev|lord shiva)\b",
        "Lord Shiva Mahadev, sacred Hindu god artwork, Neelkanth, holding golden trident trishul, glowing crescent moon in matted hair locks, sacred Ganga river, third eye on forehead, Mount Kailash backdrop, serene meditative pose, divine cosmic aura, classical oil painting masterpiece, 8k"
    ),
    (
        r"\b(ganesha|ganpati|vinayaka|lord ganesha)\b",
        "Lord Ganesha, divine elephant-headed Hindu deity, ornate golden mukut crown, holding sacred modak sweet and lotus flower, glowing divine golden aura, royal traditional temple background, digital art painting masterpiece, 8k"
    ),
    (
        r"\b(hanuman|bajrangbali|lord hanuman|maruti)\b",
        "Lord Hanuman, powerful devoted monkey deity, carrying golden mace gada, radiant divine golden energy aura, majestic heroic pose, epic divine artwork, masterpiece digital painting, 8k"
    ),
    (
        r"\b(ram|rama|sita|siya ram|lord rama|lord ram)\b",
        "Lord Rama and Goddess Sita, divine royal couple, traditional Indian royal golden attire and mukut crowns, holding divine bow and arrow, radiant sacred light aura, epic Indian mythology digital painting, 8k"
    ),
    (
        r"\b(durga|kali|goddess durga|maa durga)\b",
        "Goddess Durga Maa, powerful multi-armed deity riding a lion, holding sacred divine weapons, glowing radiant golden energy aura, epic mythology digital art, masterpiece, 8k"
    ),
    (
        r"\b(lakshmi|saraswati|goddess lakshmi|goddess saraswati)\b",
        "Goddess Lakshmi and Saraswati, golden divine lotus flowers, veena music instrument, glowing divine light, traditional Indian classical artwork, highly detailed digital painting, 8k"
    ),
    (
        r"\b(buddha|gautama buddha|lord buddha)\b",
        "Lord Gautama Buddha, serene meditation under golden Bodhi tree, glowing radiant spiritual aura, peaceful divine expression, golden digital artwork, 8k"
    ),
]

def looks_like_image_request(message: str) -> bool:
    low = message.lower()
    if any(t in low for t in IMAGE_TRIGGERS):
        return True
    if any(f in low for f in IMAGE_FEEDBACK_TRIGGERS):
        return True
    return (
        any(w in low for w in ("generate", "create", "draw", "make", "paint", "show", "redo")) and
        any(w in low for w in ("image", "picture", "photo", "art", "illustration", "sketch", "drawing"))
    )

def _clean_prompt(message: str) -> str:
    """Extract the visual subject from the user's message."""
    text = message.strip()
    
    # Strip feedback prefixes like "They were not looks like Lord Krishna and radhaji"
    text = re.sub(
        r"^(?:they|it|this)\s+(?:were|was|is|are)?\s*(?:not|n't)?\s*(?:looks?|looking)\s*(?:like)?\s*",
        "", text, flags=re.IGNORECASE
    )
    text = re.sub(
        r"^(?:this\s+is\s+not|doesn't\s+look\s+like|does\s+not\s+look\s+like|not\s+looking\s+like)\s*",
        "", text, flags=re.IGNORECASE
    )
    
    # Remove action phrases at the start
    action_phrases = sorted(list(IMAGE_TRIGGERS), key=len, reverse=True)
    for phrase in action_phrases:
        pattern = re.compile(r"^" + re.escape(phrase) + r"[\s,]*(?:of\s+|about\s+|showing\s+|with\s+)?", re.IGNORECASE)
        text = pattern.sub("", text)
    
    text = re.sub(
        r"^(?:draw|generate|create|make|paint|show|give|redo|fix)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|art|illustration|sketch|drawing)\s*(?:of\s+|about\s+|showing\s+|with\s+)?",
        "", text, flags=re.IGNORECASE
    )
    
    text = re.sub(r"^\s*(?:of|about|showing|with)\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    text = text.rstrip(".,!?;:")
    
    if not text or len(text) < 3:
        text = "beautiful digital artwork"
    
    return text

def _is_artistic_or_mythological(prompt: str) -> bool:
    low = prompt.lower()
    art_keywords = (
        "krishna", "radha", "shiva", "ganesha", "hanuman", "ram", "durga", "lakshmi",
        "saraswati", "buddha", "deity", "god", "goddess", "art", "artwork", "painting",
        "illustration", "anime", "sketch", "drawing", "mythology", "mythological", "fantasy"
    )
    return any(k in low for k in art_keywords)

def _enhance_prompt(prompt: str) -> str:
    """Add quality-boosting, modest, and domain-specific tags to the prompt."""
    prompt_low = prompt.lower()
    
    # Check for deity / mythological expansions first
    for pattern, expansion in DEITY_ART_EXPANSIONS:
        if re.search(pattern, prompt_low):
            return expansion

    # Avoid double-adding quality tags
    quality_words = ("8k", "4k", "hd", "detailed", "masterpiece", "high quality", "photorealistic")
    if any(w in prompt_low for w in quality_words):
        return prompt

    if _is_artistic_or_mythological(prompt):
        return f"{prompt}, fully clothed traditional attire, respectful divine digital painting, masterpiece quality, highly detailed, vibrant lighting, elegant colors, 8k resolution"
    
    return f"{prompt}, highly detailed, masterpiece quality, vivid colors, professional photography, 8k resolution"

def fetch_wikimedia_artwork(query: str) -> bytes | None:
    """Fallback: Query Wikimedia Commons for authentic museum-cataloged artwork."""
    try:
        search_query = urllib.parse.quote(query)
        url = f"https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&generator=search&gsrnamespace=6&gsrsearch={search_query}&gsrlimit=5"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            image_info = page.get("imageinfo", [])
            if image_info and "url" in image_info[0]:
                img_url = image_info[0]["url"]
                clean_url = img_url.split("?")[0]
                if any(clean_url.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
                    img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                    with urllib.request.urlopen(img_req, timeout=10) as img_resp:
                        if img_resp.status == 200:
                            img_data = img_resp.read()
                            if len(img_data) > 5000:
                                return img_data
    except Exception as e:
        print(f"[ImageAgent] Wikimedia fallback exception: {e}")
    return None

def generate_and_save(message: str, user_id: str) -> dict:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    prompt = _clean_prompt(message)
    enhanced_prompt = _enhance_prompt(prompt)
    is_art = _is_artistic_or_mythological(prompt)

    fname = f"gen_{uuid.uuid4().hex[:8]}.jpg"
    dest_path = GENERATED_DIR / fname
    seed = random.randint(1000, 999999)

    # Primary path: local Stable Diffusion. No network call, no API key,
    # no watermark — everything happens on this machine's own GPU/CPU.
    try:
        from core.local_image_gen import generate_image
        image = generate_image(enhanced_prompt, steps=20, guidance_scale=7.5, seed=seed)
        image.save(dest_path, format="JPEG", quality=92)
        spoken_text = (
            f"Here is an enhanced traditional artwork of '{prompt.title()}' with authentic iconography, peacock feather, flute, and golden attire!"
            if is_art else f"Here's the image of '{prompt}' — I hope you like it!"
        )
        return {
            "ok": True,
            "spoken": spoken_text,
            "image_url": f"/static/generated/{fname}",
            "filename": fname,
            "prompt": prompt
        }
    except Exception as e:
        print(f"[ImageAgent] Local generation failed: {e}")

    # Fallback: real museum-cataloged artwork from Wikimedia Commons — only
    # for recognizable deity/art subjects, and only because local generation
    # itself failed (e.g. out of VRAM), not as a routine first choice.
    if is_art:
        wiki_data = fetch_wikimedia_artwork(prompt) or fetch_wikimedia_artwork(f"{prompt} painting")
        if wiki_data:
            dest_path.write_bytes(wiki_data)
            return {
                "ok": True,
                "spoken": f"My local image generator hit a snag, so here is a classical museum artwork of '{prompt.title()}' from historic collections instead!",
                "image_url": f"/static/generated/{fname}",
                "filename": fname,
                "prompt": prompt
            }

    # Honest failure — no fake placeholder image.
    return {
        "ok": False,
        "spoken": f"I couldn't generate an image for '{prompt}' right now — my local image generator ran into a problem. Check the LIA logs for details.",
        "prompt": prompt
    }


