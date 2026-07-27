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
  Play,
  FileText,
  Activity,
  Layers,
  UserCheck
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
    processes,
    files,
    currentPath,
    fetchFiles,
    executeCommand,
    activeTaskToApprove,
    approveTask,
    wsConnected,
    isCollabActive,
    runTelemetryTrigger
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [collaborate, setCollaborate] = useState(false);
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

  const getActiveViseme = () => {
    if (chatHistory.length === 0) return "rest";
    const last = chatHistory[chatHistory.length - 1];
    return last.sender === "assistant" && last.isStreaming ? "A" : "rest";
  };

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
      {/* Header bar */}
      <header className="h-16 flex items-center justify-between px-6 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md z-10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 flex items-center justify-center font-bold tracking-wider text-sm shadow-[0_0_12px_rgba(6,182,212,0.3)]">L</div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${wsConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">LIA AI Companion</h1>
            <p className="text-[10px] text-slate-400">Status: {wsConnected ? "Online Core Connected" : "Offline Fallback Enabled"}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Dashboard menu triggers */}
          <button
            onClick={onOpenCreator}
            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            title="Appearance Creator"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenVoice}
            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            title="Voice settings"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenMemory}
            className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            title="Long-Term Memory"
          >
            <Database className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-6 bg-slate-800 mx-2" />
          <button
            onClick={logout}
            className="p-2 hover:bg-red-950/30 hover:text-red-400 rounded-lg transition-all text-slate-400"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main dashboard columns */}
      <main className="flex-1 flex p-5 gap-5 overflow-hidden min-h-0 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        
        {/* Left Column: VRM 3D Holo-pod Container */}
        <section className="w-80 flex flex-col space-y-4 flex-shrink-0">
          <div className="flex-1 relative rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md overflow-hidden shadow-2xl">
            {/* Holographic pod glow lines */}
            <div className="absolute top-3 left-4 text-xs font-bold text-cyan-400 tracking-wider flex items-center space-x-1.5 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>HOLO-POD 01</span>
            </div>
            
            {/* VRM WebGL Component */}
            <ThreeCanvas
              profile={profile}
              emotion={getActiveEmotion()}
              viseme={getActiveViseme()}
              asleep={profile?.greeting_style === "asleep"}
            />
            
            {/* Quick Actions (triggers telemetry manually for testing) */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2 px-4 z-10">
              <button
                className="px-2.5 py-1 text-[10px] font-semibold bg-slate-850 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
                onClick={() => runTelemetryTrigger("hand_wave")}
              >
                👋 Wave
              </button>
              <button
                className="px-2.5 py-1 text-[10px] font-semibold bg-slate-850 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
                onClick={() => runTelemetryTrigger("smile")}
              >
                😊 Smile
              </button>
            </div>
          </div>

          {/* Telemetry panel */}
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md space-y-3 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>SYSTEM DIAGNOSTICS</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">CPU LOAD</span>
                <span className="text-lg font-bold text-cyan-400">{systemStats.cpu_percent || 0}%</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">RAM UTILS</span>
                <span className="text-lg font-bold text-cyan-400">{systemStats.memory_percent || 0}%</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[9px] text-slate-500 block">OPERATING SYSTEM</span>
              <span className="text-[10px] text-slate-300 font-mono truncate block">{systemStats.platform || "Checking..."}</span>
            </div>
          </div>
        </section>

        {/* Center Column: Chat Room (Floating Glass Card) */}
        <section className="flex-1 flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md shadow-2xl overflow-hidden min-w-[360px]">
          {/* Chat log messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold border border-cyan-500/20">L</div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">Initialize LIA Core 2.0</p>
                  <p className="text-[10px] text-slate-500 mt-1">Hello, I am {profile?.char_name || "LIA"}. Say hi to start.</p>
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-1 max-w-[85%] ${
                    msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <span className="text-[9px] text-slate-500 capitalize">{msg.sender}</span>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-cyan-600 text-white rounded-tr-none shadow-lg shadow-cyan-950/20"
                        : "bg-slate-800/70 border border-slate-700/40 text-slate-200 rounded-tl-none shadow-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                  
                  {/* Visual block showing execution tasks */}
                  {msg.task && (
                    <div className="mt-2 p-3 bg-slate-850 border border-slate-700/60 rounded-xl flex items-center justify-between space-x-4">
                      <div className="text-[11px]">
                        <span className="font-bold block uppercase text-amber-400">Automation Trigger</span>
                        <span className="text-slate-300 mt-0.5">{msg.task.type === "launch_app" ? `Launch ${msg.task.app}` : msg.task.command}</span>
                      </div>
                      {msg.taskResult ? (
                        <span className="text-[10px] text-emerald-400 font-bold">Completed</span>
                      ) : (
                        <div className="flex space-x-1.5">
                          <button
                            className="p-1 hover:bg-emerald-500/20 hover:text-emerald-400 rounded transition-all text-slate-400"
                            onClick={() => approveTask(true)}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all text-slate-400"
                            onClick={() => approveTask(false)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Web search details indicator */}
                  {msg.searchQuery && (
                    <span className="text-[9px] text-cyan-400 font-semibold mt-1 block">
                      🔍 Web query: "{msg.searchQuery}" ({msg.searchResults?.length || 0} hits)
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Control Input Bar */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              {/* Collaborate switch */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={collaborate}
                  onChange={() => setCollaborate(!collaborate)}
                  className="rounded border-slate-700 bg-slate-800 accent-cyan-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Agent Collaboration Panel</span>
                </span>
              </label>
              <span className="text-[10px] text-slate-500">Press Enter to send</span>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ask LIA a question..."
                className="flex-1 bg-slate-850 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-500"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                className="p-3 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white rounded-xl shadow-lg hover:shadow-cyan-500/10 active:scale-[0.98] transition-all"
                onClick={handleSend}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Local Workspace Explorer & Process details */}
        <section className="w-80 flex flex-col space-y-4 flex-shrink-0">
          {/* File Manager */}
          <div className="flex-1 p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md shadow-xl flex flex-col overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 flex items-center space-x-1.5 flex-shrink-0 mb-3">
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>WORKSPACE FILE MANAGER</span>
            </h3>
            
            <div className="text-[10px] text-slate-500 font-mono select-all truncate mb-2 px-1">
              Path: {currentPath}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
              {files.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-600">Workspace is empty.</div>
              ) : (
                files.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg border border-slate-700/20 transition-all text-xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="truncate text-slate-300 font-mono">{f.name || f}</span>
                    </div>
                    {f.is_dir ? (
                      <button
                        className="text-[10px] text-cyan-400"
                        onClick={() => fetchFiles(f.path)}
                      >
                        Open
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">{Math.round((f.size || 0) / 1024)} KB</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Process diagnostics details */}
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md space-y-3 shadow-xl max-h-48 flex flex-col overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 flex items-center space-x-1.5 flex-shrink-0">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>ACTIVE PROCESS LOGS</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 text-[10px] font-mono">
              {processes.slice(0, 10).map((p, idx) => (
                <div key={idx} className="flex justify-between text-slate-400">
                  <span className="truncate max-w-[120px]">{p.name}</span>
                  <span>CPU: {Math.round(p.cpu_percent || 0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
