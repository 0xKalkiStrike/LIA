"use client";

import React from "react";
import { Badge } from "./Badge";

export interface ChatBubbleProps {
  sender: "user" | "assistant" | "system";
  /** Display name shown above the bubble, e.g. "You" or the assistant's char_name. */
  senderLabel: string;
  text: string;
  emotion?: string;
  /** Shows the animated typing dots after the text. */
  streaming?: boolean;
  /** Extra content rendered below the bubble (task approval, search results, action cards). */
  children?: React.ReactNode;
  className?: string;
}

/** One chat message: sender/emotion header + the message bubble itself, styled per sender. */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  sender,
  senderLabel,
  text,
  emotion,
  streaming = false,
  children,
  className = "",
}) => {
  const isUser = sender === "user";
  return (
    <div
      className={[
        "flex flex-col space-y-0.5 max-w-[80%]",
        isUser ? "ml-auto items-end msg-user" : "mr-auto items-start msg-assistant",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center space-x-2 px-1">
        <span className="text-[9px] text-[var(--text-tertiary)] capitalize font-medium">{senderLabel}</span>
        {emotion && !isUser && <Badge tone="cyan">{emotion}</Badge>}
      </div>

      <div
        className={[
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-tr-md shadow-lg shadow-cyan-950/15"
            : "bg-white/5 border border-[var(--border-light)] text-[var(--text-secondary)] rounded-tl-md shadow-md",
        ].join(" ")}
      >
        {text}
        {streaming && (
          <span className="inline-flex ml-1.5 space-x-0.5 align-middle">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        )}
      </div>

      {children}
    </div>
  );
};
