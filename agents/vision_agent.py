"""Vision Agent — YOLO detection + LLaVA explanation (Object Intelligence).

Optional deps: ultralytics, opencv-python. The VLM call goes through Ollama
(llava / qwen-vl) so a detected object becomes a full explanation:
name, scientific name, category, facts, danger level, price estimate, etc.
"""
import base64
import json
import urllib.request

from core.config import setting
from core.database import db, new_id, now

try:
    from ultralytics import YOLO
    _yolo = YOLO("yolov8n.pt")
except Exception:
    _yolo = None


def detect(image_path: str) -> list[dict]:
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
    """Object / Product Intelligence via local vision-language model."""
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
    req = urllib.request.Request(setting("ollama_url") + "/api/chat",
                                 data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            answer = json.loads(resp.read()).get("message", {}).get("content", "")
    except Exception:
        answer = ("Vision model is offline. Run `ollama pull llava` and start "
                  "Ollama, then I can identify anything you show me.")
    if user_id:
        with db() as conn:
            conn.execute("INSERT INTO Detections VALUES (?,?,?,?,?,?,?)",
                         (new_id(), user_id, "vlm", question[:80], 1.0, answer[:400], now()))
    return answer
