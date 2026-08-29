"use client";

import React from "react";

export type StatusDotState = "online" | "offline" | "busy" | "speaking";

export interface StatusDotProps {
  state: StatusDotState;
  /** Pulses via CSS animation; defaults to on for `speaking`/`busy`. */
  pulse?: boolean;
  className?: string;
}

const stateClasses: Record<StatusDotState, string> = {
  online: "bg-emerald-400",
  offline: "bg-red-400",
  busy: "bg-amber-400",
  speaking: "bg-cyan-400",
};

/** Small colored presence dot, e.g. the connection indicator on the avatar badge or header. */
export const StatusDot: React.FC<StatusDotProps> = ({ state, pulse, className = "" }) => {
  const shouldPulse = pulse ?? (state === "speaking" || state === "busy");
  return (
    <span
      className={[
        "inline-block w-2.5 h-2.5 rounded-full",
        stateClasses[state],
        shouldPulse ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
};
