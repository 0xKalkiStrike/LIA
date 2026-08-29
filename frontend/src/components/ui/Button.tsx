"use client";

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `primary` is the cyan-to-violet gradient CTA, `secondary` a glass pill, `danger` red-tinted, `ghost` text-only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered before the label (e.g. a lucide-react icon element). */
  icon?: React.ReactNode;
  /** Stretch to fill the width of its container. */
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-violet)] text-[var(--bg-darker)] shadow-lg hover:shadow-[0_12px_32px_rgba(0,217,255,0.25)] hover:brightness-110",
  secondary:
    "bg-white/5 border border-[var(--border-mid)] text-[var(--text-primary)] hover:bg-white/10 hover:border-[var(--accent-cyan)]/50",
  danger:
    "bg-gradient-to-r from-red-500/90 to-rose-600/90 text-white hover:shadow-lg hover:shadow-red-950/30",
  ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[11px] rounded-lg space-x-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl space-x-2",
};

/** Core action button. Composes the DS's gradient/glass button language into one prop-driven component. */
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  className = "",
  children,
  ...rest
}) => {
  return (
    <button
      className={[
        "inline-flex items-center justify-center font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon && <span className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
};
