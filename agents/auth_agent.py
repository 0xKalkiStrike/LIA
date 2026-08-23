"""Authentication Agent — accounts, character profiles, JWT tokens."""
import time
from core import json_db
from core.jwt_security import hash_password, verify_password, create_token

def _new_id() -> str:
    import uuid
    return uuid.uuid4().hex

def _now() -> float:
    return time.time()

ENUMS = {
    "char_gender": {"male", "female"},
    "char_skin": {"porcelain", "fair", "tan", "brown", "deep"},
    "char_hair_style": {"short", "spiky", "long", "bun", "curly", "wave"},
    "char_hair_color": {"black", "brown", "blonde", "pink", "blue", "violet", "white"},
    "char_eyes": {"amber", "emerald", "sapphire", "violet", "rose", "crimson"},
    "char_outfit": {"cyan", "gold", "crimson", "violet", "rose"},
    "char_style": {"anime", "holo"},
    "voice_persona": {"jarvis_classic", "friday", "nova", "sage", "custom"},
    "voice_accent": {"us", "gb", "in", "au"},
    "language_mode": {"auto", "english", "english_gujarati", "english_hindi",
                      "english_marathi", "english_tamil", "english_bengali"},
}

def has_users() -> bool:
    return json_db.count("users") > 0

def _validate(profile: dict) -> dict:
    """Validate and sanitize profile data."""
    clean = {}

    # Enums
    for key, allowed in ENUMS.items():
        val = profile.get(key)
        if val in allowed:
            clean[key] = val

    # String fields
    str_fields = ["avatar_type", "vrm_path", "char_accessories", "char_clothing_style", "greeting_style"]
    for key in str_fields:
        if key in profile:
            clean[key] = str(profile[key]).strip()

    # Numeric fields
    num_fields = ["char_height", "speech_rate", "pitch", "volume_level", "char_freckles"]
    for key in num_fields:
        if key in profile:
            try:
                clean[key] = float(profile[key])
            except (ValueError, TypeError):
                pass

    # Special cases
    name = str(profile.get("char_name", "LIA")).strip()[:24]
    clean["char_name"] = name or "LIA"

    return clean

def create_account(username: str, display_name: str, secret_word: str, profile: dict):
    """Create new user account."""
    username = username.strip().lower()
    if not username or not secret_word or len(secret_word.strip()) < 3:
        raise ValueError("Name and a secret word (3+ characters) are required.")

    # Check if username exists
    if json_db.find_one("users", {"username": username}):
        raise ValueError("That name is already registered. Try logging in.")

    uid = _new_id()
    digest, salt = hash_password(secret_word)
    p = _validate(profile)

    # Create user
    user_doc = {
        "username": username,
        "display_name": display_name.strip() or username.title(),
        "secret_hash": digest,
        "secret_salt": salt,
        "role": "commander",
        "created_at": _now()
    }
    json_db.insert("users", uid, user_doc)

    # Create profile
    profile_doc = {
        "user_id": uid,
        "char_gender": p.get("char_gender", "female"),
        "char_skin": p.get("char_skin", "fair"),
        "char_hair_style": p.get("char_hair_style", "long"),
        "char_hair_color": p.get("char_hair_color", "black"),
        "char_eyes": p.get("char_eyes", "sapphire"),
        "char_outfit": p.get("char_outfit", "cyan"),
        "char_style": p.get("char_style", "anime"),
        "char_name": p["char_name"],
        "char_face_shape": p.get("char_face_shape", "default"),
        "char_nose_shape": p.get("char_nose_shape", "default"),
        "char_lip_shape": p.get("char_lip_shape", "default"),
        "char_makeup": p.get("char_makeup", "none"),
        "char_freckles": p.get("char_freckles", 0),
        "char_height": p.get("char_height", 1.0),
        "char_proportions": p.get("char_proportions", "default"),
        "char_posture": p.get("char_posture", "default"),
        "char_accessories": p.get("char_accessories", "[]"),
        "char_clothing_style": p.get("char_clothing_style", "casual"),
        "voice_persona": p.get("voice_persona", "friday"),
        "voice_accent": p.get("voice_accent", "us"),
        "language_mode": p.get("language_mode", "auto"),
        "avatar_type": p.get("avatar_type", "lia"),
        "vrm_path": p.get("vrm_path", ""),
        "speech_rate": p.get("speech_rate", 1.0),
        "pitch": p.get("pitch", 1.0),
        "volume_level": p.get("volume_level", 60),
        "greeting_style": p.get("greeting_style", "time_aware")
    }
    json_db.insert("profiles", uid, profile_doc)

    token = create_token(uid)
    return uid, token

def login(username: str, secret_word: str):
    """Login user and return token."""
    user = json_db.find_one("users", {"username": username.strip().lower()})

    if not user or not verify_password(secret_word, user["secret_hash"], user["secret_salt"]):
        raise ValueError("Voiceprint mismatch — name or secret word is wrong.")

    # Log event
    log_event(user["id"], "login")

    token = create_token(user["id"])
    return user["id"], token

def get_profile(user_id: str) -> dict:
    """Get user profile."""
    user = json_db.get("users", user_id)
    profile = json_db.get("profiles", user_id)

    out = {}
    if profile:
        out.update(profile)
    if user:
        out.update({
            "username": user.get("username"),
            "display_name": user.get("display_name"),
            "role": user.get("role")
        })

    out.pop("user_id", None)
    out.pop("secret_hash", None)
    out.pop("secret_salt", None)
    out.pop("id", None)

    return out

def update_profile(user_id: str, changes: dict):
    """Update user profile."""
    current = get_profile(user_id)
    updated = {**current, **changes}
    clean = _validate(updated)

    # Update profiles collection
    profile = json_db.get("profiles", user_id)
    if profile:
        profile.update(clean)
        json_db.insert("profiles", user_id, profile)

    return get_profile(user_id)

def log_event(user_id: str, event: str, detail: str = ""):
    """Log user event."""
    log_doc = {
        "user_id": user_id,
        "event": event,
        "detail": detail,
        "created_at": _now()
    }
    json_db.insert("logs", _new_id(), log_doc)
