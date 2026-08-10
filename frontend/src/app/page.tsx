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

  const [activePanel, setActivePanel] = useState<string>("chat"); // chat | productivity | debate | customizer | voice | memory | code | presentation
  
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
      <div className="w-full min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[550px]">
          
          {/* Left panel: 3D Preview (for onboarding) or Brand pod */}
          <div className="relative bg-slate-950/40 p-6 flex flex-col justify-between border-r border-slate-800/80">
            <div className="absolute top-4 left-4 text-xs font-bold text-cyan-400 tracking-wider flex items-center space-x-1.5 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>AVATAR SIMULATOR</span>
            </div>

            {/* If onboarding, render real-time preview of their options */}
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

            <div className="text-center space-y-1 mt-4 z-10">
              <h2 className="text-base font-bold text-slate-200">LIA Core v2.0 Platform</h2>
              <p className="text-xs text-slate-400">Next-generation cognitive AI Operative companion.</p>
            </div>
          </div>

          {/* Right panel: Controls */}
          <div className="p-8 flex flex-col justify-between overflow-y-auto max-h-[600px]">
            <div>
              {/* Form header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  {hasUsers ? (authMode === "login" ? "Access Console" : "Register Core") : "System Onboarding"}
                </h3>
                {hasUsers && (
                  <button
                    className="text-xs text-cyan-400 hover:underline flex items-center space-x-1"
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
                <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {/* Onboarding fields */}
                {authMode === "signup" && (
                  <div className="space-y-3 p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wider">COMPANION CUSTOMIZATION</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">AVATAR BASE</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftGender}
                          onChange={(e) => setDraftGender(e.target.value)}
                        >
                          <option value="female">Female</option>
                          <option value="male">Male (Fallback)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">COMPANION NAME</label>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">HAIR STYLE</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftHairStyle}
                          onChange={(e) => setDraftHairStyle(e.target.value)}
                        >
                          <option value="long">Long Style</option>
                          <option value="short">Short Trim</option>
                          <option value="bun">Back Bun</option>
                          <option value="spiky">Spiky Cut</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">HAIR COLOR</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftHairColor}
                          onChange={(e) => setDraftHairColor(e.target.value)}
                        >
                          <option value="black">Obsidian Black</option>
                          <option value="brown">Brown</option>
                          <option value="blonde">Blonde</option>
                          <option value="pink">Pink</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">VOICE PRESET</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftVoice}
                          onChange={(e) => setDraftVoice(e.target.value)}
                        >
                          <option value="friday">Friday (Warm)</option>
                          <option value="jarvis_classic">Jarvis (Classic)</option>
                          <option value="nova">Nova (Calm)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">HUD GLOW</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          value={draftOutfit}
                          onChange={(e) => setDraftOutfit(e.target.value)}
                        >
                          <option value="cyan">Neon Cyan</option>
                          <option value="gold">Gold</option>
                          <option value="crimson">Crimson Red</option>
                          <option value="violet">Violet</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400">VOICE ACCENT</label>
                      <select
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        value={draftAccent}
                        onChange={(e) => setDraftAccent(e.target.value)}
                      >
                        {Object.keys(accents || {}).length > 0 ? (
                          Object.entries(accents).map(([id, cfg]: [string, any]) => (
                            <option key={id} value={id}>{cfg.label || id}</option>
                          ))
                        ) : (
                          <>
                            <option value="us">American (US)</option>
                            <option value="gb">British (UK)</option>
                            <option value="in">Indian (IN)</option>
                            <option value="au">Australian (AU)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* Account details */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 block tracking-wider">COMMANDER LOG-IN</span>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300">Commander Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. Tony"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                      <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>

                  {authMode === "signup" && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300">Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Commander Tony"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300">Secret Security Word</label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="Enter secret word..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        value={secretWord}
                        onChange={(e) => setSecretWord(e.target.value)}
                        required
                      />
                      <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold py-2.5 text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 mt-6"
                  disabled={loading}
                >
                  {loading ? "Decrypting Core..." : authMode === "signup" ? "Initialize & Launch LIA" : "Connect Security Session"}
                </button>
              </form>
            </div>
            <div className="text-[10px] text-center text-slate-500 mt-6">
              Privacy-first local intelligence. Data remains encrypted on your machine.
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
      <div className="w-full h-screen flex bg-slate-950 text-white overflow-hidden">
        <nav className="w-16 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between py-6 items-center flex-shrink-0 z-10">
          <div className="flex flex-col space-y-4">
            {[
              { id: "chat", label: "Chat room", icon: <MessageSquare className="w-5 h-5" /> },
              { id: "code", label: "Code IDE", icon: <Code2 className="w-5 h-5" /> },
              { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`p-3 rounded-xl transition-all ${
                  activePanel === tab.id
                    ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "text-slate-500 hover:text-slate-350"
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
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300" title={`Logged in as ${profile?.username}`}>
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
      <div className="w-full h-screen flex bg-slate-950 text-white overflow-hidden">
        <nav className="w-16 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between py-6 items-center flex-shrink-0 z-10">
          <div className="flex flex-col space-y-4">
            {[
              { id: "chat", label: "Chat room", icon: <MessageSquare className="w-5 h-5" /> },
              { id: "code", label: "Code IDE", icon: <Code2 className="w-5 h-5" /> },
              { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`p-3 rounded-xl transition-all ${
                  activePanel === tab.id
                    ? "bg-violet-500/20 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                    : "text-slate-500 hover:text-slate-350"
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
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300" title={`Logged in as ${profile?.username}`}>
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
  return (
    <div className="w-full h-screen flex bg-slate-950 text-white overflow-hidden">
      
      {/* Sidebar Navigation */}
      <nav className="w-16 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between py-6 items-center flex-shrink-0 z-10">
        <div className="flex flex-col space-y-4">
          {[
            { id: "chat", label: "Chat room", icon: <MessageSquare className="w-5 h-5" /> },
            { id: "code", label: "Code IDE", icon: <Code2 className="w-5 h-5" /> },
            { id: "presentation", label: "Slides", icon: <Presentation className="w-5 h-5" /> },
            { id: "productivity", label: "Productivity", icon: <Calendar className="w-5 h-5" /> },
            { id: "debate", label: "Agent Debate", icon: <Layers className="w-5 h-5" /> },
            { id: "customizer", label: "Customizer", icon: <Sliders className="w-5 h-5" /> },
            { id: "voice", label: "Voice settings", icon: <Activity className="w-5 h-5" /> },
            { id: "memory", label: "Layered Memory", icon: <Database className="w-5 h-5" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`p-3 rounded-xl transition-all ${
                activePanel === tab.id
                  ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : "text-slate-500 hover:text-slate-350"
              }`}
              onClick={() => setActivePanel(tab.id)}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
        
        {/* User Info / State */}
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300" title={`Logged in as ${profile?.username}`}>
          {profile?.username ? profile.username[0].toUpperCase() : "U"}
        </div>
      </nav>

      {/* Main content display */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        
        {/* Render full Dashboard if "chat" is active */}
        {activePanel === "chat" && (
          <Dashboard
            onOpenCreator={() => setActivePanel("customizer")}
            onOpenVoice={() => setActivePanel("voice")}
            onOpenMemory={() => setActivePanel("memory")}
          />
        )}

        {/* Otherwise, render a split view (LIA pod on the left, active tab panel on the right) */}
        {activePanel !== "chat" && activePanel !== "code" && activePanel !== "presentation" && (
          <div className="flex-1 flex p-5 gap-5 min-h-0 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden">
            
            {/* LIA Pod column */}
            <div className="w-80 flex flex-col space-y-4 flex-shrink-0">
              <div className="flex-1 relative rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md overflow-hidden shadow-2xl">
                <div className="absolute top-3 left-4 text-xs font-bold text-cyan-400 tracking-wider flex items-center space-x-1.5 z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{profile?.char_name || "LIA"} CORE</span>
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
                className="w-full bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
                onClick={() => setActivePanel("chat")}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Return to Chat Room</span>
              </button>
            </div>

            {/* Panel Column */}
            <div className="flex-1 min-w-[360px] h-full overflow-hidden">
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
