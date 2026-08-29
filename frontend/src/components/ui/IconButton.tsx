"use client";

import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  /** Tint applied on hover; `danger` is for destructive actions like sign-out. */
  tone?: "default" | "danger";
  /** Highlights the button as toggled on. */
  active?: boolean;
  /** Accessible label; also used as the native tooltip. */
  label: string;
}

/** Small icon-only control used in header/toolbar rows (diagnostics, settings, sign-out, etc). */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  tone = "default",
  active = false,
  label,
  className = "",
  ...rest
}) => {
  const toneClasses =
    tone === "danger"
      ? "text-[var(--text-tertiary)] hover:bg-red-950/30 hover:text-red-400"
      : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]";

  return (
    <button
      title={label}
      aria-label={label}
      className={[
        "p-2 rounded-lg transition-all [&>svg]:w-4 [&>svg]:h-4",
        toneClasses,
        active ? "bg-white/10 text-[var(--accent-cyan)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon}
    </button>
  );
};
