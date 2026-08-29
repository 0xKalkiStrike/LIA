import React from "react";
import { ChatBubble } from "lia-ui";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const UserMessage = () => (
  <Stage>
    <ChatBubble sender="user" senderLabel="You" text="What's on my calendar today?" />
  </Stage>
);

export const AssistantMessage = () => (
  <Stage>
    <ChatBubble
      sender="assistant"
      senderLabel="LIA"
      text="You have two events: a 10am standup and a 3pm dentist appointment."
      emotion="helpful"
    />
  </Stage>
);

export const StreamingMessage = () => (
  <Stage>
    <ChatBubble sender="assistant" senderLabel="LIA" text="Let me check that for you" streaming />
  </Stage>
);
