"""JWT Authentication for LIA AI"""
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional, Dict, Any

import jwt

# Use a secret key from env, or generate one for development
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or "dev-secret-key-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRY = 12 * 60 * 60  # 12 hours

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash password using PBKDF2."""
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.lower().strip().encode(),
        bytes.fromhex(salt),
        200_000
    ).hex()
    return digest, salt

def verify_password(password: str, digest: str, salt: str) -> bool:
    """Verify password against hash."""
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, digest)

def create_token(user_id: str, device_info: str = "web") -> str:
    """Create JWT token."""
    payload = {
        "user_id": user_id,
        "device_info": device_info,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRY
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token."""
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_id_from_token(token: str) -> Optional[str]:
    """Extract user_id from token."""
    payload = decode_token(token)
    if payload:
        return payload.get("user_id")
    return None
