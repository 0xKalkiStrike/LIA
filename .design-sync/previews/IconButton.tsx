import React from "react";
import { IconButton } from "lia-ui";
import { Cpu, LogOut, Sliders } from "lucide-react";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const Default = () => (
  <Stage>
    <IconButton icon={<Cpu />} label="System Diagnostics" />
  </Stage>
);

export const Active = () => (
  <Stage>
    <IconButton icon={<Sliders />} label="Appearance" active />
  </Stage>
);

export const Danger = () => (
  <Stage>
    <IconButton icon={<LogOut />} label="Sign out" tone="danger" />
  </Stage>
);
