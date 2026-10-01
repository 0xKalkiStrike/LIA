"""Presentation Agent — JARVIS creates presentation slide decks with topic-specific content synthesis.

Features:
- Generates topic-tailored, multi-slide presentations with titles, subtitles, bullet points, metrics, and speaker notes
- Robust trigger matching for ALL user presentation requests ("presentation of X", "slides on Y", "make ppt for Z")
- Produces exportable standalone interactive HTML slide decks with dark modern themes and keyboard navigation
- Interactive slide viewer card rendered directly in LIA chat UI
- Full CRUD: create, read, update, delete slides; PPTX export
"""
import json
import re
import urllib.request
import uuid
from pathlib import Path
from core.config import ROOT, setting

PRESENTATIONS_DIR = ROOT / "ui" / "static" / "generated" / "presentations"

PRESENTATION_KEYWORDS = (
    "presentation", "slides", "slide deck", "slidedeck", "powerpoint", "ppt", "keynote"
)


def looks_like_presentation_request(message: str) -> bool:
    """Detect any user request asking for a presentation, slides, PPT, or slide deck."""
    low = message.lower()
    return any(k in low for k in PRESENTATION_KEYWORDS)


def _clean_topic(message: str) -> str:
    low = message.lower()
    patterns = [
        r"\b(generate|create|make|prepare|build|give|show|draw)\s+(a|an|the|my)?\s*(presentation|slides|slide\s*deck|ppt|powerpoint|keynote)\b",
        r"\b(presentation|slides|slide\s*deck|ppt|powerpoint|keynote)\b",
        r"\b(on|about|of|for)\b"
    ]
    cleaned = low
    for pat in patterns:
        cleaned = re.sub(pat, " ", cleaned)
        
    cleaned = re.sub(r"\b(a|an|the|me|us|please|can|you|i|want|need)\b", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or "Strategic Insights & Analysis"


def _ollama_slides(topic: str, message: str) -> list | None:
    """Ask the local writing model for real, topic-specific slide content as JSON."""
    system = (
        "You create presentation slide decks. Respond with ONLY a JSON array (no "
        "markdown fences, no commentary) of 5-7 slide objects, each with exactly these "
        "keys: slide_number (int), title (string), subtitle (string), bullets "
        "(array of 3 short strings, each may start with one emoji), notes (string, "
        "one sentence of speaker guidance). Content must be specific and substantive "
        "to the requested topic — no generic filler."
    )
    try:
        payload = json.dumps({
            "model": setting("ollama_writing_model", "mistral"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Presentation topic: {message.strip() or topic}"},
            ],
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            setting("ollama_url") + "/api/chat",
            data=payload, headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
        content = data.get("message", {}).get("content", "").strip()
        content = re.sub(r"^```(?:json)?|```$", "", content, flags=re.MULTILINE).strip()
        slides = json.loads(content)
        if isinstance(slides, list) and slides and all(
            isinstance(s, dict) and "title" in s and "bullets" in s for s in slides
        ):
            for i, s in enumerate(slides, 1):
                s.setdefault("slide_number", i)
            return slides
    except Exception as e:
        print(f"[PresentationAgent] Ollama unreachable/bad JSON, using offline template: {str(e)[:80]}")
    return None


def _synthesize_topic_slides(topic: str) -> list:
    """Synthesize rich, topic-specific slide content dynamically tailored to the user's prompt."""
    t_clean = topic.strip().title()
    low = topic.lower()

    if any(k in low for k in ("krishna", "radha", "god", "devotion", "spiritual", "divine", "bhakti", "temple", "ram")):
        return [
            {
                "slide_number": 1,
                "title": f"{t_clean}: Divine Grace & Philosophy",
                "subtitle": "Spiritual Vision & Philosophical Foundations",
                "bullets": [
                    "✨ Eternal Devotion (Bhakti Yoga) & Cosmic Harmony",
                    "🌸 Divine Play (Leela) & Spiritual Teachings of Srimad Bhagavad Gita",
                    "🕊 Symbolism of Compassion, Universal Love & Righteousness (Dharma)"
                ],
                "notes": f"Introduce the sacred heritage, philosophy, and spiritual legacy of {t_clean}."
            },
            {
                "slide_number": 2,
                "title": "1. Philosophical Foundations & Sacred Texts",
                "subtitle": "Wisdom of the Bhagavad Gita & Upanishads",
                "bullets": [
                    "📖 Karma Yoga: Righteous Action without attachment to fruits",
                    "🧘 Jnana & Bhakti: Knowledge, Self-Realization & Unconditional Love",
                    "⚖️ Preservation of Cosmic Order & Universal Dharma"
                ],
                "notes": "Discuss core spiritual tenets and ethical philosophy."
            },
            {
                "slide_number": 3,
                "title": "2. Cultural & Artistic Legacy",
                "subtitle": "Art, Music, Literature & Celebrations",
                "bullets": [
                    "🎵 Classical Music, Classical Dance & Devotional Literature",
                    "🎨 Expressive Iconography, Temple Architecture & Sacred Symbols",
                    "🌟 Global Festivities: Janmashtami, Holi & Raslila Traditions"
                ],
                "notes": "Highlight cultural and artistic impact across centuries."
            },
            {
                "slide_number": 4,
                "title": "3. Modern Relevance & Global Impact",
                "subtitle": "Timeless Principles for Contemporary Life",
                "bullets": [
                    "🧘 Mindfulness, Inner Peace & Stress Reduction through Meditation",
                    "🤝 Ethics, Leadership & Integrity in Governance and Daily Life",
                    "🌍 Universal Appeal across diverse global communities"
                ],
                "notes": "Emphasize modern application of ancient wisdom."
            },
            {
                "slide_number": 5,
                "title": "4. Conclusion & Key Takeaways",
                "subtitle": "Summary of Spiritual Principles",
                "bullets": [
                    "Path of Unconditional Devotion and Compassion",
                    "Harmonious Balance between Duty and Spiritual Awareness",
                    "Enduring Beacon of Peace, Hope, and Enlightenment"
                ],
                "notes": "Summarize key spiritual insights and conclusion."
            }
        ]

    elif any(k in low for k in ("ai", "artificial intelligence", "machine learning", "deep learning", "robot", "llm")):
        return [
            {
                "slide_number": 1,
                "title": f"{t_clean}: The Next Frontier",
                "subtitle": "Overview of Next-Generation Intelligent Systems",
                "bullets": [
                    "⚡ Breakthroughs in Generative Intelligence & LLM Architectures",
                    "🤖 Transition from Passive Software to Autonomous AI Agents",
                    "🌐 Global Industrial Transformation & Market Disruption"
                ],
                "notes": "Introduce the core vision of artificial intelligence and high-level market impact."
            },
            {
                "slide_number": 2,
                "title": "1. Current Landscape & Core Challenges",
                "subtitle": "Addressing Modern Bottlenecks",
                "bullets": [
                    "⚠️ High computational resource demands and infrastructure costs",
                    "🔒 Data privacy concerns & ethical governance frameworks",
                    "🧩 Integration friction with legacy enterprise IT pipelines"
                ],
                "notes": "Discuss technical and operational challenges facing modern AI adoption."
            },
            {
                "slide_number": 3,
                "title": "2. Architectural Pillars & Innovation",
                "subtitle": "How Modern AI Systems Function",
                "bullets": [
                    "🧠 Neural Attention Mechanisms & Transformer Scaling Laws",
                    "🔄 Retrieval-Augmented Generation (RAG) for Contextual Accuracy",
                    "⚡ Edge Execution & Quantized On-Device Intelligence"
                ],
                "notes": "Explain technical foundations and algorithmic advances."
            },
            {
                "slide_number": 4,
                "title": "3. Quantitative Benefits & Value Proposition",
                "subtitle": "Measurable Impact",
                "bullets": [
                    "🚀 10x acceleration in automated workflow completion",
                    "📊 70% reduction in manual data processing overhead",
                    "📈 24/7 continuous autonomous operational availability"
                ],
                "notes": "Highlight key quantitative gains and ROI metrics."
            },
            {
                "slide_number": 5,
                "title": "4. Strategic Roadmap & Action Plan",
                "subtitle": "Deployment Milestones",
                "bullets": [
                    "Phase 1: Architecture Audit & Capability Mapping",
                    "Phase 2: Pilot Deployment & Model Alignment",
                    "Phase 3: Full Enterprise Scale-Out & Monitoring"
                ],
                "notes": "Conclude with clear implementation steps."
            }
        ]

    elif any(k in low for k in ("energy", "solar", "green", "climate", "sustainability", "renewable")):
        return [
            {
                "slide_number": 1,
                "title": f"{t_clean}: Sustainable Energy Horizons",
                "subtitle": "Accelerating Clean Power Transition",
                "bullets": [
                    "🌱 Transitioning to Net-Zero Carbon Economies",
                    "☀️ Technological Innovations in Photovoltaics & Storage",
                    "🔋 Grid Modernization & Decentralized Power Networks"
                ],
                "notes": "Set the vision for renewable energy transformation."
            },
            {
                "slide_number": 2,
                "title": "1. Market Drivers & Environmental Need",
                "subtitle": "Urgency of Renewable Shift",
                "bullets": [
                    "📉 Falling Levelized Cost of Energy (LCOE) across renewables",
                    "🌍 Global regulatory mandates and ESG compliance goals",
                    "⚡ Rising fossil fuel price volatility and energy security needs"
                ],
                "notes": "Highlight key economic and environmental drivers."
            },
            {
                "slide_number": 3,
                "title": "2. Key Technological Advances",
                "subtitle": "Next-Gen Clean Infrastructure",
                "bullets": [
                    "🔬 High-Efficiency Perovskite & Bifacial Solar Cells",
                    "🔋 Solid-State Batteries & Utility-Scale Storage Solutions",
                    "🌐 Smart Grid Automation powered by IoT analytics"
                ],
                "notes": "Focus on breakthrough technologies."
            },
            {
                "slide_number": 4,
                "title": "3. Economic Impact & Performance Metrics",
                "subtitle": "Delivering Sustainable Value",
                "bullets": [
                    "💡 80% long-term reduction in operational energy expenses",
                    "📉 Millions of metric tons of CO2 emissions offset annually",
                    "📈 Stable, predictable long-term energy yields"
                ],
                "notes": "Present key sustainability and cost efficiency metrics."
            },
            {
                "slide_number": 5,
                "title": "4. Execution Strategy & Next Steps",
                "subtitle": "Implementation Milestones",
                "bullets": [
                    "Phase 1: Resource Assessment & Site Selection",
                    "Phase 2: High-Density Grid Infrastructure Buildout",
                    "Phase 3: Commissioning & Continuous Optimization"
                ],
                "notes": "Conclude with project execution phases."
            }
        ]

    else:
        # Default smart synthesis tailored to topic
        return [
            {
                "slide_number": 1,
                "title": f"{t_clean}: Overview & Vision",
                "subtitle": "Strategic Insights & Key Takeaways",
                "bullets": [
                    f"📌 Core Concept & Scope of {t_clean}",
                    "🚀 Key Innovations & Drivers of Change",
                    "🌐 Global Context & High-Level Impact"
                ],
                "notes": f"Introduce the presentation on {t_clean}."
            },
            {
                "slide_number": 2,
                "title": "1. Background & Core Problem Context",
                "subtitle": "Understanding the Current Opportunity",
                "bullets": [
                    f"🔍 Identifying key challenges and bottlenecks in {t_clean}",
                    "⚡ Shift toward modern, high-efficiency methodologies",
                    "📈 Market demand driving accelerated adoption"
                ],
                "notes": "Analyze current challenges and market landscape."
            },
            {
                "slide_number": 3,
                "title": "2. Core Architecture & Key Pillars",
                "subtitle": "How the Solution Operates",
                "bullets": [
                    "🛠 Modular & Scalable Infrastructure Design",
                    "🔄 Integrated Automated Processing Pipeline",
                    "🔒 Enterprise-Grade Security & Reliability Controls"
                ],
                "notes": "Highlight technical architecture and core design."
            },
            {
                "slide_number": 4,
                "title": "3. Measurable Benefits & Outcomes",
                "subtitle": "Quantifiable ROI & Performance Gains",
                "bullets": [
                    "🚀 Significant operational efficiency & speed enhancements",
                    "💡 Substantial reduction in operational overhead",
                    "📊 Enhanced data insights & real-time analytics"
                ],
                "notes": "Present quantitative results and benefits."
            },
            {
                "slide_number": 5,
                "title": "4. Strategic Roadmap & Execution Plan",
                "subtitle": "Next Steps & Milestone Timeline",
                "bullets": [
                    "Phase 1: Readiness Assessment & Foundation Setup",
                    "Phase 2: Pilot Implementation & Optimization",
                    "Phase 3: Full-Scale Adoption & Continuous Growth"
                ],
                "notes": "Conclude with key execution milestones."
            }
        ]


def _build_html(topic: str, slides: list, pres_id: str) -> str:
    """Build the standalone interactive HTML deck from slide data."""
    slides_json = json.dumps(slides)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{topic.title()} — Presentation Deck</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ margin: 0; padding: 0; background: #070b14; color: #f8fafc; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }}
    .deck-box {{ width: 100%; max-width: 960px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 20px; padding: 48px; box-shadow: 0 20px 60px rgba(0,0,0,0.8); backdrop-filter: blur(16px); position: relative; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; }}
    .slide-tag {{ background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; width: fit-content; margin-bottom: 16px; border: 1px solid rgba(0,242,254,0.3); }}
    h1 {{ font-size: 34px; color: #00f2fe; margin-bottom: 8px; line-height: 1.25; font-weight: 700; }}
    h3 {{ font-size: 18px; color: #94a3b8; font-weight: 400; margin-bottom: 28px; }}
    ul {{ line-height: 2; font-size: 18px; color: #cbd5e1; list-style-type: none; margin-bottom: 24px; }}
    li {{ margin-bottom: 14px; padding-left: 28px; position: relative; }}
    li::before {{ content: "▸"; position: absolute; left: 0; color: #00f2fe; font-size: 20px; }}
    .notes-box {{ background: rgba(0,0,0,0.4); border-left: 3px solid #00f2fe; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #94a3b8; margin-top: 16px; }}
    .nav-bar {{ display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 960px; margin-top: 24px; }}
    .btn {{ background: linear-gradient(135deg, #00f2fe, #4facfe); color: #000; border: none; padding: 12px 26px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(0,242,254,0.3); transition: transform 0.2s, box-shadow 0.2s; }}
    .btn:hover {{ transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,242,254,0.5); }}
    .counter {{ color: #00f2fe; font-size: 18px; font-weight: 700; background: rgba(0,242,254,0.1); padding: 8px 18px; border-radius: 12px; border: 1px solid rgba(0,242,254,0.2); }}
  </style>
</head>
<body>
  <div class="deck-box" id="slide-box">
    <div>
      <div class="slide-tag" id="scenetag">Slide 1 of {len(slides)}</div>
      <h1 id="title">{slides[0]['title']}</h1>
      <h3 id="subtitle">{slides[0]['subtitle']}</h3>
      <ul id="bullets">
        {''.join(f'<li>{b}</li>' for b in slides[0]['bullets'])}
      </ul>
    </div>
    <div class="notes-box" id="notes">💡 Note: {slides[0]['notes']}</div>
  </div>

  <div class="nav-bar">
    <button class="btn" onclick="prev()">◄ Previous</button>
    <span class="counter" id="counter">1 / {len(slides)}</span>
    <button class="btn" onclick="next()">Next ►</button>
  </div>

  <script>
    const slides = {slides_json};
    let idx = 0;
    function render() {{
      document.getElementById('scenetag').innerText = 'Slide ' + (idx + 1) + ' of ' + slides.length;
      document.getElementById('title').innerText = slides[idx].title;
      document.getElementById('subtitle').innerText = slides[idx].subtitle;
      document.getElementById('bullets').innerHTML = slides[idx].bullets.map(b => '<li>' + b + '</li>').join('');
      document.getElementById('notes').innerText = '💡 Note: ' + slides[idx].notes;
      document.getElementById('counter').innerText = (idx + 1) + ' / ' + slides.length;
    }}
    function next() {{ if(idx < slides.length - 1) {{ idx++; render(); }} }}
    function prev() {{ if(idx > 0) {{ idx--; render(); }} }}
    document.addEventListener('keydown', e => {{
      if (e.key === 'ArrowRight' || e.key === 'Space') next();
      if (e.key === 'ArrowLeft') prev();
    }});
  </script>
</body>
</html>
"""


def generate_presentation(message: str, user_id: str) -> dict:
    """Generate a complete topic-tailored presentation slide deck with interactive viewer and export file."""
    PRESENTATIONS_DIR.mkdir(parents=True, exist_ok=True)
    topic = _clean_topic(message)
    slides = _ollama_slides(topic, message) or _synthesize_topic_slides(topic)

    pres_id = f"pres_{uuid.uuid4().hex[:8]}"

    # Write slide data as JSON (for editing in Presentation Workspace)
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    pres_data = {
        "pres_id": pres_id,
        "topic": topic,
        "created_at": __import__("time").time(),
        "slides": slides,
    }
    data_file.write_text(json.dumps(pres_data, indent=2), encoding="utf-8")

    # Write exportable standalone HTML file
    html_content = _build_html(topic, slides, pres_id)
    html_file = PRESENTATIONS_DIR / f"{pres_id}.html"
    html_file.write_text(html_content, encoding="utf-8")

    return {
        "ok": True,
        "presentation_id": pres_id,
        "topic": topic,
        "slides": slides,
        "total_slides": len(slides),
        "download_url": f"/static/generated/presentations/{pres_id}.html",
        "spoken": f"I have created a customized {len(slides)}-slide presentation on '{topic}'. You can view and navigate through the slides below!"
    }


# ────────────────────── Presentation CRUD for Workspace ──────────────────────

def list_presentations() -> list[dict]:
    """List all generated presentations."""
    presentations = []
    if not PRESENTATIONS_DIR.exists():
        return presentations
    for f in sorted(PRESENTATIONS_DIR.iterdir(), reverse=True):
        if f.suffix == ".json" and f.stem.startswith("pres_"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                presentations.append({
                    "pres_id": data.get("pres_id", f.stem),
                    "topic": data.get("topic", "Untitled"),
                    "total_slides": len(data.get("slides", [])),
                    "created_at": data.get("created_at"),
                })
            except Exception:
                pass
    return presentations


def get_presentation(pres_id: str) -> dict | None:
    """Get full presentation data for editing."""
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    if not data_file.exists():
        return None
    try:
        return json.loads(data_file.read_text(encoding="utf-8"))
    except Exception:
        return None


def update_presentation(pres_id: str, slides: list, topic: str | None = None) -> dict | None:
    """Update slide content and regenerate HTML."""
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    if not data_file.exists():
        return None
    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        # Re-number slides
        for i, slide in enumerate(slides):
            slide["slide_number"] = i + 1
        data["slides"] = slides
        if topic:
            data["topic"] = topic
        data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        # Regenerate HTML
        html_content = _build_html(data["topic"], slides, pres_id)
        html_file = PRESENTATIONS_DIR / f"{pres_id}.html"
        html_file.write_text(html_content, encoding="utf-8")
        return data
    except Exception:
        return None


def add_slide(pres_id: str, slide_data: dict) -> dict | None:
    """Add a new slide to a presentation."""
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    if not data_file.exists():
        return None
    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        slides = data.get("slides", [])
        slide_data["slide_number"] = len(slides) + 1
        slides.append(slide_data)
        data["slides"] = slides
        data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        # Regenerate HTML
        html_content = _build_html(data["topic"], slides, pres_id)
        (PRESENTATIONS_DIR / f"{pres_id}.html").write_text(html_content, encoding="utf-8")
        return data
    except Exception:
        return None


def delete_slide(pres_id: str, slide_number: int) -> dict | None:
    """Delete a slide by its number (1-indexed)."""
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    if not data_file.exists():
        return None
    try:
        data = json.loads(data_file.read_text(encoding="utf-8"))
        slides = data.get("slides", [])
        if slide_number < 1 or slide_number > len(slides):
            return None
        slides.pop(slide_number - 1)
        # Re-number
        for i, s in enumerate(slides):
            s["slide_number"] = i + 1
        data["slides"] = slides
        data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        # Regenerate HTML
        html_content = _build_html(data["topic"], slides, pres_id)
        (PRESENTATIONS_DIR / f"{pres_id}.html").write_text(html_content, encoding="utf-8")
        return data
    except Exception:
        return None


def export_pptx(pres_id: str) -> str | None:
    """Generate a PPTX file from slide data. Returns path to the generated file."""
    data_file = PRESENTATIONS_DIR / f"{pres_id}.json"
    if not data_file.exists():
        return None
    try:
        from pptx import Presentation as PptxPresentation
        from pptx.util import Inches, Pt, Emu
        from pptx.dml.color import RGBColor
        from pptx.enum.text import PP_ALIGN

        data = json.loads(data_file.read_text(encoding="utf-8"))
        slides = data.get("slides", [])
        topic = data.get("topic", "Presentation")

        prs = PptxPresentation()
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)

        for slide_data in slides:
            slide_layout = prs.slide_layouts[1]  # Title + Content
            slide = prs.slides.add_slide(slide_layout)

            # Title
            title_shape = slide.shapes.title
            if title_shape:
                title_shape.text = slide_data.get("title", "")
                for paragraph in title_shape.text_frame.paragraphs:
                    paragraph.font.size = Pt(36)
                    paragraph.font.bold = True
                    paragraph.font.color.rgb = RGBColor(0, 242, 254)

            # Body / Bullets
            body_shape = slide.placeholders.get(1)
            if body_shape:
                tf = body_shape.text_frame
                tf.clear()
                # Subtitle
                p = tf.paragraphs[0] if tf.paragraphs else tf.add_paragraph()
                p.text = slide_data.get("subtitle", "")
                p.font.size = Pt(20)
                p.font.color.rgb = RGBColor(148, 163, 184)
                p.space_after = Pt(16)

                # Bullets
                for bullet in slide_data.get("bullets", []):
                    p = tf.add_paragraph()
                    p.text = bullet
                    p.font.size = Pt(18)
                    p.font.color.rgb = RGBColor(203, 213, 225)
                    p.space_after = Pt(8)
                    p.level = 0

            # Speaker notes
            notes = slide_data.get("notes", "")
            if notes:
                notes_slide = slide.notes_slide
                notes_slide.notes_text_frame.text = notes

        pptx_path = PRESENTATIONS_DIR / f"{pres_id}.pptx"
        prs.save(str(pptx_path))
        return str(pptx_path)
    except ImportError:
        return None
    except Exception:
        return None

