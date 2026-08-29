import React, { useState } from "react";
import { TextInput } from "lia-ui";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const Default = () => (
  <Stage>
    <TextInput placeholder="Message LIA..." className="w-64" />
  </Stage>
);

export const WithValue = () => {
  const [value, setValue] = useState("What's the weather like today?");
  return (
    <Stage>
      <TextInput className="w-64" value={value} onChange={(e) => setValue(e.target.value)} />
    </Stage>
  );
};

export const Disabled = () => (
  <Stage>
    <TextInput className="w-64" placeholder="Connect to send messages..." disabled />
  </Stage>
);
