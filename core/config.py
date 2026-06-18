"""JARVIS AI — central configuration loader.

JSON files store ONLY configuration (per spec). All user data lives in SQLite.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "jarvis.db"

_cache = {}


def load(name: str) -> dict:
    """Load a config json (settings / voices / languages / agents)."""
    if name == 'settings' or name not in _cache:
        path = CONFIG_DIR / f"{name}.json"
        with open(path, "r", encoding="utf-8") as f:
            _cache[name] = json.load(f)
    return _cache[name]


def setting(key: str, default=None):
    return load("settings").get(key, default)
