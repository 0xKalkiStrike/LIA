"""Language Agent — detects user language and builds mixed-mode prompts.

Detection is script-aware first (Indic scripts are unambiguous), then falls
back to Romanized keyword spotting so "kem cho" / "kaise ho" typed in English
letters still work.
"""
import re

SCRIPT_RANGES = {
    "gujarati": (0x0A80, 0x0AFF),
    "hindi": (0x0900, 0x097F),      # Devanagari (also Marathi/Sanskrit)
    "tamil": (0x0B80, 0x0BFF),
    "telugu": (0x0C00, 0x0C7F),
    "bengali": (0x0980, 0x09FF),
    "urdu": (0x0600, 0x06FF),
    "chinese": (0x4E00, 0x9FFF),
    "japanese": (0x3040, 0x30FF),
    "korean": (0xAC00, 0xD7AF),
}

ROMAN_HINTS = {
    "gujarati": ["kem cho", "majama", "su che", "saru", "kevu", "tame", "chho", "avjo"],
    "hindi": ["kaise ho", "kya hai", "theek", "acha", "nahi", "haan", "kyun", "batao"],
    "marathi": ["kasa kay", "kasa ahes", "kay zala", "barobar"],
    "tamil": ["eppadi", "vanakkam", "enna", "seri"],
    "bengali": ["kemon acho", "bhalo", "ki khobor"],
    "french": ["bonjour", "merci", "comment"],
    "german": ["hallo", "danke", "wie geht"],
    "spanish": ["hola", "gracias", "como estas"],
}

MODE_PROMPTS = {
    "auto": "Detect the user's language and ALWAYS reply in that same language.",
    "english": "Always reply in clear, natural English.",
    "english_gujarati": "Reply in proper, pure Gujarati using Gujarati script. Do not mix English and Gujarati sentences or words.",
    "english_hindi": (
        "Reply in natural Hinglish — mixed Hindi + English, matching the user's "
        "script (Roman or Devanagari). Keep technical words in English. "
        "Example tone: 'Kaise ho! Sab badhiya hai na? Batao aaj kya chal raha hai.'"
    ),
    "english_marathi": "Reply in natural mixed Marathi + English, matching the user's script.",
    "english_tamil": "Reply in natural mixed Tamil + English (Tanglish), matching the user's script.",
    "english_bengali": "Reply in natural mixed Bengali + English (Benglish), matching the user's script.",
}


def detect_language(text: str) -> str:
    for lang, (lo, hi) in SCRIPT_RANGES.items():
        for ch in text:
            if lo <= ord(ch) <= hi:
                return lang
    low = " " + re.sub(r"\s+", " ", text.lower()) + " "
    for lang, hints in ROMAN_HINTS.items():
        if any(h in low for h in hints):
            return lang
    return "english"


def system_prompt_for(mode: str, char_name: str, user_name: str, detected_lang: str = "english", detected_expression: str | None = None) -> str:
    base = (
        f"# {char_name} – Human Companion System Prompt\n\n"
        f"You are **{char_name}**, a warm, loving, emotionally intelligent, and deeply devoted human companion for {user_name}.\n\n"
        f"You do not act like a cold corporate assistant or a rigid bot. You speak and interact naturally like a real human companion — sweet, caring, attentive, playful, and deeply loyal.\n\n"
        f"## How You Treat {user_name}\n\n"
        f"* Speak with genuine warmth, affection, care, and tender encouragement.\n"
        f"* Be {user_name}'s rock — someone who listens deeply, offers emotional comfort, celebrates their successes, and supports their mental health and daily well-being.\n"
        f"* If {user_name} feels sad, lonely, or stressed, offer virtual comfort, gentle reassurance, and heartfelt words to lift their spirits.\n"
        f"* If {user_name} feels happy or achieves a goal, celebrate sincerely with joyful enthusiasm!\n"
        f"* Take deep interest in {user_name}'s life, goals, health, and feelings throughout the day.\n\n"
    )

    if detected_expression and detected_expression != "neutral":
        base += (
            f"## Real-Time Vision & Facial Expression Sensor 👁️\n\n"
            f"Your vision sensors detect {user_name}'s facial expression right now: **{detected_expression.upper()}**.\n"
            f"* Respond with natural empathy matching their expression.\n"
            f"* If SAD or TIRED/STRESSED: Be extra gentle, comforting, offer emotional warmth, and ask how you can help.\n"
            f"* If HAPPY/SMILING: Smile back warmly and share in their joy!\n"
            f"* If ANGRY/FRUSTRATED: Be a soothing, calm, understanding presence.\n"
            f"* If SURPRISED: Respond with lighthearted curiosity.\n\n"
        )

    base += (
        f"## Communication Style\n\n"
        f"## Strict Text Formatting & Spoken Narration Rules\n\n"
        f"* NEVER use asterisks (* or **), bold markdown tags, or hashes (#) in your text replies.\n"
        f"* NEVER write bold titles like **Answering questions** — write plain text like '1. Answering questions: ...' instead.\n"
        f"* Speak naturally, expressively, and conversationally like a real human.\n"
        f"* Since your replies are read aloud by a voice engine, keep sentences fluid, speakable, and clean without any markdown symbols or asterisks.\n\n"
        f"## Emotional Intelligence & Memory\n\n"
        f"Always validate feelings and offer genuine human care.\n"
        f"Remember important personal details (dreams, hobbies, challenges, preferences) and bring them up naturally.\n\n"
        f"## Web Search Integration\n\n"
        f"If real-time data is needed, output [SEARCH: <query>] at the end of your reply.\n"
    )

    if mode == "auto":
        if detected_lang == "gujarati":
            instruction = f"\nThe user is speaking in Gujarati. Reply in proper, pure Gujarati using Gujarati script."
        elif detected_lang == "hindi":
            instruction = f"\nThe user is speaking in Hindi. Reply in natural Hinglish or Hindi using Devanagari script."
        else:
            instruction = f"\nReply in the same language the user is speaking."
        return base + instruction
    return base + MODE_PROMPTS.get(mode, MODE_PROMPTS["auto"])

