"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  Play,
  FileText,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Palette,
  Maximize,
  Minimize,
  X,
  Edit3,
  Save,
  FileDown,
} from "lucide-react";

interface PresentationWorkspaceProps {
  presentationId: string;
  token: string;
  onClose: () => void;
}

interface Slide {
  slide_number: number;
  title: string;
  subtitle: string;
  bullets: string[];
  notes: string;
}

interface PresentationData {
  pres_id: string;
  topic: string;
  slides: Slide[];
  created_at?: number;
}

const THEME_PRESETS = [
  { id: "neon", name: "Neon Dark", bg: "#070b14", accent: "#00f2fe", text: "#f8fafc", card: "rgba(15, 23, 42, 0.95)" },
  { id: "midnight", name: "Midnight Blue", bg: "#0f172a", accent: "#818cf8", text: "#e2e8f0", card: "rgba(30, 41, 59, 0.95)" },
  { id: "emerald", name: "Emerald", bg: "#022c22", accent: "#34d399", text: "#ecfdf5", card: "rgba(6, 78, 59, 0.7)" },
  { id: "sunset", name: "Sunset Warm", bg: "#1c1917", accent: "#fb923c", text: "#fef3c7", card: "rgba(68, 51, 28, 0.7)" },
  { id: "rose", name: "Rose Pink", bg: "#1a0a14", accent: "#f472b6", text: "#fce7f3", card: "rgba(80, 20, 50, 0.7)" },
];

export const PresentationWorkspace: React.FC<PresentationWorkspaceProps> = ({
  presentationId,
  token,
  onClose,
}) => {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [theme, setTheme] = useState(THEME_PRESETS[0]);
  const [showThemes, setShowThemes] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const apiBase = "";

  useEffect(() => {
    loadPresentation();
  }, [presentationId]);

  const loadPresentation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/workspace/presentation/${presentationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: PresentationData = await res.json();
        setPresentation(data);
      }
    } catch (e) {
      console.warn("Failed to load presentation:", e);
    }
    setLoading(false);
  };

  const savePresentation = async (slides?: Slide[]) => {
    if (!presentation) return;
    setSaving(true);
    const slidesToSave = slides || presentation.slides;
    try {
      const res = await fetch(`${apiBase}/api/workspace/presentation/${presentationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slides: slidesToSave, topic: presentation.topic }),
      });
      if (res.ok) {
        const data = await res.json();
        setPresentation(data);
      }
    } catch (e) {
      console.warn("Save failed:", e);
    }
    setSaving(false);
  };

  const addSlide = async () => {
    if (!presentation) return;
    try {
      const res = await fetch(`${apiBase}/api/workspace/presentation/${presentationId}/slide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "New Slide",
          subtitle: "Click to edit subtitle",
          bullets: ["Click to add a bullet point"],
          notes: "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPresentation(data);
        setActiveSlide(data.slides.length - 1);
      }
    } catch (e) {
      console.warn("Add slide failed:", e);
    }
  };

  const deleteSlide = async (slideNum: number) => {
    if (!presentation || presentation.slides.length <= 1) return;
    if (!confirm(`Delete slide ${slideNum}?`)) return;
    try {
      const res = await fetch(
        `${apiBase}/api/workspace/presentation/${presentationId}/slide/${slideNum}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPresentation(data);
        if (activeSlide >= data.slides.length) {
          setActiveSlide(Math.max(0, data.slides.length - 1));
        }
      }
    } catch (e) {
      console.warn("Delete failed:", e);
    }
  };

  const updateSlideField = (field: keyof Slide, value: any) => {
    if (!presentation) return;
    const newSlides = [...presentation.slides];
    newSlides[activeSlide] = { ...newSlides[activeSlide], [field]: value };
    setPresentation({ ...presentation, slides: newSlides });
  };

  const updateBullet = (idx: number, value: string) => {
    if (!presentation) return;
    const newSlides = [...presentation.slides];
    const newBullets = [...newSlides[activeSlide].bullets];
    newBullets[idx] = value;
    newSlides[activeSlide] = { ...newSlides[activeSlide], bullets: newBullets };
    setPresentation({ ...presentation, slides: newSlides });
  };

  const addBullet = () => {
    if (!presentation) return;
    const newSlides = [...presentation.slides];
    newSlides[activeSlide] = {
      ...newSlides[activeSlide],
      bullets: [...newSlides[activeSlide].bullets, "New bullet point"],
    };
    setPresentation({ ...presentation, slides: newSlides });
  };

  const removeBullet = (idx: number) => {
    if (!presentation) return;
    const newSlides = [...presentation.slides];
    newSlides[activeSlide] = {
      ...newSlides[activeSlide],
      bullets: newSlides[activeSlide].bullets.filter((_, i) => i !== idx),
    };
    setPresentation({ ...presentation, slides: newSlides });
  };

  // Drag-to-reorder slides
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    if (!presentation) return;
    const newSlides = [...presentation.slides];
    const [moved] = newSlides.splice(dragIdx, 1);
    newSlides.splice(idx, 0, moved);
    // Re-number
    newSlides.forEach((s, i) => (s.slide_number = i + 1));
    setPresentation({ ...presentation, slides: newSlides });
    setDragIdx(idx);
    if (activeSlide === dragIdx) setActiveSlide(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // Fullscreen presentation mode
  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  // Keyboard navigation in fullscreen
  useEffect(() => {
    if (!fullscreen || !presentation) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setActiveSlide((prev) => Math.min(prev + 1, presentation.slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setActiveSlide((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Escape") {
        setFullscreen(false);
        document.exitFullscreen?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, presentation]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const slide = presentation?.slides?.[activeSlide];

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (!presentation || !slide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400">
        <p>Presentation not found.</p>
      </div>
    );
  }

  // ── FULLSCREEN PRESENTATION MODE ──
  if (fullscreen) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ background: theme.bg }}
      >
        <div
          className="w-full max-w-[1200px] rounded-3xl p-16 flex flex-col justify-between min-h-[70vh]"
          style={{
            background: theme.card,
            border: `1px solid ${theme.accent}40`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.6)`,
          }}
        >
          <div>
            <div
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-6"
              style={{
                background: `${theme.accent}20`,
                color: theme.accent,
                border: `1px solid ${theme.accent}40`,
              }}
            >
              Slide {activeSlide + 1} of {presentation.slides.length}
            </div>
            <h1
              className="text-5xl font-bold mb-3 leading-tight"
              style={{ color: theme.accent }}
            >
              {slide.title}
            </h1>
            <h3 className="text-xl mb-10 opacity-70" style={{ color: theme.text }}>
              {slide.subtitle}
            </h3>
            <ul className="space-y-5 text-xl" style={{ color: theme.text }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start space-x-3">
                  <span style={{ color: theme.accent }} className="mt-1">▸</span>
                  <span className="opacity-90">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 flex items-center space-x-4">
          <button
            onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: `${theme.accent}`, color: theme.bg }}
          >
            ◄ Previous
          </button>
          <span className="font-bold" style={{ color: theme.accent }}>
            {activeSlide + 1} / {presentation.slides.length}
          </span>
          <button
            onClick={() => setActiveSlide(Math.min(presentation.slides.length - 1, activeSlide + 1))}
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: `${theme.accent}`, color: theme.bg }}
          >
            Next ►
          </button>
          <button
            onClick={() => { setFullscreen(false); document.exitFullscreen?.(); }}
            className="ml-4 p-2 rounded-lg hover:bg-white/10 transition-all"
            style={{ color: theme.text }}
          >
            <Minimize className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── NORMAL EDITOR MODE ──
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="h-12 flex items-center justify-between px-4 bg-[#0f172a] border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="w-[1px] h-5 bg-slate-800" />
          <div className="flex items-center space-x-1.5">
            <FileText className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              {presentation.topic.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1.5">
          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 rounded-lg transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{theme.name}</span>
            </button>
            {showThemes && (
              <div className="absolute right-0 top-10 z-50 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 animate-fade-in">
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t); setShowThemes(false); }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                      theme.id === t.id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-slate-600" style={{ background: t.accent }} />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { savePresentation(); }}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg transition-all disabled:opacity-30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Present</span>
          </button>
          <a
            href={`/api/workspace/presentation/${presentationId}/download?format=html&authorization=Bearer ${token}`}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>HTML</span>
          </a>
          <a
            href={`/api/workspace/presentation/${presentationId}/download?format=pptx&authorization=Bearer ${token}`}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-all"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>PPTX</span>
          </a>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ─── Slide Thumbnails Sidebar ─── */}
        <div className="w-56 bg-[#0a0f1a] border-r border-slate-800/60 flex flex-col flex-shrink-0">
          <div className="h-9 flex items-center justify-between px-3 text-[10px] font-bold text-slate-500 tracking-widest border-b border-slate-800/30 flex-shrink-0">
            <span>SLIDES ({presentation.slides.length})</span>
            <button
              onClick={addSlide}
              className="p-1 hover:bg-slate-700/50 rounded transition-all text-slate-400 hover:text-cyan-400"
              title="Add Slide"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-2 px-2">
            {presentation.slides.map((s, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveSlide(idx)}
                className={`group relative rounded-xl cursor-pointer transition-all border ${
                  activeSlide === idx
                    ? "border-cyan-400/60 shadow-lg shadow-cyan-950/20 bg-slate-800/40"
                    : "border-slate-800/40 hover:border-slate-700 bg-slate-900/30"
                }`}
              >
                {/* Slide mini-preview */}
                <div
                  className="rounded-t-xl p-3 min-h-[80px]"
                  style={{
                    background: activeSlide === idx ? `${theme.accent}08` : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <GripVertical className="w-3 h-3 text-slate-600 cursor-grab" />
                      {presentation.slides.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSlide(idx + 1);
                          }}
                          className="p-0.5 hover:text-red-400 text-slate-600 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p
                    className="text-[10px] font-semibold leading-tight line-clamp-2"
                    style={{ color: activeSlide === idx ? theme.accent : "#94a3b8" }}
                  >
                    {s.title}
                  </p>
                  <p className="text-[8px] text-slate-600 mt-1 line-clamp-1">
                    {s.subtitle}
                  </p>
                </div>
              </div>
            ))}

            {/* Add Slide button at bottom */}
            <button
              onClick={addSlide}
              className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl text-slate-600 hover:text-cyan-400 transition-all flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs">Add Slide</span>
            </button>
          </div>
        </div>

        {/* ─── Slide Editor Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto" style={{ background: `${theme.bg}` }}>
          {/* Slide Card */}
          <div
            className="w-full max-w-[900px] mx-auto rounded-2xl p-10 min-h-[480px] flex flex-col justify-between shadow-2xl transition-all duration-300"
            style={{
              background: theme.card,
              border: `1px solid ${theme.accent}30`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 60px ${theme.accent}08`,
              aspectRatio: "16/9",
            }}
          >
            <div className="flex-1 space-y-6">
              {/* Slide tag */}
              <div
                className="inline-block px-3 py-1 rounded-full text-[11px] font-bold"
                style={{
                  background: `${theme.accent}15`,
                  color: theme.accent,
                  border: `1px solid ${theme.accent}30`,
                }}
              >
                Slide {activeSlide + 1} of {presentation.slides.length}
              </div>

              {/* Editable Title */}
              <div
                contentEditable
                suppressContentEditableWarning
                className="text-3xl font-bold leading-tight outline-none focus:ring-1 rounded-lg px-2 py-1 -mx-2 transition-all"
                style={{
                  color: theme.accent,
                  // @ts-ignore
                  "--tw-ring-color": `${theme.accent}40`,
                } as any}
                onBlur={(e) => updateSlideField("title", e.currentTarget.textContent || "")}
              >
                {slide.title}
              </div>

              {/* Editable Subtitle */}
              <div
                contentEditable
                suppressContentEditableWarning
                className="text-lg opacity-70 outline-none focus:ring-1 rounded-lg px-2 py-1 -mx-2 transition-all"
                style={{
                  color: theme.text,
                  // @ts-ignore
                  "--tw-ring-color": `${theme.accent}30`,
                } as any}
                onBlur={(e) => updateSlideField("subtitle", e.currentTarget.textContent || "")}
              >
                {slide.subtitle}
              </div>

              {/* Editable Bullets */}
              <ul className="space-y-3">
                {slide.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start space-x-3 group">
                    <span style={{ color: theme.accent }} className="mt-0.5 text-lg">▸</span>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="flex-1 text-base outline-none focus:ring-1 rounded-lg px-2 py-0.5 -mx-2 transition-all"
                      style={{ color: theme.text, opacity: 0.9 } as any}
                      onBlur={(e) => updateBullet(idx, e.currentTarget.textContent || "")}
                    >
                      {bullet}
                    </div>
                    <button
                      onClick={() => removeBullet(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-slate-600 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={addBullet}
                    className="flex items-center space-x-2 text-xs px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all"
                    style={{ color: `${theme.accent}80` }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add bullet</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Speaker Notes Section */}
          <div className="w-full max-w-[900px] mx-auto mt-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center space-x-2 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-all"
            >
              {showNotes ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span>Speaker Notes</span>
            </button>
            {showNotes && (
              <textarea
                value={slide.notes}
                onChange={(e) => updateSlideField("notes", e.target.value)}
                placeholder="Add speaker notes..."
                className="w-full h-24 bg-slate-900/60 border border-slate-800/60 rounded-xl px-4 py-3 text-sm text-slate-300 resize-none outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-700"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
