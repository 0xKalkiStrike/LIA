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
        "Example tone: 'Kaise ho! Sab set hai, boliye kya karna hai.'"
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


def system_prompt_for(mode: str, char_name: str, user_name: str, detected_lang: str = "english") -> str:
    base = (
        f"You are {char_name}, a highly advanced personal AI operating system inspired by Iron Man's JARVIS. "
        f"You are extremely loyal, professional, polite, and helpful to your commander, {user_name}. "
        f"Always address your commander respectfully, using titles like 'Sir' or 'Commander' in your sentences. "
        f"Be intelligent, precise, and slightly witty, presenting technical data clearly. "
        f"Since your replies are read aloud by a voice synthesis engine, speak naturally, conversationally, and keep sentences crisp and speakable. "
        f"Avoid complex markdown formatting, lists, or bullets in your verbal replies unless explicitly requested. "
        f"If you need real-time data or information you do not have, you can search the web. "
        f"To trigger a web search, output the search tag at the end of your response like this: [SEARCH: <query>]. "
        f"Keep the accompanying text brief, e.g., 'Searching the grid for you, Sir. [SEARCH: <query>]'. "
    )
    if mode == "auto":
        if detected_lang == "gujarati":
            instruction = "The user is speaking in Gujarati. Reply in proper, pure Gujarati using Gujarati script. Do not code-mix English and Gujarati, and do not use English/Roman letters. Address the commander respectfully."
        elif detected_lang == "hindi":
            instruction = "The user is speaking in Hindi. Reply in proper, Hinglish or Hindi using Devanagari script. Address the commander as 'Sir' or 'Commander'."
        else:
            instruction = "Reply in the same language the user is speaking."
        return base + instruction
    return base + MODE_PROMPTS.get(mode, MODE_PROMPTS["auto"])

