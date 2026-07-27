"""LIA AI — Unified SQLite & PostgreSQL database layer.

Exposes a standard context manager db() that automatically uses PostgreSQL/Supabase
if configured, otherwise falling back to SQLite.
"""
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager

from .config import DB_PATH

# ── Unified Schema (PostgreSQL & SQLite compatible) ────────────────────────
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
    -- character / avatar customization
    char_gender TEXT DEFAULT 'female',        -- male | female
    char_skin TEXT DEFAULT 'fair',            -- porcelain|fair|tan|brown|deep
    char_hair_style TEXT DEFAULT 'long',      -- short|spiky|long|bun|curly|wave
    char_hair_color TEXT DEFAULT 'black',     -- black|brown|blonde|pink|blue|violet|white
    char_eyes TEXT DEFAULT 'sapphire',        -- amber|emerald|sapphire|violet|rose|crimson
    char_outfit TEXT DEFAULT 'cyan',          -- cyan|gold|crimson|violet|rose
    char_style TEXT DEFAULT 'anime',          -- anime | holo
    char_name TEXT DEFAULT 'LIA',
    char_face_shape TEXT DEFAULT 'default',
    char_nose_shape TEXT DEFAULT 'default',
    char_lip_shape TEXT DEFAULT 'default',
    char_makeup TEXT DEFAULT 'none',
    char_freckles INTEGER DEFAULT 0,          -- 0 = false, 1 = true
    char_height REAL DEFAULT 1.0,
    char_proportions TEXT DEFAULT 'default',
    char_posture TEXT DEFAULT 'default',
    char_accessories TEXT DEFAULT '[]',       -- JSON string: ['glasses', 'earrings']
    char_clothing_style TEXT DEFAULT 'casual',-- casual|professional|formal|scifi|fantasy
    -- avatar model selection
    avatar_type TEXT DEFAULT 'lia',           -- lia | male | custom
    vrm_path TEXT DEFAULT '',                 -- custom vrm url
    -- voice & language
    voice_persona TEXT DEFAULT 'friday',
    voice_accent TEXT DEFAULT 'us',           -- us | gb | in | au
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
    category TEXT,                            -- preference | goal | dream | career | relationship | milestone | fact | vault
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
    name TEXT,
    platform TEXT,
    last_seen REAL
);

CREATE TABLE IF NOT EXISTS Permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    permission TEXT,
    granted INTEGER DEFAULT 0,
    updated_at REAL
);

CREATE TABLE IF NOT EXISTS Settings (
    user_id TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS Notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    body TEXT,
    read INTEGER DEFAULT 0,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    title TEXT,
    status TEXT DEFAULT 'pending',            -- pending | in_progress | completed
    due_at REAL,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Detections (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    kind TEXT,
    label TEXT,
    confidence REAL,
    meta TEXT,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS KnowledgeCache (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    event TEXT,
    detail TEXT,
    created_at REAL
);

-- Productivity Additions
CREATE TABLE IF NOT EXISTS CalendarEvents (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time REAL,
    end_time REAL,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Notes (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    title TEXT NOT NULL,
    content TEXT,
    tags TEXT DEFAULT '[]',                   -- JSON string of tags
    updated_at REAL,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS Reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES Users(id),
    title TEXT NOT NULL,
    trigger_at REAL,
    status TEXT DEFAULT 'pending',            -- pending | triggered | dismissed
    created_at REAL
);

CREATE TABLE IF NOT EXISTS VoiceSettings (
    user_id TEXT PRIMARY KEY REFERENCES Users(id),
    voice_id TEXT DEFAULT 'friday',
    accent TEXT DEFAULT 'us',                 -- us | gb | in | au
    pitch REAL DEFAULT 1.0,
    speed REAL DEFAULT 1.0,
    style TEXT DEFAULT 'default',
    emotional_speech INTEGER DEFAULT 0,       -- 0 = false, 1 = true
    custom_voice_path TEXT DEFAULT '',
    legal_authorized INTEGER DEFAULT 0,       -- 0 = false, 1 = true
    updated_at REAL
);
"""

# ── PostgreSQL Wrapper Adaptor ─────────────────────────────────────────────
class PostgresCursor:
    def __init__(self, pg_cursor):
        self.cursor = pg_cursor

    def execute(self, query, params=None):
        # Convert ? placeholders to %s
        query = query.replace("?", "%s")
        # Convert SQLite specific dialect syntax to standard PG
        if "INSERT OR REPLACE INTO" in query:
            query = query.replace("INSERT OR REPLACE INTO", "INSERT INTO")
            if "knowledgecache" in query.lower():
                query += " ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, created_at=EXCLUDED.created_at"
            elif "settings" in query.lower():
                query += " ON CONFLICT (user_id, key) DO UPDATE SET value=EXCLUDED.value"
            elif "voicesettings" in query.lower():
                query += " ON CONFLICT (user_id) DO UPDATE SET voice_id=EXCLUDED.voice_id, accent=EXCLUDED.accent, pitch=EXCLUDED.pitch, speed=EXCLUDED.speed, style=EXCLUDED.style, emotional_speech=EXCLUDED.emotional_speech, custom_voice_path=EXCLUDED.custom_voice_path, legal_authorized=EXCLUDED.legal_authorized, updated_at=EXCLUDED.updated_at"
        elif "INSERT OR IGNORE INTO" in query:
            query = query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            query += " ON CONFLICT DO NOTHING"
        
        self.cursor.execute(query, params)
        return self

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [dict(r) for r in rows]

    @property
    def rowcount(self):
        return self.cursor.rowcount

class PostgresConnection:
    def __init__(self, pg_conn):
        self.conn = pg_conn

    def cursor(self):
        import psycopg2.extras
        return PostgresCursor(self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, query, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def executescript(self, script):
        import psycopg2.extras
        cur = self.conn.cursor()
        # Clean lines and run statements
        for statement in script.split(";"):
            cleaned = statement.strip()
            if cleaned:
                # Replace SQLite type keywords
                cleaned = cleaned.replace("AUTOINCREMENT", "")
                cur.execute(cleaned)
        cur.close()

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

# ── Dynamic Connection Discovery ───────────────────────────────────────────
def _get_pg_conn():
    # Check env variables first (DATABASE_URL or POSTGRES_URL)
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not db_url:
        try:
            from core.config import load
            db_url = load("settings").get("supabase_db_url")
        except Exception:
            pass
    if not db_url:
        return None

    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        return PostgresConnection(conn)
    except Exception as e:
        print(f"[Database] PostgreSQL connection failed: {e}. Falling back to SQLite.")
        return None

@contextmanager
def db():
    pg_conn = _get_pg_conn()
    if pg_conn:
        try:
            yield pg_conn
            pg_conn.commit()
        except Exception as e:
            pg_conn.rollback()
            raise e
        finally:
            pg_conn.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

def init_db():
    with db() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)

def _migrate(conn):
    """Apply migrations / check columns exist for both SQLite and Postgres."""
    # Profiles additions
    _add_col(conn, "Profiles", "char_face_shape", "TEXT DEFAULT 'default'")
    _add_col(conn, "Profiles", "char_nose_shape", "TEXT DEFAULT 'default'")
    _add_col(conn, "Profiles", "char_lip_shape", "TEXT DEFAULT 'default'")
    _add_col(conn, "Profiles", "char_makeup", "TEXT DEFAULT 'none'")
    _add_col(conn, "Profiles", "char_freckles", "INTEGER DEFAULT 0")
    _add_col(conn, "Profiles", "char_height", "REAL DEFAULT 1.0")
    _add_col(conn, "Profiles", "char_proportions", "TEXT DEFAULT 'default'")
    _add_col(conn, "Profiles", "char_posture", "TEXT DEFAULT 'default'")
    _add_col(conn, "Profiles", "char_accessories", "TEXT DEFAULT '[]'")
    _add_col(conn, "Profiles", "char_clothing_style", "TEXT DEFAULT 'casual'")
    _add_col(conn, "Profiles", "avatar_type", "TEXT DEFAULT 'lia'")
    _add_col(conn, "Profiles", "vrm_path", "TEXT DEFAULT ''")
    _add_col(conn, "Profiles", "voice_accent", "TEXT DEFAULT 'us'")
    # VoiceSettings additions
    _add_col(conn, "VoiceSettings", "accent", "TEXT DEFAULT 'us'")

def _add_col(conn, table: str, col: str, definition: str):
    """Add column if missing."""
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
