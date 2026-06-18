"""Authentication Agent — accounts, character profiles, sessions.

Onboarding flow (handled by the UI, persisted here):
  1. Choose character  : gender -> skin tone -> hair -> outfit -> AI name
  2. Choose voice      : one of 4 personas
  3. Choose language   : Auto / English / English+Gujarati / English+Hindi / ...
  4. Create account    : your name + secret word  ->  DONE
Login: name + secret word  ->  session token  ->  character wakes up + greets.
"""
from core.database import db, new_id, now, log_event
from core.security import hash_secret, verify_secret, create_session

ALLOWED = {
    "char_gender": {"male", "female"},
    "char_skin": {"porcelain", "fair", "tan", "brown", "deep"},
    "char_hair_style": {"short", "spiky", "long", "bun", "curly", "wave"},
    "char_hair_color": {"black", "brown", "blonde", "pink", "blue", "violet", "white"},
    "char_eyes": {"amber", "emerald", "sapphire", "violet", "rose", "crimson"},
    "char_outfit": {"cyan", "gold", "crimson", "violet", "rose"},
    "char_style": {"anime", "holo"},
    "voice_persona": {"jarvis_classic", "friday", "nova", "sage"},
    "language_mode": {"auto", "english", "english_gujarati", "english_hindi",
                      "english_marathi", "english_tamil", "english_bengali"},
}


def has_users() -> bool:
    with db() as conn:
        return conn.execute("SELECT COUNT(*) c FROM Users").fetchone()["c"] > 0


def _validate(profile: dict) -> dict:
    clean = {}
    for key, allowed in ALLOWED.items():
        val = profile.get(key)
        if val in allowed:
            clean[key] = val
    name = str(profile.get("char_name", "JARVIS")).strip()[:24]
    clean["char_name"] = name or "JARVIS"
    return clean


def create_account(username: str, display_name: str, secret_word: str, profile: dict):
    username = username.strip().lower()
    if not username or not secret_word or len(secret_word.strip()) < 3:
        raise ValueError("Name and a secret word (3+ characters) are required.")
    with db() as conn:
        if conn.execute("SELECT 1 FROM Users WHERE username=?", (username,)).fetchone():
            raise ValueError("That name is already registered. Try logging in.")
    digest, salt = hash_secret(secret_word)
    uid = new_id()
    p = _validate(profile)
    with db() as conn:
        conn.execute(
            "INSERT INTO Users VALUES (?,?,?,?,?,?,?)",
            (uid, username, display_name.strip() or username.title(),
             digest, salt, "commander", now()),
        )
        conn.execute(
            """INSERT INTO Profiles
               (user_id, char_gender, char_skin, char_hair_style, char_hair_color,
                char_eyes, char_outfit, char_style, char_name,
                voice_persona, language_mode)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (uid,
             p.get("char_gender", "female"), p.get("char_skin", "fair"),
             p.get("char_hair_style", "long"), p.get("char_hair_color", "black"),
             p.get("char_eyes", "sapphire"), p.get("char_outfit", "cyan"),
             p.get("char_style", "anime"), p["char_name"],
             p.get("voice_persona", "friday"),
             p.get("language_mode", "auto")),
        )
    log_event(uid, "account_created", username)
    return uid, create_session(uid)


def login(username: str, secret_word: str):
    with db() as conn:
        row = conn.execute(
            "SELECT id, secret_hash, secret_salt FROM Users WHERE username=?",
            (username.strip().lower(),),
        ).fetchone()
    if not row or not verify_secret(secret_word, row["secret_hash"], row["secret_salt"]):
        raise ValueError("Voiceprint mismatch — name or secret word is wrong.")
    log_event(row["id"], "login")
    return row["id"], create_session(row["id"])


def get_profile(user_id: str) -> dict:
    with db() as conn:
        u = conn.execute(
            "SELECT username, display_name, role FROM Users WHERE id=?", (user_id,)
        ).fetchone()
        p = conn.execute("SELECT * FROM Profiles WHERE user_id=?", (user_id,)).fetchone()
    out = dict(p) if p else {}
    out.update(dict(u) if u else {})
    out.pop("user_id", None)
    return out


def update_profile(user_id: str, changes: dict):
    clean = _validate({**get_profile(user_id), **changes})
    cols = ", ".join(f"{k}=?" for k in clean)
    with db() as conn:
        conn.execute(
            f"UPDATE Profiles SET {cols} WHERE user_id=?",
            (*clean.values(), user_id),
        )
    return get_profile(user_id)
