"use client";

import React, { useState } from "react";
import { useApp } from "../context/AppContext";

export const CharacterCreator: React.FC = () => {
  const { profile, updateProfile, uploadCustomVrm, deleteCustomVrm } = useApp();
  const [loading, setLoading] = useState(false);
  const [isUploadingVrm, setIsUploadingVrm] = useState(false);

  // Local state initialized with current profile values or onboarding defaults
  const [gender, setGender] = useState(profile?.char_gender || "female");
  const [skin, setSkin] = useState(profile?.char_skin || "fair");
  const [hairStyle, setHairStyle] = useState(profile?.char_hair_style || "long");
  const [hairColor, setHairColor] = useState(profile?.char_hair_color || "black");
  const [eyes, setEyes] = useState(profile?.char_eyes || "sapphire");
  const [outfit, setOutfit] = useState(profile?.char_outfit || "cyan");
  const [charName, setCharName] = useState(profile?.char_name || "LIA");
  const [clothingStyle, setClothingStyle] = useState(profile?.char_clothing_style || "casual");
  const [height, setHeight] = useState(profile?.char_height || 1.0);
  const [accessories, setAccessories] = useState<string[]>(() => {
    try {
      return JSON.parse(profile?.char_accessories || "[]");
    } catch (_) {
      return [];
    }
  });

  const handleAccessoryChange = (acc: string) => {
    setAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const handleVrmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    if (!file.name.toLowerCase().endsWith(".vrm")) {
      alert("Only .vrm files are accepted.");
      return;
    }
    setIsUploadingVrm(true);
    try {
      await uploadCustomVrm(file);
      alert("Custom character model uploaded and applied successfully!");
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setIsUploadingVrm(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleVrmDelete = async () => {
    if (!confirm("Are you sure you want to remove your custom model and revert to default?")) return;
    setIsUploadingVrm(true);
    try {
      await deleteCustomVrm();
    } catch (err: any) {
      alert(err.message || "Failed to remove custom model");
    } finally {
      setIsUploadingVrm(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({
        char_gender: gender,
        char_skin: skin,
        char_hair_style: hairStyle,
        char_hair_color: hairColor,
        char_eyes: eyes,
        char_outfit: outfit,
        char_name: charName,
        char_clothing_style: clothingStyle,
        char_height: parseFloat(height.toString()),
        char_accessories: JSON.stringify(accessories)
      });
      alert("LIA's appearance updated successfully!");
    } catch (e) {
      alert("Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md h-full flex flex-col justify-between p-6 bg-slate-900/90 text-white rounded-2xl glass border border-slate-700/50 shadow-2xl">
      <div className="flex-1 overflow-y-auto pr-1 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Appearance Customizer</h2>
          <p className="text-xs text-slate-400 mt-1">Configure LIA's realistic facial traits and attire.</p>
        </div>

        {/* Custom VRM Upload */}
        <div className="space-y-2 p-3 bg-slate-950/40 rounded-xl border border-slate-700/50">
          <label className="text-xs font-semibold text-slate-300">CUSTOM 3D MODEL (.VRM)</label>
          <div className="flex items-center space-x-3">
            {profile?.avatar_type === "custom" ? (
              <button
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 text-xs font-medium py-1.5 rounded-lg transition-all"
                onClick={handleVrmDelete}
                disabled={isUploadingVrm}
              >
                Remove Custom Model
              </button>
            ) : (
              <>
                <input
                  type="file"
                  id="vrm-upload"
                  accept=".vrm"
                  className="hidden"
                  onChange={handleVrmUpload}
                />
                <label
                  htmlFor="vrm-upload"
                  className={`flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-medium py-1.5 rounded-lg transition-all cursor-pointer ${isUploadingVrm ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {isUploadingVrm ? 'Uploading...' : 'Upload Custom Model'}
                </label>
              </>
            )}
          </div>
          <p className="text-[10px] text-slate-500">Upload your own character model like in games. Overrides the base settings below.</p>
        </div>

        {/* Companion Name */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">COMPANION NAME</label>
          <input
            type="text"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
          />
        </div>

        {/* Gender / Body Base */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">AVATAR BASE</label>
          <div className="grid grid-cols-2 gap-2">
            {["female", "male"].map((g) => (
              <button
                key={g}
                className={`py-2 text-sm font-medium rounded-lg capitalize border transition-all ${
                  gender === g
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setGender(g)}
              >
                {g} Model
              </button>
            ))}
          </div>
        </div>

        {/* Skin Tone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">SKIN TONE</label>
          <div className="grid grid-cols-5 gap-2">
            {["porcelain", "fair", "tan", "brown", "deep"].map((s) => (
              <button
                key={s}
                className={`py-2 text-xs font-medium rounded-lg capitalize border transition-all ${
                  skin === s
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setSkin(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Styles */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">HAIR STYLE</label>
          <div className="grid grid-cols-3 gap-2">
            {["short", "spiky", "long", "bun", "curly", "wave"].map((h) => (
              <button
                key={h}
                className={`py-2 text-xs font-medium rounded-lg capitalize border transition-all ${
                  hairStyle === h
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setHairStyle(h)}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">HAIR COLOR</label>
          <div className="grid grid-cols-7 gap-1.5">
            {["black", "brown", "blonde", "pink", "blue", "violet", "white"].map((color) => (
              <button
                key={color}
                className={`py-2 text-[10px] font-medium rounded-lg capitalize border transition-all ${
                  hairColor === color
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setHairColor(color)}
              >
                {color.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Eye Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">EYE IRIS COLOR</label>
          <div className="grid grid-cols-6 gap-1.5">
            {["amber", "emerald", "sapphire", "violet", "rose", "crimson"].map((eye) => (
              <button
                key={eye}
                className={`py-1.5 text-[10px] font-medium rounded-lg capitalize border transition-all ${
                  eyes === eye
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setEyes(eye)}
              >
                {eye.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Height Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs font-semibold text-slate-300">HEIGHT RATIO</label>
            <span className="text-xs text-cyan-400 font-medium">{height}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.25"
            step="0.05"
            className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value))}
          />
        </div>

        {/* Clothing Style */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">CLOTHING ATTIRE</label>
          <div className="grid grid-cols-3 gap-2">
            {["casual", "professional", "scifi"].map((styleOpt) => (
              <button
                key={styleOpt}
                className={`py-2 text-xs font-medium rounded-lg capitalize border transition-all ${
                  clothingStyle === styleOpt
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setClothingStyle(styleOpt)}
              >
                {styleOpt}
              </button>
            ))}
          </div>
        </div>

        {/* Suit Accent (Holo-glow effect) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">HUD ACCENT LIGHTING</label>
          <div className="grid grid-cols-5 gap-2">
            {["cyan", "gold", "crimson", "violet", "rose"].map((accentOpt) => (
              <button
                key={accentOpt}
                className={`py-2 text-xs font-medium rounded-lg capitalize border transition-all ${
                  outfit === accentOpt
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
                onClick={() => setOutfit(accentOpt)}
              >
                {accentOpt}
              </button>
            ))}
          </div>
        </div>

        {/* Accessories */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">ACCESSORIES</label>
          <div className="grid grid-cols-2 gap-2">
            {["glasses", "earrings"].map((acc) => (
              <label
                key={acc}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                  accessories.includes(acc)
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={accessories.includes(acc)}
                  onChange={() => handleAccessoryChange(acc)}
                  className="hidden"
                />
                <span className="capitalize">{acc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800">
        <button
          className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-semibold py-2.5 rounded-xl shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Recompiling Mesh..." : "Lock In & Save Profile"}
        </button>
      </div>
    </div>
  );
};
