"use client";

import React from "react";

export type BadgeTone = "cyan" | "violet" | "amber" | "emerald" | "red" | "slate";

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  cyan: "text-cyan-400/80 bg-cyan-500/5 border-cyan-500/10",
  violet: "text-violet-400/80 bg-violet-500/5 border-violet-500/10",
  amber: "text-amber-400/90 bg-amber-500/5 border-amber-500/10",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/10",
  red: "text-red-400 bg-red-500/10 border-red-500/10",
  slate: "text-slate-400 bg-slate-500/10 border-slate-500/10",
};

/** Small rounded label for emotion tags, counts, and status pills. */
export const Badge: React.FC<BadgeProps> = ({ children, tone = "slate", className = "" }) => (
  <span
    className={[
      "inline-flex items-center px-1.5 py-0.5 rounded-full border text-[8px] font-medium",
      toneClasses[tone],
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </span>
);
