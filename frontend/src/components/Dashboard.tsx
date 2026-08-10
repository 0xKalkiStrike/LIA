"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { ThreeCanvas } from "./ThreeCanvas";
import {
  LogOut,
  Send,
  Sliders,
  Database,
  Cpu,
  FolderOpen,
  Check,
  X,
  Activity,
  Layers,
  Phone,
  PhoneOff,
  Mic,
  ChevronDown,
  ChevronUp,
  Code2,
  Presentation,
} from "lucide-react";

interface DashboardProps {
  onOpenCreator: () => void;
  onOpenVoice: () => void;
  onOpenMemory: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenCreator,
  onOpenVoice,
  onOpenMemory,
}) => {
  const {
    profile,
    chatHistory,
    sendChatMessage,
    logout,
    systemStats,
    isSpeaking,
    spokenText,
    wsConnected,
    isCollabActive,
    runTelemetryTrigger,
    openCodeWorkspace,
    openPresentationWorkspace,
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [collaborate, setCollaborate] = useState(false);
  const [liveCallActive, setLiveCallActive] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendChatMessage(inputMessage, collaborate);
    setInputMessage("");
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

  const isStreaming = chatHistory.length > 0 && chatHistory[chatHistory.length - 1].isStreaming;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* ─── Header ─── */}
      <header className="h-14 flex items-center justify-between px-5 bg-slate-900/50 border-b border-slate-800/60 backdrop-blur-xl z-10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-cyan-950/30 animate-breathe">L</div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${wsConnected ? "bg-emerald-400" : "bg-red-400"}`} />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">{profile?.char_name || "LIA"} AI</h1>
            <p className="text-[10px] text-slate-500">{wsConnected ? "Core Online" : "Offline Mode"}</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Diagnostics toggle */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-slate-500 hover:text-slate-300"
            title="System Diagnostics"
          >
            <Cpu className="w-4 h-4" />
          </button>
          <button onClick={onOpenCreator} className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-slate-500 hover:text-slate-300" title="Appearance">
            <Sliders className="w-4 h-4" />
          </button>
          <button onClick={onOpenVoice} className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-slate-500 hover:text-slate-300" title="Voice">
            <Activity className="w-4 h-4" />
          </button>
          <button onClick={onOpenMemory} className="p-2 hover:bg-slate-800/60 rounded-lg transition-all text-slate-500 hover:text-slate-300" title="Memory">
            <Database className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-slate-800 mx-1" />
          <button onClick={logout} className="p-2 hover:bg-red-950/30 hover:text-red-400 rounded-lg transition-all text-slate-500" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── Diagnostics Bar (collapsible) ─── */}
      {showDiagnostics && (
        <div className="px-5 py-2 bg-slate-900/30 border-b border-slate-800/40 flex items-center space-x-6 text-[10px] animate-fade-in flex-shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">CPU</span>
            <span className="text-cyan-400 font-semibold">{systemStats.cpu_percent || 0}%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">RAM</span>
            <span className="text-cyan-400 font-semibold">{systemStats.memory_percent || 0}%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">OS</span>
            <span className="text-slate-400 font-mono">{systemStats.platform || "..."}</span>
          </div>
          {isSpeaking && (
            <div className="flex items-center space-x-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">Speaking</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Main 2-Column Layout ─── */}
      <main className="flex-1 flex overflow-hidden min-h-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.04),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.04),transparent_50%)]">
        
        {/* ─── Left: Avatar Pod ─── */}
        <section className="w-72 desktop-only flex flex-col flex-shrink-0 p-3 space-y-2">
          <div className="flex-1 relative rounded-2xl border border-slate-800/60 bg-slate-900/20 backdrop-blur-md overflow-hidden shadow-2xl animate-border-glow">
            {/* Status tag */}
            <div className="absolute top-3 left-4 text-[10px] font-bold text-cyan-400/80 tracking-widest flex items-center space-x-1.5 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{profile?.char_name || "LIA"}</span>
            </div>

            {/* Speaking indicator */}
            {isSpeaking && (
              <div className="absolute top-3 right-4 flex items-center space-x-1.5 z-10 animate-fade-in">
                <div className="flex space-x-0.5">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-0.5 bg-cyan-400 rounded-full animate-pulse" style={{
                      height: `${6 + Math.random() * 8}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.4 + Math.random() * 0.3}s`
                    }} />
                  ))}
                </div>
              </div>
            )}
            
            {/* VRM WebGL */}
            <ThreeCanvas
              profile={profile}
              emotion={getActiveEmotion()}
              isSpeaking={isSpeaking || isStreaming}
              spokenText={spokenText || getLastMessage()}
              asleep={profile?.greeting_style === "asleep"}
            />
            
            {/* Quick Actions */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2 px-4 z-10">
              <button
                className="px-3 py-1.5 text-[10px] font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all backdrop-blur-sm hover:border-slate-600/50"
                onClick={() => runTelemetryTrigger("hand_wave")}
              >
                👋 Wave
              </button>
              <button
                className="px-3 py-1.5 text-[10px] font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all backdrop-blur-sm hover:border-slate-600/50"
                onClick={() => runTelemetryTrigger("smile")}
              >
                😊 Smile
              </button>
            </div>
          </div>

          {/* ─── Live Call Button ─── */}
          <button
            className={`live-call-btn w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 transition-all ${
              liveCallActive
                ? "active bg-gradient-to-r from-red-500/90 to-rose-600/90 text-white"
                : "bg-gradient-to-r from-cyan-500/90 to-violet-600/90 text-white hover:shadow-lg hover:shadow-cyan-950/30"
            }`}
            onClick={() => setLiveCallActive(!liveCallActive)}
          >
            {liveCallActive ? (
              <>
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                <span>Live Call</span>
              </>
            )}
          </button>
        </section>

        {/* ─── Right: Chat ─── */}
        <section className="flex-1 flex flex-col min-w-0 border-l border-slate-800/40">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center border border-cyan-500/10 animate-float">
                  <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">L</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-slate-300">{profile?.char_name || "LIA"} is ready</p>
                  <p className="text-xs text-slate-500 mt-1">Say something to start a conversation</p>
                </div>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-0.5 max-w-[80%] ${
                    msg.sender === "user"
                      ? "ml-auto items-end msg-user"
                      : "mr-auto items-start msg-assistant"
                  }`}
                >
                  {/* Sender + timestamp */}
                  <div className="flex items-center space-x-2 px-1">
                    <span className="text-[9px] text-slate-500 capitalize font-medium">{msg.sender === "user" ? "You" : profile?.char_name || "LIA"}</span>
                    {msg.emotion && msg.sender === "assistant" && (
                      <span className="text-[8px] text-cyan-500/60 bg-cyan-500/5 px-1.5 py-0.5 rounded-full border border-cyan-500/10">{msg.emotion}</span>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-tr-md shadow-lg shadow-cyan-950/15"
                        : "bg-slate-800/50 border border-slate-700/30 text-slate-200 rounded-tl-md shadow-md"
                    }`}
                  >
                    {msg.text}
                    {msg.isStreaming && (
                      <span className="inline-flex ml-1.5 space-x-0.5 align-middle">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </span>
                    )}
                  </div>
                  
                  {/* Task approval */}
                  {msg.task && (
                    <div className="mt-1.5 p-3 bg-slate-800/40 border border-slate-700/30 rounded-xl flex items-center justify-between space-x-4 animate-fade-in">
                      <div className="text-[11px]">
                        <span className="font-bold block uppercase text-amber-400/90">Automation</span>
                        <span className="text-slate-300 mt-0.5">{msg.task.type === "launch_app" ? `Launch ${msg.task.app}` : msg.task.command}</span>
                      </div>
                      {msg.taskResult ? (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <div className="flex space-x-1">
                          <button className="p-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg transition-all text-slate-500">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-red-500/15 hover:text-red-400 rounded-lg transition-all text-slate-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search */}
                  {msg.searchQuery && (
                    <span className="text-[9px] text-cyan-400/70 font-medium mt-0.5 block px-1">
                      🔍 "{msg.searchQuery}" ({msg.searchResults?.length || 0} results)
                    </span>
                  )}

                  {/* Web App IDE Action Button */}
                  {msg.webApp && (
                    <div className="mt-2 p-3 bg-[#0d1117] border border-cyan-500/30 rounded-xl flex items-center justify-between space-x-3 w-full shadow-lg">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Code2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{msg.webApp.project_name.replace(/_/g, " ").toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400">Web Application Project</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openCodeWorkspace(msg.webApp!.app_id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center space-x-1 flex-shrink-0"
                      >
                        <span>Open in Code IDE</span>
                      </button>
                    </div>
                  )}

                  {/* Presentation Workspace Action Button */}
                  {msg.presentation && (
                    <div className="mt-2 p-3 bg-[#0f172a] border border-violet-500/30 rounded-xl flex items-center justify-between space-x-3 w-full shadow-lg">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Presentation className="w-5 h-5 text-violet-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{msg.presentation.topic.toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400">{msg.presentation.total_slides} Slides Presentation</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openPresentationWorkspace(msg.presentation!.presentation_id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center space-x-1 flex-shrink-0"
                      >
                        <span>Open Slide Editor</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ─── Input Bar ─── */}
          <div className="p-3 border-t border-slate-800/40 bg-slate-900/20 flex-shrink-0 space-y-2">
            {/* Options row */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={collaborate}
                  onChange={() => setCollaborate(!collaborate)}
                  className="rounded border-slate-700 bg-slate-800 accent-cyan-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px] text-slate-500 group-hover:text-slate-400 flex items-center space-x-1 transition-colors">
                  <Layers className="w-3 h-3" />
                  <span>Multi-Agent</span>
                </span>
              </label>
              <div className="flex items-center space-x-2">
                {isSpeaking && (
                  <span className="text-[10px] text-emerald-400 flex items-center space-x-1 animate-fade-in">
                    <Mic className="w-3 h-3" />
                    <span>Speaking...</span>
                  </span>
                )}
                <span className="text-[10px] text-slate-600">Enter ↵</span>
              </div>
            </div>

            {/* Input + Send */}
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder={`Message ${profile?.char_name || "LIA"}...`}
                className="flex-1 bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                className="p-3 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white rounded-xl shadow-lg hover:shadow-cyan-500/15 active:scale-[0.97] transition-all"
                onClick={handleSend}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
