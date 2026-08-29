import React from "react";
import { Panel } from "lia-ui";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const Default = () => (
  <Stage>
    <Panel className="p-4 w-64">
      <h3 className="text-sm font-semibold text-white mb-1">Voice Settings</h3>
      <p className="text-xs text-slate-400">Choose a persona and accent for LIA's spoken replies.</p>
    </Panel>
  </Stage>
);

export const Glow = () => (
  <Stage>
    <Panel glow className="p-4 w-64 h-40 flex items-center justify-center">
      <span className="text-xs text-cyan-400/80 tracking-widest font-bold">LIA</span>
    </Panel>
  </Stage>
);
