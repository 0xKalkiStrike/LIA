"use client";

import React from "react";
import { useApp } from "../context/AppContext";

export const AgentDebate: React.FC = () => {
  const { collabTurns, isCollabActive } = useApp();

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case "software_engineer":
        return "border-emerald-500/30 bg-emerald-950/10 text-emerald-400";
      case "researcher":
        return "border-cyan-500/30 bg-cyan-950/10 text-cyan-400";
      case "designer":
        return "border-pink-500/30 bg-pink-950/10 text-pink-400";
      case "security_analyst":
        return "border-red-500/30 bg-red-950/10 text-red-400";
      case "business_analyst":
        return "border-amber-500/30 bg-amber-950/10 text-amber-400";
      case "data_scientist":
        return "border-violet-500/30 bg-violet-950/10 text-violet-400";
      case "marketing_expert":
        return "border-sky-500/30 bg-sky-950/10 text-sky-400";
      default:
        return "border-slate-700/50 bg-slate-800/20 text-slate-300";
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-5 bg-slate-900/90 text-white rounded-2xl glass border border-slate-700/50 shadow-2xl overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Agent Collaboration Stream</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Specialized agents debating and resolving user requirements.</p>
        </div>
        {isCollabActive && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pt-4 space-y-3 min-h-0">
        {collabTurns.length === 0 ? (
          <div className="text-center py-16 text-xs text-slate-500">
            {isCollabActive ? "Debating prompt..." : "No active collaboration debate. Ask a complex query and enable 'Collaborate' to trigger dialogue."}
          </div>
        ) : (
          collabTurns.map((turn, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex flex-col space-y-1 transition-all animate-fade-in ${getAgentColor(
                turn.agent
              )}`}
            >
              <div className="flex items-center space-x-1.5 text-xs font-semibold">
                <span>{turn.emoji}</span>
                <span className="uppercase tracking-wider">{turn.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-200 mt-1">{turn.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
