import React from "react";
import { StatusDot } from "lia-ui";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

const Row = ({ state, label }: { state: "online" | "offline" | "busy" | "speaking"; label: string }) => (
  <div className="flex items-center space-x-2 text-xs text-slate-300">
    <StatusDot state={state} />
    <span>{label}</span>
  </div>
);

export const Online = () => (
  <Stage>
    <Row state="online" label="Core Online" />
  </Stage>
);
export const Offline = () => (
  <Stage>
    <Row state="offline" label="Offline Mode" />
  </Stage>
);
export const Busy = () => (
  <Stage>
    <Row state="busy" label="Thinking…" />
  </Stage>
);
export const Speaking = () => (
  <Stage>
    <Row state="speaking" label="Speaking" />
  </Stage>
);
