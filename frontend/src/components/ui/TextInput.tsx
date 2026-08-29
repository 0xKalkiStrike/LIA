"use client";

import React from "react";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Fires when Enter is pressed without Shift (message composers, quick forms). */
  onEnter?: () => void;
}

/** Styled single-line text field matching the chat composer and settings forms. */
export const TextInput: React.FC<TextInputProps> = ({ onEnter, className = "", onKeyDown, ...rest }) => (
  <input
    className={[
      "bg-[var(--bg-card)]/70 border border-[var(--border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)]",
      "placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-cyan)]/50 transition-all",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    onKeyDown={(e) => {
      onKeyDown?.(e);
      if (onEnter && e.key === "Enter" && !e.shiftKey) onEnter();
    }}
    {...rest}
  />
);
