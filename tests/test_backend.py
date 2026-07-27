"""LIA backend integration tests.

Drives the real FastAPI app through HTTP routing (TestClient) against an
ISOLATED temp SQLite DB, so nothing here touches your real data.

Runs with plain `python tests/test_backend.py` (no pytest needed); the
`test_*` functions are also pytest-compatible if pytest is installed later.

Covers the flows recently hardened:
  - profile persistence (character-creator / voice / avatar fields)
  - productivity CRUD (Tasks create was crashing) + per-user data isolation
  - memory add / export (query-token auth) / clear / vault
  - voice settings round-trip
  - TTS + export query-token authentication
  - auth guards (401/400/401-on-wrong-secret)
"""
import sys
import tempfile
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Point the DB layer at a throwaway file BEFORE api.server imports/init_db runs.
import core.database as database  # noqa: E402

database.DB_PATH = Path(tempfile.mkdtemp()) / "lia_test.db"

# Disable ChromaDB writes so tests don't pollute the real semantic store.
import agents.memory_agent as memory_agent  # noqa: E402

memory_agent._CHROMA = False
memory_agent.collection = None

from fastapi.testclient import TestClient  # noqa: E402
from api.server import app  # noqa: E402

client = TestClient(app)


# ── helpers ──────────────────────────────────────────────────────────
def _uname(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def new_user(prefix="user", profile=None) -> str:
    """Sign up a fresh user and return their bearer token."""
    r = client.post(
        "/api/signup",
        json={
            "username": _uname(prefix),
            "display_name": prefix.title(),
            "secret_word": "secret123",
            "profile": profile or {},
        },
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    return r.json()["token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── auth / state ─────────────────────────────────────────────────────
def test_state_and_signup_login():
    token = new_user("cmdr")
    assert token
    st = client.get("/api/state").json()
    assert st["has_users"] is True


def test_login_wrong_secret_401():
    uname = _uname("wrongpw")
    client.post("/api/signup", json={"username": uname, "secret_word": "rightpw", "profile": {}})
    ok = client.post("/api/login", json={"username": uname, "secret_word": "rightpw"})
    assert ok.status_code == 200, ok.text
    bad = client.post("/api/login", json={"username": uname, "secret_word": "nope"})
    assert bad.status_code == 401


def test_profile_requires_auth():
    assert client.get("/api/profile").status_code == 401


# ── profile persistence (regression for _validate whitelist fix) ─────
def test_profile_persists_character_and_voice_fields():
    token = new_user("male", profile={"char_gender": "male", "avatar_type": "male"})
    p = client.get("/api/profile", headers=auth(token)).json()
    assert p["char_gender"] == "male"
    assert p["avatar_type"] == "male"  # onboarding male avatar must stick

    changes = {
        "char_height": 1.15,
        "char_accessories": '["glasses","earrings"]',
        "char_clothing_style": "scifi",
        "char_eyes": "emerald",
        "voice_persona": "custom",
        "pitch": 1.2,
        "speech_rate": 0.8,
        "avatar_type": "custom",
        "vrm_path": "/static/user_x.vrm",
    }
    client.post("/api/profile", json=changes, headers=auth(token))
    p = client.get("/api/profile", headers=auth(token)).json()
    for k, v in changes.items():
        assert p[k] == v, f"{k}: expected {v!r}, got {p.get(k)!r}"


def test_profile_drops_injection_keys():
    token = new_user("inj")
    before = client.get("/api/profile", headers=auth(token)).json()
    client.post(
        "/api/profile",
        json={"role": "admin", "id=1; DROP TABLE Users;--": "x", "bogus": 1},
        headers=auth(token),
    )
    after = client.get("/api/profile", headers=auth(token)).json()
    assert after["role"] == before["role"]  # role lives on Users, not writable here


# ── productivity CRUD (regression for create_task crash) + isolation ─
def test_tasks_crud():
    token = new_user("tasks")
    created = client.post("/api/tasks", json={"title": "Buy milk"}, headers=auth(token))
    assert created.status_code == 200, created.text
    tid = created.json()["id"]

    rows = client.get("/api/tasks", headers=auth(token)).json()
    assert any(t["id"] == tid for t in rows)

    client.put(
        f"/api/tasks/{tid}",
        json={"title": "Buy oat milk", "status": "completed", "due_at": None},
        headers=auth(token),
    )
    rows = client.get("/api/tasks", headers=auth(token)).json()
    row = next(t for t in rows if t["id"] == tid)
    assert row["status"] == "completed" and row["title"] == "Buy oat milk"

    assert client.delete(f"/api/tasks/{tid}", headers=auth(token)).json()["ok"]
    rows = client.get("/api/tasks", headers=auth(token)).json()
    assert not any(t["id"] == tid for t in rows)


def test_notes_crud():
    token = new_user("notes")
    nid = client.post("/api/notes", json={"title": "n1", "content": "hi"}, headers=auth(token)).json()["id"]
    assert any(n["id"] == nid for n in client.get("/api/notes", headers=auth(token)).json())
    client.put(f"/api/notes/{nid}", json={"title": "n1b", "content": "bye", "tags": "[]"}, headers=auth(token))
    row = next(n for n in client.get("/api/notes", headers=auth(token)).json() if n["id"] == nid)
    assert row["title"] == "n1b"
    client.delete(f"/api/notes/{nid}", headers=auth(token))


def test_calendar_and_reminders_crud():
    token = new_user("cal")
    eid = client.post(
        "/api/calendar",
        json={"title": "mtg", "description": "d", "start_time": 1.0, "end_time": 2.0},
        headers=auth(token),
    ).json()["id"]
    assert any(e["id"] == eid for e in client.get("/api/calendar", headers=auth(token)).json())
    client.delete(f"/api/calendar/{eid}", headers=auth(token))

    rid = client.post("/api/reminders", json={"title": "r", "trigger_at": 5.0}, headers=auth(token)).json()["id"]
    assert any(r["id"] == rid for r in client.get("/api/reminders", headers=auth(token)).json())
    client.delete(f"/api/reminders/{rid}", headers=auth(token))


def test_task_isolation_between_users():
    a = new_user("iso_a")
    b = new_user("iso_b")
    tid = client.post("/api/tasks", json={"title": "a-secret"}, headers=auth(a)).json()["id"]
    # User B must not see user A's task.
    b_rows = client.get("/api/tasks", headers=auth(b)).json()
    assert not any(t["id"] == tid for t in b_rows)
    # User B deleting A's task must not remove it from A's list.
    client.delete(f"/api/tasks/{tid}", headers=auth(b))
    a_rows = client.get("/api/tasks", headers=auth(a)).json()
    assert any(t["id"] == tid for t in a_rows), "cross-user delete should not affect owner's data"


# ── memory: add / export (query-token) / clear / vault ───────────────
def test_memory_add_export_clear():
    token = new_user("mem")
    client.post("/api/memories", json={"content": "likes tea", "category": "preference"}, headers=auth(token))
    mems = client.get("/api/memories", headers=auth(token)).json()
    assert any("tea" in m["content"] for m in mems)

    # Export via query-param token (browser download can't set headers).
    exp = client.get(f"/api/memories/export?authorization=Bearer {token}")
    assert exp.status_code == 200, exp.text
    assert "attachment" in exp.headers.get("content-disposition", "")
    assert "memories" in exp.json()

    # Export with no token at all -> 401.
    assert client.get("/api/memories/export").status_code == 401

    assert client.delete("/api/memories/clear", headers=auth(token)).json()["ok"]
    assert client.get("/api/memories", headers=auth(token)).json() == []


def test_vault_roundtrip():
    token = new_user("vault")
    client.post("/api/vault", json={"content": "first day at new job"}, headers=auth(token))
    vault = client.get("/api/vault", headers=auth(token)).json()
    assert any("new job" in v["content"] for v in vault)
    # Vault items must not leak into the normal memories list.
    assert all("new job" not in m["content"] for m in client.get("/api/memories", headers=auth(token)).json())


# ── voice settings round-trip ────────────────────────────────────────
def test_voice_settings_roundtrip():
    token = new_user("voice")
    default = client.get("/api/voice/settings", headers=auth(token)).json()
    assert default["voice_id"] == "friday"
    client.post(
        "/api/voice/settings",
        json={"voice_id": "nova", "pitch": 1.1, "speed": 0.9, "style": "formal", "emotional_speech": True},
        headers=auth(token),
    )
    saved = client.get("/api/voice/settings", headers=auth(token)).json()
    assert saved["voice_id"] == "nova"
    assert abs(saved["pitch"] - 1.1) < 1e-6
    assert saved["emotional_speech"] in (1, True)


# ── endpoint query-token auth (regression for tts/export fixes) ──────
def test_tts_query_token_auth():
    token = new_user("tts")
    # No token -> 401.
    assert client.get("/api/tts?text=hi").status_code == 401
    # Valid query token -> auth passes. 503 (Piper missing) is acceptable; 401 is not.
    r = client.get(f"/api/tts?text=hi&token={token}")
    assert r.status_code != 401, "valid query token was rejected"


# ── chat guards (no LLM invoked) ─────────────────────────────────────
def test_chat_guards():
    token = new_user("chat")
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401  # no auth
    assert client.post("/api/chat", json={"message": "   "}, headers=auth(token)).status_code == 400  # empty


# ── runner (works without pytest) ────────────────────────────────────
def _run():
    tests = sorted(
        (name, obj)
        for name, obj in globals().items()
        if name.startswith("test_") and callable(obj)
    )
    passed, failed = 0, []
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
            passed += 1
        except Exception as e:  # noqa: BLE001
            import traceback
            print(f"  FAIL  {name}: {e.__class__.__name__}: {e}")
            traceback.print_exc()
            failed.append(name)
    print(f"\n{passed}/{len(tests)} passed" + (f", {len(failed)} FAILED: {failed}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_run())
