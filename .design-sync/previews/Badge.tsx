import React from "react";
import { Badge } from "lia-ui";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const Cyan = () => (
  <Stage>
    <Badge tone="cyan">happy</Badge>
  </Stage>
);
export const Violet = () => (
  <Stage>
    <Badge tone="violet">curious</Badge>
  </Stage>
);
export const Amber = () => (
  <Stage>
    <Badge tone="amber">Automation</Badge>
  </Stage>
);
export const Emerald = () => (
  <Stage>
    <Badge tone="emerald">Done</Badge>
  </Stage>
);
export const Red = () => (
  <Stage>
    <Badge tone="red">Failed</Badge>
  </Stage>
);
export const Slate = () => (
  <Stage>
    <Badge tone="slate">3 results</Badge>
  </Stage>
);
