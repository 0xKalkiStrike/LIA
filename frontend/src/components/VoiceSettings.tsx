"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

export const VoiceSettings: React.FC = () => {
  const { profile, accents, updateProfile, uploadCustomVoice, saveVoiceSettings, fetchVoiceSettings, previewVoice } = useApp();
  const [loading, setLoading] = useState(false);

  // Settings
  const [voiceId, setVoiceId] = useState(profile?.voice_persona || "friday");
  const [accent, setAccent] = useState(profile?.voice_accent || "us");
  const [pitch, setPitch] = useState(profile?.pitch || 1.0);
  const [speed, setSpeed] = useState(profile?.speech_rate || 1.0);
  const [style, setStyle] = useState("default");
  const [emotionalSpeech, setEmotionalSpeech] = useState(false);
  const [customVoicePath, setCustomVoicePath] = useState("");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [legalChecked, setLegalChecked] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchVoiceSettings().then((d) => {
      if (d) {
        setVoiceId(d.voice_id || "friday");
        setAccent(d.accent || profile?.voice_accent || "us");
        setPitch(d.pitch || 1.0);
        setSpeed(d.speed || 1.0);
        setStyle(d.style || "default");
        setEmotionalSpeech(d.emotional_speech === 1);
        setCustomVoicePath(d.custom_voice_path || "");
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!legalChecked) {
      alert("You must verify and check the legal authorization checkbox first.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadCustomVoice(selectedFile);
      setCustomVoicePath(url);
      setVoiceId("custom");
      alert("Custom voice clip uploaded successfully!");
    } catch (e: any) {
      alert(`Voice upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await saveVoiceSettings(voiceId, accent, pitch, speed, style, emotionalSpeech);
      await updateProfile({
        voice_persona: voiceId,
        voice_accent: accent,
        pitch: pitch,
        speech_rate: speed,
      });
      alert("Voice configuration saved successfully!");
    } catch (e) {
      alert("Failed to save voice settings.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = () => {
    previewVoice({
      text: "Hello Commander. System check completed. I am ready to assist you.",
      voiceId,
      accent,
      pitch,
      speed,
    });
  };

  return (
    <div className="w-full max-w-md h-full flex flex-col justify-between p-6 bg-slate-900/90 text-white rounded-2xl glass border border-slate-700/50 shadow-2xl">
      <div className="flex-1 overflow-y-auto pr-1 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Voice Settings</h2>
          <p className="text-xs text-slate-400 mt-1">Customize synthesis engine profiles, pitch scales, and voices.</p>
        </div>

        {/* Selected voice preset */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">SELECT VOICE PERSONA</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "friday", name: "Friday (Friendly)" },
              { id: "jarvis_classic", name: "Jarvis (Classic)" },
              { id: "nova", name: "Nova (Calm)" },
              { id: "sage", name: "Sage (Researcher)" },
              { id: "custom", name: "Custom Voice Clip", disabled: !customVoicePath }
            ].map((v) => (
              <button
                key={v.id}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left flex flex-col justify-between ${
                  voiceId === v.id
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                } ${v.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => !v.disabled && setVoiceId(v.id)}
                disabled={v.disabled}
              >
                <span>{v.name}</span>
                {v.id === "custom" && <span className="text-[10px] text-slate-400 mt-0.5">Custom uploaded</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Accent selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">ACCENT / REGION</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(accents || {}).map(([id, cfg]: [string, any]) => (
              <button
                key={id}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left ${
                  accent === id
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setAccent(id)}
              >
                {cfg.label || id}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">Uses your device's natural neural voices for a realistic accent.</p>
        </div>

        {/* Speed adjustment slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs font-semibold text-slate-300">SPEAKING SPEED</label>
            <span className="text-xs text-cyan-400 font-medium">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.5"
            step="0.05"
            className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
          />
        </div>

        {/* Pitch slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs font-semibold text-slate-300">PITCH LEVEL</label>
            <span className="text-xs text-cyan-400 font-medium">{pitch}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
          />
        </div>

        {/* Style Dropdown & Emotional Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">SPEAKING STYLE</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="whisper">Whisper</option>
              <option value="energetic">Energetic</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">EMOTIONAL SPEECH</label>
            <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={emotionalSpeech}
                onChange={() => setEmotionalSpeech(!emotionalSpeech)}
                className="rounded border-slate-700 bg-slate-800 accent-cyan-500 w-4 h-4"
              />
              <span className="text-xs text-slate-300">Dynamic Pitch Shift</span>
            </label>
          </div>
        </div>

        {/* Custom voice cloning upload card */}
        <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/50 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-200">Voice Upload (Voice Cloning)</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Upload a short clear wave clip of the target speaker voice.</p>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              accept=".wav,.mp3"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
            />
          </div>

          {/* Legal authorization confirmation */}
          <div className="space-y-2">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={legalChecked}
                onChange={() => setLegalChecked(!legalChecked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 accent-cyan-500 w-3.5 h-3.5 flex-shrink-0"
              />
              <span className="text-[10px] text-slate-300 leading-tight">
                I declare that I possess the legal authorization, explicit consent, or ownership rights to use this audio file for synthesis tasks.
              </span>
            </label>
          </div>

          <button
            className="w-full bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 font-semibold py-1.5 text-xs rounded-lg transition-all disabled:opacity-50"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Extracting Vocal Embeddings..." : "Process Custom Voice Clip"}
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex space-x-2">
        <button
          className="flex-1 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold py-2.5 rounded-xl transition-all"
          onClick={handlePlayPreview}
        >
          Audio Preview
        </button>
        <button
          className="flex-1 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold py-2.5 rounded-xl shadow-lg transition-all disabled:opacity-50"
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? "Saving Settings..." : "Apply Voice settings"}
        </button>
      </div>
    </div>
  );
};
