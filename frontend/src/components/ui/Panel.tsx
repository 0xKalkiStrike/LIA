"use client";

import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the animated cyan/violet border-glow used around the avatar pod. */
  glow?: boolean;
  children: React.ReactNode;
}

/** Glass-morphism container: rounded, blurred, bordered surface used for cards and pods across the app. */
export const Panel: React.FC<PanelProps> = ({ glow = false, className = "", children, ...rest }) => (
  <div
    className={[
      "rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)]/60 backdrop-blur-md shadow-2xl",
      glow ? "animate-border-glow" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...rest}
  >
    {children}
  </div>
);
