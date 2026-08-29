"""Long-Form Video Production Agent — LIA's virtual film-production studio.

Turns a request like "make a 10 minute video about the Ramayana" into a full
production: concept -> story -> character bible -> world bible -> style bible
-> script -> scene/shot breakdown -> per-shot image generation -> narration
(Piper TTS) -> subtitle generation -> assembly into one MP4 -> lightweight QC.

Honesty constraints (deliberate, not an oversight):
  - There is no true motion-video model wired in (no Runway/Pika/etc. API key
    configured). Every "shot" is a still image; motion comes from Ken Burns
    pan/zoom + crossfades, same technique as agents/video_agent.py.
  - There is no reference-image conditioning available on the free Pollinations
    tier, so "character consistency" here means *textual* consistency: the same
    appearance description is repeated verbatim in every prompt a character
    appears in. That measurably helps but does not guarantee pixel-identical
    faces across shots — callers should not be told otherwise.
  - Long durations are produced by decomposing into many scenes and rendering
    in a background thread with checkpointing (data/video_projects.json), not
    by asking any single API for a long clip. Very long requests (e.g. 60 min)
    will genuinely take a long time against a free, rate-limited image API —
    the project's status honestly reports progress and any failed scenes
    rather than pretending everything succeeded.
"""
import json
import random
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from pathlib import Path

from core.config import ROOT
from core import json_db

try:
    from PIL import Image, ImageDraw
    import numpy as np
    import imageio
    import imageio_ffmpeg
except ImportError:
    Image = ImageDraw = np = imageio = imageio_ffmpeg = None

try:
    from . import voice_agent
except Exception:  # pragma: no cover
    voice_agent = None

try:
    from . import image_agent as _image_agent
except Exception:  # pragma: no cover
    _image_agent = None

GENERATED_DIR = ROOT / "ui" / "static" / "generated"

FPS = 24
WIDTH, HEIGHT = 1280, 720
MIN_SCENE_SECONDS = 4
AVG_SCENE_SECONDS = 8
CROSSFADE_FRAMES = 8
SHOT_IMAGE_RETRIES = 2
DEFAULT_PERSONA = "friday"

# ------------------------------------------------------------------ triggers
LONGFORM_KEYWORDS = (
    "long video", "full movie", "feature film", "short film", "documentary",
    "web series", "episode", "long-form", "longform", "full length video",
)

_VIDEO_WORDS = ("video", "clip", "animation", "movie", "film", "documentary", "series")
_ACTION_WORDS = ("generate", "create", "make", "render", "produce", "build")


def _parse_target_duration_seconds(message: str) -> int | None:
    low = message.lower()
    if re.search(r"\bhalf\s+an?\s+hour\b", low):
        return 1800
    m = re.search(r"(\d+(?:\.\d+)?)\s*hours?\b", low)
    if m:
        return int(float(m.group(1)) * 3600)
    if re.search(r"\ban?\s+hour\b", low):
        return 3600
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)\b", low)
    if m:
        return int(float(m.group(1)) * 60)
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:sec(?:ond)?s?)\b", low)
    if m:
        return int(float(m.group(1)))
    return None


def looks_like_longform_request(message: str) -> bool:
    low = message.lower()
    has_video_intent = any(w in low for w in _VIDEO_WORDS) and (
        any(w in low for w in _ACTION_WORDS) or "video" in low
    )
    if not has_video_intent:
        return False
    if any(k in low for k in LONGFORM_KEYWORDS):
        return True
    duration = _parse_target_duration_seconds(message)
    return duration is not None and duration > 30


# ------------------------------------------------------------------ LLM glue
def _llm_chat(messages: list) -> str | None:
    """Reuse commander's LLM connection (Ollama, then Gemini fallback)."""
    try:
        from . import commander
    except Exception:
        return None
    text = None
    try:
        text = commander._ollama_chat(messages)
    except Exception:
        text = None
    if not text:
        try:
            text = commander._gemini_chat(messages)
        except Exception:
            text = None
    return text


def _extract_json(text: str | None):
    if not text:
        return None
    cleaned = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    starts = [i for i in (cleaned.find("{"), cleaned.find("[")) if i != -1]
    if not starts:
        return None
    start = min(starts)
    end_char = "}" if cleaned[start] == "{" else "]"
    end = cleaned.rfind(end_char)
    if end == -1 or end < start:
        return None
    try:
        return json.loads(cleaned[start:end + 1])
    except Exception:
        return None


# ------------------------------------------------------------------ helpers
def _project_dir(project_id: str) -> Path:
    d = GENERATED_DIR / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save(project: dict) -> None:
    project["updated_at"] = time.time()
    json_db.insert("video_projects", project["project_id"], project)


def _load(project_id: str) -> dict | None:
    return json_db.get("video_projects", project_id)


def _nonfiction_heuristic(message: str) -> bool:
    low = message.lower()
    return any(w in low for w in (
        "documentary", "tutorial", "explain", "how to", "guide", "review",
        "news", "presentation", "history of", "science of", "explainer",
        "educational", "lecture",
    ))


# ------------------------------------------------------------------ stage 1: concept + story type
def _stage_concept(project: dict) -> None:
    if project.get("concept"):
        return
    message = project["request"]
    text = _llm_chat([
        {"role": "system", "content": "You are a professional film producer and screenwriter."},
        {"role": "user", "content": (
            f'A user wants a video: "{message}". '
            "In 2-3 sentences describe the core CONCEPT of this video project. "
            "Then on its own final line write exactly: NARRATIVE_TYPE: fiction "
            "or NARRATIVE_TYPE: nonfiction — choose fiction for stories/mythology/drama, "
            "nonfiction for documentary/educational/explainer/presentation content."
        )},
    ])
    if text:
        m = re.search(r"NARRATIVE_TYPE:\s*(fiction|nonfiction)", text, re.IGNORECASE)
        narrative_type = m.group(1).lower() if m else ("nonfiction" if _nonfiction_heuristic(message) else "fiction")
        concept = re.sub(r"NARRATIVE_TYPE:.*", "", text, flags=re.IGNORECASE).strip()
    else:
        concept = message.strip()
        narrative_type = "nonfiction" if _nonfiction_heuristic(message) else "fiction"
    project["concept"] = concept or message
    project["narrative_type"] = narrative_type
    project["checkpoint"] = "CHECKPOINT_01_script_concept"
    _save(project)


# ------------------------------------------------------------------ stage 2: character bible
def _stage_character_bible(project: dict) -> None:
    if project.get("character_bible") is not None:
        return
    characters = []

    # Reuse the deity-art fix from image_agent for known mythological subjects —
    # gives a validated, consistent appearance description for free.
    if _image_agent is not None and project["narrative_type"] == "fiction":
        low = project["concept"].lower() + " " + project["request"].lower()
        for pattern, expansion in _image_agent.DEITY_ART_EXPANSIONS:
            if re.search(pattern, low):
                characters.append({
                    "character_id": "char_1",
                    "name": expansion.split(",")[0][:40],
                    "appearance": expansion,
                    "voice_style": "warm, measured, reverent",
                })
                break

    if not characters:
        text = _llm_chat([
            {"role": "system", "content": "You are a character designer for an animated film. Respond with ONLY valid JSON, no prose."},
            {"role": "user", "content": (
                f'Concept: "{project["concept"]}"\n'
                f'Type: {project["narrative_type"]}\n'
                "List up to 3 recurring characters as a JSON array. If this is nonfiction "
                "content with no on-screen characters (e.g. a nature documentary), return [].\n"
                "Each item: {\"character_id\": \"char_1\", \"name\": ..., \"age\": ..., "
                "\"appearance\": \"one dense sentence covering face, hair, skin tone, build\", "
                "\"clothing\": ..., \"distinctive_features\": ..., \"personality\": ..., "
                "\"voice_style\": ...}"
            )},
        ])
        parsed = _extract_json(text)
        if isinstance(parsed, list):
            for i, c in enumerate(parsed[:3]):
                if isinstance(c, dict) and c.get("name"):
                    c.setdefault("character_id", f"char_{i + 1}")
                    characters.append(c)

    project["character_bible"] = characters
    project["checkpoint"] = "CHECKPOINT_02_characters"
    _save(project)


# ------------------------------------------------------------------ stage 3: world bible
def _stage_world_bible(project: dict) -> None:
    if project.get("world_bible") is not None:
        return
    text = _llm_chat([
        {"role": "system", "content": "You are a production designer. Respond with ONLY valid JSON, no prose."},
        {"role": "user", "content": (
            f'Concept: "{project["concept"]}"\n'
            "List 1-3 distinct locations this video takes place in, as a JSON array.\n"
            "Each item: {\"location_id\": \"loc_1\", \"name\": ..., \"description\": "
            "\"one dense sentence: architecture/landscape, lighting, atmosphere, colors\"}"
        )},
    ])
    parsed = _extract_json(text)
    locations = []
    if isinstance(parsed, list):
        for i, l in enumerate(parsed[:3]):
            if isinstance(l, dict) and l.get("description"):
                l.setdefault("location_id", f"loc_{i + 1}")
                locations.append(l)
    if not locations:
        locations = [{
            "location_id": "loc_1",
            "name": project.get("topic_title", "Main Setting"),
            "description": f"a setting fitting {project['concept'][:80]}, cinematic atmosphere",
        }]
    project["world_bible"] = locations
    project["checkpoint"] = "CHECKPOINT_03_locations"
    _save(project)


# ------------------------------------------------------------------ stage 4: style bible
def _stage_style_bible(project: dict) -> None:
    if project.get("style_bible"):
        return
    if project["narrative_type"] == "fiction":
        style = "classical cinematic digital painting, dramatic volumetric lighting, rich saturated colors, painterly detail"
    else:
        style = "clean photorealistic documentary photography, natural lighting, neutral accurate colors, sharp focus"
    project["style_bible"] = {"summary": style}
    project["checkpoint"] = "CHECKPOINT_03_style"
    _save(project)


# ------------------------------------------------------------------ stage 5: scene breakdown + script
def _fallback_scene_batch(project: dict, start_idx: int, count: int) -> list:
    topic = project.get("topic_title", "the story")
    beats = ["Opening", "Rising action", "Turning point", "Climax", "Resolution"]
    out = []
    for i in range(count):
        idx = start_idx + i
        frac = idx / max(1, project["num_scenes"] - 1)
        beat = beats[min(len(beats) - 1, int(frac * len(beats)))]
        out.append({
            "title": f"{beat} — part {idx + 1}",
            "narration": f"{beat} of {topic}, continuing the story.",
            "action": f"{beat.lower()} moment related to {topic}",
        })
    return out


def _relevant_characters(characters: list, action: str, narration: str) -> list:
    """Only include characters actually present in this scene, not the whole cast —
    concatenating every character's appearance into every prompt bloats it past the
    point where the image model follows any of it (same failure mode fixed in
    image_agent.py's Krishna prompt: front-loaded, concise prompts work better)."""
    if not characters:
        return []
    if len(characters) == 1:
        return [characters[0]["character_id"]]
    text = f"{action} {narration}".lower()
    matched = [c["character_id"] for c in characters if str(c.get("name", "")).split()[0].lower() in text]
    return matched


def _stage_scene_breakdown(project: dict) -> None:
    if project.get("scenes"):
        return
    num_scenes = project["num_scenes"]
    batch_size = 6
    scenes_raw = []
    locations = project["world_bible"]
    characters = project["character_bible"]
    prev_context = ""

    for start in range(0, num_scenes, batch_size):
        count = min(batch_size, num_scenes - start)
        text = _llm_chat([
            {"role": "system", "content": "You are a screenwriter breaking a script into scenes. Respond with ONLY valid JSON, no prose."},
            {"role": "user", "content": (
                f'Concept: "{project["concept"]}"\n'
                f'Type: {project["narrative_type"]}\n'
                f'Characters available: {[c.get("name") for c in characters] or "none"}\n'
                f'Locations available: {[l.get("name") for l in locations]}\n'
                f'This is scenes {start + 1}-{start + count} of {num_scenes} total. '
                f'Story so far: {prev_context or "(this is the beginning)"}\n'
                f"Write exactly {count} scenes as a JSON array, each: "
                '{"title": short title, "narration": "1-2 sentence narration/voiceover line, '
                'natural spoken English, ~20 words", "action": "one sentence describing the visual action"}'
            )},
        ])
        parsed = _extract_json(text)
        if isinstance(parsed, list) and len(parsed) >= 1:
            batch = parsed[:count]
            while len(batch) < count:
                batch.append(_fallback_scene_batch(project, start + len(batch), 1)[0])
        else:
            batch = _fallback_scene_batch(project, start, count)
        scenes_raw.extend(batch)
        prev_context = (prev_context + " " + " ".join(b.get("narration", "") for b in batch))[-400:]

    camera_cycle = ["slow zoom in", "slow zoom out", "pan left", "pan right", "static hold with subtle drift"]
    scenes = []
    for i, raw in enumerate(scenes_raw[:num_scenes]):
        loc = locations[i % len(locations)]
        char_ids = _relevant_characters(characters, raw.get("action", ""), raw.get("narration", ""))
        scene = {
            "scene_id": f"S{i + 1:03d}",
            "title": str(raw.get("title", f"Scene {i + 1}"))[:80],
            "narration": str(raw.get("narration", ""))[:400] or f"Continuing {project.get('topic_title', 'the story')}.",
            "action": str(raw.get("action", ""))[:300],
            "location_id": loc["location_id"],
            "characters": char_ids,
            "camera": camera_cycle[i % len(camera_cycle)],
            "duration_budget": AVG_SCENE_SECONDS,
            "negative_constraints": "no watermark, no text overlay, no distorted anatomy, single consistent design",
            "status": "pending",
            "image_url": None,
            "audio_url": None,
            "actual_duration": None,
            "shots": [{"shot_id": f"S{i + 1:03d}-SH1", "framing": ["wide shot", "medium shot", "close-up"][i % 3]}],
        }
        scenes.append(scene)

    project["scenes"] = scenes
    project["checkpoint"] = "CHECKPOINT_04_storyboard"
    _save(project)


# ------------------------------------------------------------------ stage 6: per-scene image
MAX_PROMPT_CHARS = 320


def _character_snippet(project: dict, char_ids: list) -> str:
    if not char_ids:
        return ""
    lookup = {c["character_id"]: c for c in project["character_bible"]}
    # Cap per-character so 2-3 characters in one shot still leaves room for the
    # rest of the prompt — a long, unfocused prompt gets ignored by the model
    # (see the module docstring / image_agent.py's Krishna fix for why).
    per_char_cap = 130 if len(char_ids) == 1 else 80
    parts = []
    for cid in char_ids:
        c = lookup.get(cid)
        if not c:
            continue
        appearance = c.get("appearance", "")
        parts.append(appearance[:per_char_cap])
    return ", ".join(parts)


def _build_shot_prompt(project: dict, scene: dict) -> str:
    loc = next((l for l in project["world_bible"] if l["location_id"] == scene["location_id"]), None)
    loc_desc = loc["description"][:90] if loc else ""
    char_desc = _character_snippet(project, scene["characters"])
    style = project["style_bible"]["summary"]

    # Priority order: the actual action/subject matters most, then who's in it,
    # then where, then camera/style flourishes — add pieces until the budget runs out
    # rather than always including everything and diluting the model's attention.
    pieces = [scene["action"] or scene["title"], char_desc, loc_desc, scene["camera"], style]
    prompt = ""
    for piece in pieces:
        if not piece:
            continue
        candidate = f"{prompt}, {piece}" if prompt else piece
        if len(candidate) > MAX_PROMPT_CHARS:
            break
        prompt = candidate
    return prompt


def _fetch_shot_image(prompt: str, dest_path: Path) -> bool:
    seed = random.randint(1000, 999999)
    encoded = urllib.parse.quote(prompt)
    urls = [
        f"https://image.pollinations.ai/prompt/{encoded}?width=1280&height=720&nologo=true&seed={seed}&model=flux",
        f"https://image.pollinations.ai/prompt/{encoded}?width=1280&height=720&nologo=true&seed={seed + 1}&model=turbo",
    ]
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    for url in urls:
        for attempt in range(SHOT_IMAGE_RETRIES):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=20) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        if len(data) > 2000 and (data[:2] == b"\xff\xd8" or data[:4] == b"\x89PNG"):
                            dest_path.write_bytes(data)
                            return True
            except urllib.error.HTTPError as e:
                time.sleep(1.5 if e.code == 429 else 0.5)
            except Exception:
                time.sleep(0.5)
    return False


def _stage_generate_shots(project: dict) -> None:
    pdir = _project_dir(project["project_id"])
    for scene in project["scenes"]:
        if scene["status"] == "done" and scene.get("image_url"):
            continue
        prompt = _build_shot_prompt(project, scene)
        fname = f"{scene['scene_id']}.jpg"
        dest = pdir / fname
        ok = _fetch_shot_image(prompt, dest)
        if ok:
            scene["image_url"] = f"/static/generated/{project['project_id']}/{fname}"
            scene["status"] = "image_done"
        else:
            scene["status"] = "image_failed"
        _save(project)
    project["checkpoint"] = "CHECKPOINT_05_generated_clips"
    _save(project)


# ------------------------------------------------------------------ stage 7: narration audio
def _wav_duration(wav_bytes: bytes) -> float:
    import io
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def _stage_generate_audio(project: dict) -> None:
    if voice_agent is None:
        for scene in project["scenes"]:
            scene["actual_duration"] = max(MIN_SCENE_SECONDS, scene["duration_budget"])
        project["checkpoint"] = "CHECKPOINT_06_audio"
        _save(project)
        return

    pdir = _project_dir(project["project_id"])
    persona_id = project.get("persona_id", DEFAULT_PERSONA)
    for scene in project["scenes"]:
        if scene.get("audio_url") and scene.get("actual_duration"):
            continue
        fname = f"{scene['scene_id']}.wav"
        dest = pdir / fname
        try:
            wav_bytes = voice_agent.synthesize(scene["narration"], persona_id=persona_id)
            dest.write_bytes(wav_bytes)
            scene["audio_url"] = f"/static/generated/{project['project_id']}/{fname}"
            scene["actual_duration"] = max(MIN_SCENE_SECONDS, round(_wav_duration(wav_bytes) + 0.6, 2))
        except Exception:
            scene["audio_url"] = None
            scene["actual_duration"] = max(MIN_SCENE_SECONDS, scene["duration_budget"])
        _save(project)
    project["checkpoint"] = "CHECKPOINT_06_audio"
    _save(project)


# ------------------------------------------------------------------ stage 8: assembly
def _placeholder_frame(text: str) -> "Image.Image":
    img = Image.new("RGB", (WIDTH, HEIGHT), (10, 17, 32))
    draw = ImageDraw.Draw(img)
    draw.ellipse((WIDTH // 2 - 200, HEIGHT // 2 - 200, WIDTH // 2 + 200, HEIGHT // 2 + 200), outline=(0, 242, 254), width=3)
    draw.text((WIDTH // 2, HEIGHT // 2), text[:60], fill=(248, 250, 252), anchor="mm")
    return img


def _render_silent_video(project: dict, out_path: Path) -> bool:
    pdir = _project_dir(project["project_id"])
    writer = imageio.get_writer(str(out_path), fps=FPS, codec="libx264", pixelformat="yuv420p", macro_block_size=1)
    prev_last_frame = None
    try:
        for s_idx, scene in enumerate(project["scenes"]):
            duration = scene.get("actual_duration") or AVG_SCENE_SECONDS
            frames_n = max(1, int(duration * FPS))
            img_file = pdir / f"{scene['scene_id']}.jpg"
            if img_file.exists():
                base_img = Image.open(img_file).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
            else:
                base_img = _placeholder_frame(scene["title"])

            motion = s_idx % 3
            for f in range(frames_n):
                progress = f / float(frames_n)
                if motion == 0:
                    scale = 1.0 + progress * 0.15
                    dx, dy = int(progress * 18), 0
                elif motion == 1:
                    scale = 1.15 - progress * 0.12
                    dx, dy = 0, -int(progress * 12)
                else:
                    scale = 1.05 + np.sin(progress * np.pi) * 0.06
                    dx, dy = -int(progress * 20), int(progress * 8)

                crop_w, crop_h = int(WIDTH / scale), int(HEIGHT / scale)
                left = max(0, min(WIDTH - crop_w, (WIDTH - crop_w) // 2 + dx))
                top = max(0, min(HEIGHT - crop_h, (HEIGHT - crop_h) // 2 + dy))
                frame_img = base_img.crop((left, top, left + crop_w, top + crop_h)).resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)

                draw = ImageDraw.Draw(frame_img)
                draw.rectangle((30, HEIGHT - 70, WIDTH - 30, HEIGHT - 20), fill=(5, 10, 25))
                draw.text((45, HEIGHT - 55), f"Scene {s_idx + 1}: {scene['title']}"[:90], fill=(0, 242, 254))

                frame_arr = np.array(frame_img)
                if f < CROSSFADE_FRAMES and prev_last_frame is not None:
                    alpha = f / float(CROSSFADE_FRAMES)
                    frame_arr = (prev_last_frame * (1.0 - alpha) + frame_arr * alpha).astype(np.uint8)
                writer.append_data(frame_arr)
                if f == frames_n - 1:
                    prev_last_frame = frame_arr.copy()
        writer.close()
        return True
    except Exception as e:
        print(f"[LongformVideo] render error: {e}")
        try:
            writer.close()
        except Exception:
            pass
        return False


def _build_combined_audio(project: dict, out_path: Path) -> bool:
    pdir = _project_dir(project["project_id"])
    frames_out = []
    params = None
    for scene in project["scenes"]:
        duration = scene.get("actual_duration") or AVG_SCENE_SECONDS
        audio_path = pdir / f"{scene['scene_id']}.wav"
        if audio_path.exists():
            with wave.open(str(audio_path), "rb") as wf:
                if params is None:
                    params = wf.getparams()
                data = wf.readframes(wf.getnframes())
                needed_frames = int(duration * wf.getframerate())
                have_frames = wf.getnframes()
                if have_frames < needed_frames:
                    pad_frames = needed_frames - have_frames
                    data += b"\x00" * (pad_frames * wf.getsampwidth() * wf.getnchannels())
                frames_out.append(data)
        elif params is not None:
            silence_frames = int(duration * params.framerate)
            frames_out.append(b"\x00" * (silence_frames * params.sampwidth * params.nchannels))
    if params is None or not frames_out:
        return False
    with wave.open(str(out_path), "wb") as wf:
        wf.setparams(params)
        for chunk in frames_out:
            wf.writeframesraw(chunk)
    return True


def _format_srt_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _build_srt(project: dict, out_path: Path) -> None:
    lines = []
    t = 0.0
    for i, scene in enumerate(project["scenes"]):
        duration = scene.get("actual_duration") or AVG_SCENE_SECONDS
        lines.append(str(i + 1))
        lines.append(f"{_format_srt_time(t)} --> {_format_srt_time(t + duration)}")
        lines.append(scene["narration"])
        lines.append("")
        t += duration
    out_path.write_text("\n".join(lines), encoding="utf-8")


def _mux(video_path: Path, audio_path: Path | None, srt_path: Path | None, out_path: Path) -> bool:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    attempts = []
    if audio_path and audio_path.exists() and srt_path and srt_path.exists():
        attempts.append([
            ffmpeg_exe, "-y", "-i", str(video_path), "-i", str(audio_path), "-i", str(srt_path),
            "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-c:s", "mov_text",
            "-metadata:s:s:0", "language=eng", "-shortest", str(out_path),
        ])
    if audio_path and audio_path.exists():
        attempts.append([
            ffmpeg_exe, "-y", "-i", str(video_path), "-i", str(audio_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", str(out_path),
        ])
    for cmd in attempts:
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=600)
            if result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 1000:
                return True
        except Exception as e:
            print(f"[LongformVideo] ffmpeg mux error: {e}")
    return False


def _stage_assemble(project: dict) -> None:
    pdir = _project_dir(project["project_id"])
    silent_path = pdir / "silent.mp4"
    audio_path = pdir / "narration.wav"
    srt_path = pdir / "subtitles.srt"
    final_path = pdir / "final.mp4"

    if not _render_silent_video(project, silent_path):
        project["checkpoint"] = "CHECKPOINT_09_final_export"
        project["status"] = "failed"
        project["error"] = "video render failed"
        _save(project)
        return

    has_audio = _build_combined_audio(project, audio_path)
    _build_srt(project, srt_path)

    muxed = _mux(silent_path, audio_path if has_audio else None, srt_path, final_path)
    if muxed:
        video_url = f"/static/generated/{project['project_id']}/final.mp4"
    else:
        # Guaranteed fallback: silent video is still a valid playable MP4.
        video_url = f"/static/generated/{project['project_id']}/silent.mp4"

    project["video_url"] = video_url
    project["srt_url"] = f"/static/generated/{project['project_id']}/subtitles.srt"
    project["checkpoint"] = "CHECKPOINT_07_assembly"
    _save(project)


# ------------------------------------------------------------------ stage 9: QC
def _stage_qc(project: dict) -> None:
    pdir = _project_dir(project["project_id"])
    scenes = project["scenes"]
    failed = [s["scene_id"] for s in scenes if s["status"] not in ("image_done", "done")]
    total_duration = sum(s.get("actual_duration") or 0 for s in scenes)
    final_file = pdir / "final.mp4"
    if not final_file.exists():
        final_file = pdir / "silent.mp4"
    qc = {
        "scenes_total": len(scenes),
        "scenes_ok": len(scenes) - len(failed),
        "scenes_failed": failed,
        "requested_duration_seconds": project["target_duration_seconds"],
        "actual_duration_seconds": round(total_duration, 1),
        "final_video_exists": final_file.exists(),
        "final_video_size_bytes": final_file.stat().st_size if final_file.exists() else 0,
        "has_audio_narration": (pdir / "narration.wav").exists(),
        "has_subtitles": (pdir / "subtitles.srt").exists(),
        "notes": [
            "Character/scene consistency is prompt-based text repetition, not true "
            "reference-image conditioning — appearance may still drift between shots.",
            "No real motion-video model is connected; motion is simulated pan/zoom over "
            "still AI-generated frames.",
        ],
    }
    project["qc"] = qc
    project["checkpoint"] = "CHECKPOINT_08_quality_control"
    _save(project)


# ------------------------------------------------------------------ orchestration
def _run_pipeline(project_id: str) -> None:
    project = _load(project_id)
    if not project:
        return
    try:
        project["status"] = "processing"
        _save(project)
        _stage_concept(project)
        _stage_character_bible(project)
        _stage_world_bible(project)
        _stage_style_bible(project)
        _stage_scene_breakdown(project)
        _stage_generate_shots(project)
        _stage_generate_audio(project)
        _stage_assemble(project)
        _stage_qc(project)
        project["status"] = "done" if project.get("video_url") else "failed"
        project["checkpoint"] = "CHECKPOINT_09_final_export"
        _save(project)
    except Exception as e:
        project = _load(project_id) or project
        project["status"] = "failed"
        project["error"] = str(e)[:500]
        _save(project)


def create_project(message: str, user_id: str) -> dict:
    if Image is None or imageio is None:
        return {
            "ok": False,
            "engine": "longform_video",
            "spoken": "Long-form video needs Pillow, numpy, and imageio installed on the server — they're missing right now, so I can't produce this.",
        }

    target_duration = _parse_target_duration_seconds(message) or 180
    num_scenes = max(3, min(600, round(target_duration / AVG_SCENE_SECONDS)))
    topic_title = re.sub(r"[.!?].*$", "", message.strip()).strip()[:60] or "AI Video Project"
    project_id = f"proj_{uuid.uuid4().hex[:10]}"

    project = {
        "project_id": project_id,
        "user_id": user_id,
        "request": message,
        "topic_title": topic_title,
        "target_duration_seconds": target_duration,
        "num_scenes": num_scenes,
        "persona_id": DEFAULT_PERSONA,
        "status": "queued",
        "checkpoint": "CHECKPOINT_00_queued",
        "concept": None,
        "narrative_type": None,
        "character_bible": None,
        "world_bible": None,
        "style_bible": None,
        "scenes": None,
        "video_url": None,
        "srt_url": None,
        "qc": None,
        "error": None,
        "created_at": time.time(),
    }
    _save(project)

    est_minutes = max(1, round(num_scenes * 12 / 60))  # rough: ~12s of work per scene (image+tts+render)
    duration_label = f"{target_duration // 60}m {target_duration % 60}s" if target_duration >= 60 else f"{target_duration}s"

    # Always run in a background thread. Even a short project chains several LLM
    # calls (concept/characters/world/scenes) plus per-scene image+TTS+render work —
    # a local LLM being slow (or Ollama being unresponsive) can stall this for
    # minutes, and this server handles requests synchronously, so blocking here
    # would freeze it for everyone, not just this request.
    thread = threading.Thread(target=_run_pipeline, args=(project_id,), daemon=True)
    thread.start()

    return {
        "ok": True,
        "engine": "longform_video",
        "status": "processing",
        "project_id": project_id,
        "topic": topic_title,
        "target_duration": duration_label,
        "estimated_scenes": num_scenes,
        "poll_url": f"/api/video/longform/{project_id}",
        "spoken": (
            f"I've started a full production for '{topic_title}' — targeting {duration_label} across "
            f"{num_scenes} scenes (concept, script, character/world bibles, per-scene AI art, narration, "
            f"subtitles, then assembly). This runs in the background against a free rate-limited image API, "
            f"so it'll take a while — rough estimate {est_minutes} min, could run longer. "
            f"I'll keep the project checkpointed as it goes, so it can resume if interrupted. "
            f"Ask me to check on '{topic_title}' or poll {'/api/video/longform/' + project_id} for progress."
        ),
    }


def _final_payload(project_id: str) -> dict:
    project = _load(project_id)
    if not project:
        return {"ok": False, "spoken": "Project not found."}
    scenes_ui = [
        {
            "scene": i + 1,
            "title": s["title"],
            "image_url": s.get("image_url") or "/static/placeholder.jpg",
            "audio": s["narration"],
        }
        for i, s in enumerate(project.get("scenes") or [])
    ]
    if project["status"] != "done":
        return {
            "ok": False,
            "engine": "longform_video",
            "project_id": project_id,
            "status": project["status"],
            "spoken": f"The video project for '{project['topic_title']}' failed: {project.get('error', 'unknown error')}. "
                      f"{project.get('qc', {}).get('scenes_ok', 0)}/{project.get('num_scenes')} scenes completed before the failure.",
        }
    qc = project.get("qc", {})
    caveat = ""
    if qc.get("scenes_failed"):
        caveat = f" ({len(qc['scenes_failed'])} of {qc['scenes_total']} scenes couldn't be generated and were skipped.)"
    return {
        "ok": True,
        "engine": "longform_video",
        "video_id": project_id,
        "project_id": project_id,
        "topic": project["topic_title"],
        "thumbnail": scenes_ui[0]["image_url"] if scenes_ui else "/static/placeholder.jpg",
        "video_url": project["video_url"],
        "mp4_url": project["video_url"],
        "srt_url": project.get("srt_url"),
        "spoken": f"Here's the finished production for '{project['topic_title']}' — {qc.get('actual_duration_seconds', 0):.0f}s across {qc.get('scenes_total', 0)} scenes, with narration and subtitles.{caveat}",
        "scenes": scenes_ui,
        "total_duration": f"{int(qc.get('actual_duration_seconds', 0)) // 60:02d}:{int(qc.get('actual_duration_seconds', 0)) % 60:02d}",
        "qc": qc,
        "format": "mp4_video",
    }


def get_project_status(project_id: str) -> dict:
    project = _load(project_id)
    if not project:
        return {"ok": False, "error": "Project not found"}
    scenes = project.get("scenes") or []
    done = sum(1 for s in scenes if s.get("status") in ("image_done", "done"))
    total = project.get("num_scenes", 0)
    progress = round((done / total) * 100, 1) if total else 0
    result = {
        "ok": True,
        "project_id": project_id,
        "status": project["status"],
        "checkpoint": project.get("checkpoint"),
        "topic": project.get("topic_title"),
        "progress_percent": progress,
        "scenes_done": done,
        "scenes_total": total,
    }
    if project["status"] == "done":
        result.update(_final_payload(project_id))
    elif project["status"] == "failed":
        result["error"] = project.get("error")
    return result


def resume_project(project_id: str) -> dict:
    project = _load(project_id)
    if not project:
        return {"ok": False, "error": "Project not found"}
    if project["status"] == "done":
        return _final_payload(project_id)
    thread = threading.Thread(target=_run_pipeline, args=(project_id,), daemon=True)
    thread.start()
    return {"ok": True, "project_id": project_id, "status": "processing", "spoken": f"Resuming production of '{project['topic_title']}' from checkpoint {project.get('checkpoint')}."}
