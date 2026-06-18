"""JARVIS AI — SQLite database layer.

Tables (per spec): Users, Profiles, Voiceprints, Memories, Conversations,
Devices, Permissions, Sessions, Settings, Notifications, Tasks, Detections,
KnowledgeCache, Logs.

Profiles additionally store the user's CHARACTER (avatar) configuration:
gender, skin tone, hair style/color, outfit color — chosen during onboarding.
"""
import sqlite3
import time
import uuid
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    secret_salt TEXT NOT NULL,
    role TEXT DEFAULT 'commander',
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Profiles (
    user_id TEXT PRIMARY KEY REFERENCES Users(id),
    -- character / avatar
    char_gender TEXT DEFAULT 'female',        -- male | female
    char_skin TEXT DEFAULT 'fair',            -- porcelain|fair|tan|brown|deep
    char_hair_style TEXT DEFAULT 'long',      -- short|spiky|long|bun|curly|wave
    char_hair_color TEXT DEFAULT 'black',     -- black|brown|blonde|pink|blue|violet|white
    char_eyes TEXT DEFAULT 'sapphire',        -- amber|emerald|sapphire|violet|rose|crimson
    char_outfit TEXT DEFAULT 'cyan',          -- cyan|gold|crimson|violet|rose
    char_style TEXT DEFAULT 'anime',          -- anime | holo
    char_name TEXT DEFAULT 'JARVIS',
    -- avatar model selection
    avatar_type TEXT DEFAULT 'lia',           -- lia | male | custom
    vrm_path TEXT DEFAULT '',                 -- custom vrm url (empty = use LIA.vrm default)
    -- voice & language
    voice_persona TEXT DEFAULT 'jarvis_classic',
    language_mode TEXT DEFAULT 'auto',
    speech_rate REAL DEFAULT 1.0,
    pitch REAL DEFAULT 1.0,
    volume_level INTEGER DEFAULT 60,
    greeting_style TEXT DEFAULT 'time_aware'
);

CREATE TABLE IF NOT EXISTS Voiceprints (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    embedding BLOB,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    created_at REAL,
    expires_at REAL,
    device_info TEXT
);

CREATE TABLE IF NOT EXISTS Memories (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    category TEXT,
    content TEXT,
    importance INTEGER DEFAULT 1,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    role TEXT,
    content TEXT,
    language TEXT,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Devices (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    name TEXT, platform TEXT, last_seen REAL
);

CREATE TABLE IF NOT EXISTS Permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    permission TEXT, granted INTEGER DEFAULT 0, updated_at REAL
);

CREATE TABLE IF NOT EXISTS Settings (
    user_id TEXT, key TEXT, value TEXT,
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS Notifications (
    id TEXT PRIMARY KEY, user_id TEXT, title TEXT, body TEXT,
    read INTEGER DEFAULT 0, created_at REAL
);

CREATE TABLE IF NOT EXISTS Tasks (
    id TEXT PRIMARY KEY, user_id TEXT, title TEXT, status TEXT DEFAULT 'pending',
    due_at REAL, created_at REAL
);

CREATE TABLE IF NOT EXISTS Detections (
    id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, label TEXT,
    confidence REAL, meta TEXT, created_at REAL
);

CREATE TABLE IF NOT EXISTS KnowledgeCache (
    key TEXT PRIMARY KEY, value TEXT, created_at REAL
);

CREATE TABLE IF NOT EXISTS Logs (
    id TEXT PRIMARY KEY, user_id TEXT, event TEXT, detail TEXT, created_at REAL
);
"""


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as conn:
        conn.executescript(SCHEMA)
        # Migrate existing databases — add columns introduced after initial schema
        _migrate(conn)


def _migrate(conn):
    """Apply non-destructive column additions to existing databases."""
    _add_col(conn, "Profiles", "avatar_type", "TEXT DEFAULT 'lia'")
    _add_col(conn, "Profiles", "vrm_path", "TEXT DEFAULT ''")


def _add_col(conn, table: str, col: str, definition: str):
    """Add a column if it doesn't exist yet (SQLite-compatible migration)."""
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
    except Exception:
        pass  # Column already exists


def new_id() -> str:
    return uuid.uuid4().hex


def now() -> float:
    return time.time()


def log_event(user_id, event, detail=""):
    with db() as conn:
        conn.execute(
            "INSERT INTO Logs VALUES (?,?,?,?,?)",
            (new_id(), user_id, event, detail, now()),
        )
