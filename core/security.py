"""JARVIS AI — security: secret-word hashing (PBKDF2) + session tokens.

Each user can only access their own data: every API route resolves the
session token to a user_id and scopes all queries to it.
"""
import hashlib
import hmac
import os
import secrets

from .database import db, new_id, now

SESSION_TTL = 60 * 60 * 12  # 12 hours


def hash_secret(secret_word: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", secret_word.lower().strip().encode(), bytes.fromhex(salt), 200_000
    ).hex()
    return digest, salt


def verify_secret(secret_word: str, digest: str, salt: str) -> bool:
    candidate, _ = hash_secret(secret_word, salt)
    return hmac.compare_digest(candidate, digest)


def create_session(user_id: str, device_info: str = "web") -> str:
    token = secrets.token_urlsafe(32)
    with db() as conn:
        conn.execute(
            "INSERT INTO Sessions VALUES (?,?,?,?,?)",
            (token, user_id, now(), now() + SESSION_TTL, device_info),
        )
    return token


def resolve_session(token: str | None) -> str | None:
    """Return user_id for a valid session token, else None."""
    if not token:
        return None
    with db() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM Sessions WHERE token=?", (token,)
        ).fetchone()
    if row and row["expires_at"] > now():
        return row["user_id"]
    return None


def end_session(token: str):
    with db() as conn:
        conn.execute("DELETE FROM Sessions WHERE token=?", (token,))
