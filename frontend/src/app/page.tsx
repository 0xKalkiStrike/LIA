"use client";

import React, { useState } from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { ThreeCanvas } from "../components/ThreeCanvas";
import { CharacterCreator } from "../components/CharacterCreator";
import { VoiceSettings } from "../components/VoiceSettings";
import { MemoryManager } from "../components/MemoryManager";
import { ProductivityHub } from "../components/ProductivityHub";
import { AgentDebate } from "../components/AgentDebate";
import { Dashboard } from "../components/Dashboard";
import { CodeWorkspace } from "../components/CodeWorkspace";
import { PresentationWorkspace } from "../components/PresentationWorkspace";
import {
  MessageSquare,
  Layers,
  Calendar,
  Sliders,
  Activity,
  Database,
  Lock,
  User,
  UserPlus,
  Code2,
  Presentation,
} from "lucide-react";

const MainContent: React.FC = () => {
  const {
    token,
    profile,
    hasUsers,
    accents,
    signup,
    login,
    chatHistory,
    isSpeaking,
    spokenText,
    activeProjectId,
    activePresentationId,
    closeWorkspace,
  } = useApp();

  const [activePanel, setActivePanel] = useState<string>("chat");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect orientation changes
  React.useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    handleOrientationChange();
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  // Onboarding & Login forms
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Onboarding Avatar customizer draft
  const [draftGender, setDraftGender] = useState("female");
  const [draftOutfit, setDraftOutfit] = useState("cyan");
  const [draftHairStyle, setDraftHairStyle] = useState("long");
  const [draftHairColor, setDraftHairColor] = useState("black");
  const [draftName, setDraftName] = useState("LIA");
  const [draftVoice, setDraftVoice] = useState("friday");
  const [draftAccent, setDraftAccent] = useState("us");
  const [draftLang, setDraftLang] = useState("auto");

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      if (authMode === "signup") {
        await signup(username, displayName, secretWord, {
          char_gender: draftGender,
          char_outfit: draftOutfit,
          char_hair_style: draftHairStyle,
          char_hair_color: draftHairColor,
          char_name: draftName,
          voice_persona: draftVoice,
          voice_accent: draftAccent,
          language_mode: draftLang,
          avatar_type: draftGender === "male" ? "male" : "lia",
          vrm_path: draftGender === "male" ? "" : "/LIA.vrm"
        });
      } else {
        await login(username, secretWord);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Operation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const getActiveEmotion = () => {
    if (chatHistory.length === 0) return "neutral";
    const last = chatHistory[chatHistory.length - 1];
    return last.sender === "assistant" ? last.emotion || "neutral" : "neutral";
  };

  const getLastMessage = () => {
    if (chatHistory.length === 0) return "";
    const last = chatHistory[chatHistory.length - 1];
    return last.sender === "assistant" ? last.text : "";
  };

  // ── SCREEN 1: Onboarding / Login (Unauthenticated)
  if (!token) {
    const isSignup = authMode === "signup" && !hasUsers;
    return (
      <div className="w-screen min-h-screen flex items-center justify-center bg-slate-950 text-white px-3 py-6 sm:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-y-auto">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 bg-slate-900/50 backdrop-blur-md rounded-xl sm:rounded-2xl lg:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-screen lg:min-h-[600px] lg:max-h-[90vh]">

          {/* Left panel: 3D Preview - Hidden on mobile, shown on lg+ */}
          <div className="hidden lg:flex relative bg-slate-950/40 p-6 flex-col justify-between border-r border-slate-800/80">
            <div className="absolute top-4 left-4 text-xs font-bold text-cyan-400 tracking-widest flex items-center space-x-1.5 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>AVATAR SIMULATOR</span>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[300px]">
              <ThreeCanvas
                profile={{
                  char_gender: draftGender,
                  char_outfit: draftOutfit,
                  char_hair_style: draftHairStyle,
                  char_hair_color: draftHairColor,
                  avatar_type: draftGender === "male" ? "male" : "lia",
                  vrm_path: draftGender === "male" ? "" : "/LIA.vrm"
                }}
                asleep={false}
              />
            </div>

            <div className="text-center space-y-2 mt-6 z-10">
              <h2 className="text-base font-bold text-slate-200">LIA Core v2.0</h2>
              <p className="text-xs text-slate-400">Cognitive AI Companion</p>
            </div>
          </div>

          {/* Right panel: Controls - Full height on mobile, scrollable on larger */}
          <div className="p-5 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto max-h-[90vh] lg:max-h-none">
            <div>
              {/* Form header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  {hasUsers ? (authMode === "login" ? "Access" : "Register") : "Setup"}
                </h3>
                {hasUsers && (
                  <button
                    className="text-xs sm:text-sm text-cyan-400 hover:underline flex items-center space-x-1 px-2 py-1 rounded hover:bg-cyan-400/10 transition"
                    onClick={() => {
                      setAuthMode(authMode === "login" ? "signup" : "login");
                      setErrorMsg("");
                    }}
                  >
                    {authMode === "login" ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Sign Up</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5" />
                        <span>Log In</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-950/20 border border-red-500/20 text-red-400 text-xs rounded-lg">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4 sm:space-y-5">
                {/* Onboarding fields */}
                {authMode === "signup" && (
                  <div className="space-y-3 p-4 sm:p-5 bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/40 border border-cyan-500/20 rounded-lg sm:rounded-xl backdrop-blur-md hover:border-cyan-500/40 transition-all duration-300 shadow-[0_0_20px_rgba(0,217,255,0.1)]">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-500 rounded opacity-20 blur"></div>
                        <div className="relative bg-slate-900/80 px-2.5 py-1 rounded">
                          <span className="text-xs font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent tracking-widest uppercase">⚙️ Setup</span>
                        </div>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/40 via-violet-500/20 to-transparent"></div>
                    </div>

                    {/* Avatar & Name Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Avatar</label>
                        <select
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftGender}
                          onChange={(e) => setDraftGender(e.target.value)}
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Name</label>
                        <input
                          type="text"
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          maxLength={20}
                          placeholder="LIA"
                        />
                      </div>
                    </div>

                    {/* Hair & Color Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Hair</label>
                        <select
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftHairStyle}
                          onChange={(e) => setDraftHairStyle(e.target.value)}
                        >
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                          <option value="bun">Bun</option>
                          <option value="spiky">Spiky</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Color</label>
                        <select
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftHairColor}
                          onChange={(e) => setDraftHairColor(e.target.value)}
                        >
                          <option value="black">Black</option>
                          <option value="brown">Brown</option>
                          <option value="blonde">Blonde</option>
                          <option value="pink">Pink</option>
                        </select>
                      </div>
                    </div>

                    {/* Voice & Glow Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Voice</label>
                        <select
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftVoice}
                          onChange={(e) => setDraftVoice(e.target.value)}
                        >
                          <option value="friday">Friday</option>
                          <option value="jarvis_classic">Jarvis</option>
                          <option value="nova">Nova</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-300 font-medium">Glow</label>
                        <select
                          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                          value={draftOutfit}
                          onChange={(e) => setDraftOutfit(e.target.value)}
                        >
                          <option value="cyan">Cyan</option>
                          <option value="gold">Gold</option>
                          <option value="crimson">Red</option>
                          <option value="violet">Violet</option>
                        </select>
                      </div>
                    </div>

                    {/* Accent - Full Width */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs text-slate-300 font-medium">Accent</label>
                      <select
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        value={draftAccent}
                        onChange={(e) => setDraftAccent(e.target.value)}
                      >
                        {Object.keys(accents || {}).length > 0 ? (
                          Object.entries(accents).map(([id, cfg]: [string, any]) => (
                            <option key={id} value={id}>{cfg.label || id}</option>
                          ))
                        ) : (
                          <>
                            <option value="us">US English</option>
                            <option value="gb">British English</option>
                            <option value="in">Indian English</option>
                            <option value="au">Australian English</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* Account details */}
                <div className="space-y-4 sm:space-y-5 pt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs sm:text-sm font-bold text-cyan-400 tracking-widest uppercase">🔐 Security</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-cyan-400/30 to-transparent"></div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-slate-300 font-medium">Username</label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="text"
                        placeholder="Enter username"
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {authMode === "signup" && (
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm text-slate-300 font-medium">Display Name</label>
                      <input
                        type="text"
                        placeholder="Your display name"
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-slate-300 font-medium">Secret Word</label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="password"
                        placeholder="Enter secret word"
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        value={secretWord}
                        onChange={(e) => setSecretWord(e.target.value)}
                        required
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 active:scale-95 text-white font-bold py-3 sm:py-3.5 text-sm sm:text-base rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6 sm:mt-8"
                  disabled={loading}
                >
                  {loading
                    ? "Processing..."
                    : authMode === "signup"
                    ? "🚀 Launch LIA"
                    : "🔓 Connect"}
                </button>
              </form>
            </div>
            <div className="text-[9px] sm:text-[10px] text-center text-slate-500 mt-3 sm:mt-6">
              Privacy-first. Data encrypted locally.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── FULLSCREEN WORKSPACE VIEWS ──
  // Code Workspace takes over the full view
  if (activePanel === "code" && activeProjectId && token) {
    return (
      <div className="w-screen h-screen flex bg-slate-950 text-white overflow-hidden flex-col lg:flex-row">
        <nav className="w-full lg:w-16 h-16 lg:h-screen bg-gradient-to-b lg:bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-800/60 backdrop-blur-md flex lg:flex-col justify-between items-center py-2 lg:py-6 px-3 lg:px-0 flex-shrink-0 z-30 gap-2 lg:gap-0 overflow-x-auto">
          <div className="flex lg:flex-col gap-1 lg:gap-2 overflow-x-auto lg:overflow-x-visible">
            {[
              { id: "chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" /> },
              { id: "code", label: "Code", icon: <Code2 className="w-5 h-5" /> },
              { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`p-2.5 lg:p-3 rounded-lg lg:rounded-xl transition-all duration-200 flex-shrink-0 ${
                  activePanel === tab.id
                    ? "bg-gradient-to-r from-cyan-500/30 to-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"
                }`}
                onClick={() => {
                  if (tab.id === "chat") closeWorkspace();
                  else setActivePanel(tab.id);
                }}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-sm font-bold text-cyan-300 hover:border-cyan-400/60 transition-all flex-shrink-0" title={`${profile?.username}`}>
            {profile?.username ? profile.username[0].toUpperCase() : "U"}
          </div>
        </nav>
        <div className="flex-1 overflow-hidden">
          <CodeWorkspace projectId={activeProjectId} token={token} onClose={closeWorkspace} />
        </div>
      </div>
    );
  }

  // Presentation Workspace takes over the full view
  if (activePanel === "presentation" && activePresentationId && token) {
    return (
      <div className="w-screen h-screen flex bg-slate-950 text-white overflow-hidden flex-col lg:flex-row">
        <nav className="w-full lg:w-16 h-16 lg:h-screen bg-gradient-to-b lg:bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-800/60 backdrop-blur-md flex lg:flex-col justify-between items-center py-2 lg:py-6 px-3 lg:px-0 flex-shrink-0 z-30 gap-2 lg:gap-0 overflow-x-auto">
          <div className="flex lg:flex-col gap-1 lg:gap-2 overflow-x-auto lg:overflow-x-visible">
            {[
              { id: "chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" /> },
              { id: "code", label: "Code", icon: <Code2 className="w-5 h-5" /> },
              { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`p-2.5 lg:p-3 rounded-lg lg:rounded-xl transition-all duration-200 flex-shrink-0 ${
                  activePanel === tab.id
                    ? "bg-gradient-to-r from-violet-500/30 to-violet-400/10 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"
                }`}
                onClick={() => {
                  if (tab.id === "chat") closeWorkspace();
                  else setActivePanel(tab.id);
                }}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300 hover:border-violet-400/60 transition-all flex-shrink-0" title={`${profile?.username}`}>
            {profile?.username ? profile.username[0].toUpperCase() : "U"}
          </div>
        </nav>
        <div className="flex-1 overflow-hidden">
          <PresentationWorkspace presentationId={activePresentationId} token={token} onClose={closeWorkspace} />
        </div>
      </div>
    );
  }

  // ── SCREEN 2: Dashboard (Authenticated)
  const navTabs = [
    { id: "chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "code", label: "Code", icon: <Code2 className="w-5 h-5" /> },
    { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
    { id: "productivity", label: "Tasks", icon: <Calendar className="w-5 h-5" /> },
    { id: "debate", label: "Debate", icon: <Layers className="w-5 h-5" /> },
    { id: "customizer", label: "Style", icon: <Sliders className="w-5 h-5" /> },
    { id: "voice", label: "Voice", icon: <Activity className="w-5 h-5" /> },
    { id: "memory", label: "Memory", icon: <Database className="w-5 h-5" /> }
  ];

  return (
    <div className="w-screen h-screen flex bg-slate-950 text-white overflow-hidden flex-col lg:flex-row">

      {/* Sidebar Navigation - Horizontal on mobile/tablet, vertical on lg+ */}
      <nav className="w-full lg:w-16 h-16 lg:h-screen bg-gradient-to-b lg:bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-800/60 backdrop-blur-md flex lg:flex-col justify-between items-center py-2 lg:py-6 px-3 lg:px-0 flex-shrink-0 z-30 gap-2 lg:gap-0 overflow-x-auto">

        {/* Navigation Tabs */}
        <div className="flex lg:flex-col gap-1 lg:gap-2 overflow-x-auto lg:overflow-x-visible">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActivePanel(tab.id);
                setMobileMenuOpen(false);
              }}
              className={`p-2.5 lg:p-3 rounded-lg lg:rounded-xl transition-all duration-200 flex-shrink-0 whitespace-nowrap lg:whitespace-normal ${
                activePanel === tab.id
                  ? "bg-gradient-to-r from-cyan-500/30 to-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/40"
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* User Avatar & Menu */}
        <div className="flex lg:flex-col items-center gap-3 lg:gap-4 mt-2 lg:mt-auto lg:pt-4 border-t lg:border-t lg:border-b border-slate-800/40">
          <button className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-sm font-bold text-cyan-300 hover:border-cyan-400/60 transition-all" title={`${profile?.username}`}>
            {profile?.username ? profile.username[0].toUpperCase() : "U"}
          </button>
        </div>
      </nav>

      {/* Main content display */}
      <div className="flex-1 flex overflow-hidden min-w-0 flex-col lg:flex-row">

        {/* Render full Dashboard if "chat" is active */}
        {activePanel === "chat" && (
          <Dashboard
            onOpenCreator={() => setActivePanel("customizer")}
            onOpenVoice={() => setActivePanel("voice")}
            onOpenMemory={() => setActivePanel("memory")}
          />
        )}

        {/* Split view: LIA pod + panel (optimized for all sizes) */}
        {activePanel !== "chat" && activePanel !== "code" && activePanel !== "presentation" && (
          <div className="flex-1 flex flex-col lg:flex-row p-2 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6 min-h-0 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-y-auto lg:overflow-hidden">

            {/* LIA Pod column - Hidden on mobile/tablet, shown on lg+ */}
            <div className="hidden lg:flex w-72 flex-col space-y-3 flex-shrink-0">
              <div className="flex-1 relative rounded-xl lg:rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/50 to-slate-950/50 backdrop-blur-md overflow-hidden shadow-2xl hover:border-slate-700/80 transition-all duration-300">
                <div className="absolute top-4 left-4 text-xs font-bold text-cyan-400 tracking-widest flex items-center space-x-2 z-10">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="truncate max-w-[120px]">{profile?.char_name || "LIA"} CORE</span>
                </div>
                <ThreeCanvas
                  profile={profile}
                  emotion={getActiveEmotion()}
                  isSpeaking={isSpeaking}
                  spokenText={spokenText || getLastMessage()}
                  asleep={profile?.greeting_style === "asleep"}
                />
              </div>
              <button
                className="w-full bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 hover:text-cyan-200 font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center justify-center space-x-2 flex-shrink-0 group"
                onClick={() => setActivePanel("chat")}
              >
                <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Back to Chat</span>
              </button>
            </div>

            {/* Panel Column - Optimized for all screen sizes */}
            <div className="flex-1 min-w-0 h-full lg:overflow-y-auto rounded-lg lg:rounded-xl border border-slate-800/40 bg-gradient-to-br from-slate-900/30 to-slate-950/30 backdrop-blur-sm p-4 sm:p-6">
              {activePanel === "customizer" && <CharacterCreator />}
              {activePanel === "voice" && <VoiceSettings />}
              {activePanel === "memory" && <MemoryManager />}
              {activePanel === "productivity" && <ProductivityHub />}
              {activePanel === "debate" && <AgentDebate />}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default function Page() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
