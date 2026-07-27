import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIA AI - Cognitive Companion Core",
  description: "Next-generation AI Companion Core with layered memory, custom voice synthesis, 3D customizer, and collaborative agent workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
