"""Vision Agent — Object Intelligence via Ollama Vision models."""
import base64
import json
import time
import uuid
import urllib.request

from core.config import setting
from core import json_db

try:
    from ultralytics import YOLO
    _yolo = YOLO("yolov8n.pt")
except Exception:
    _yolo = None

def _new_id() -> str:
    return uuid.uuid4().hex

def _now() -> float:
    return time.time()

def detect(image_path: str) -> list[dict]:
    """Detect objects in image using YOLO."""
    if not _yolo:
        raise RuntimeError("Install ultralytics for object detection: pip install ultralytics")
    results = _yolo(image_path)[0]
    out = []
    for box in results.boxes:
        out.append({
            "label": results.names[int(box.cls)],
            "confidence": round(float(box.conf), 3),
            "box": [round(float(v)) for v in box.xyxy[0].tolist()],
        })
    return out

def explain(image_path: str, question: str, user_id: str | None = None) -> str:
    """Get vision explanation from local LLM."""
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    prompt = (
        "You are JARVIS analysing what the commander is looking at. "
        "Identify it precisely. If it is an animal/bird/plant give: name, "
        "scientific name, category, diet, lifespan, one interesting fact, "
        "danger level. If it is a product give: brand, model, category, key "
        "specs, pros, cons, estimated price range. Keep it speakable. "
        f"Question: {question}"
    )

    payload = json.dumps({
        "model": setting("ollama_vision_model", "llava"),
        "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
        "stream": False,
    }).encode()

    req = urllib.request.Request(
        setting("ollama_url") + "/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            answer = json.loads(resp.read()).get("message", {}).get("content", "")
    except Exception:
        answer = ("Vision model is offline. Run `ollama pull llava` and start "
                  "Ollama, then I can identify anything you show me.")

    if user_id:
        detection_doc = {
            "user_id": user_id,
            "kind": "vlm",
            "label": question[:80],
            "confidence": 1.0,
            "meta": answer[:400],
            "created_at": _now()
        }
        json_db.insert("detections", _new_id(), detection_doc)

    return answer
