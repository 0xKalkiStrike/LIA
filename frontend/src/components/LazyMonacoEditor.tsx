"use client";

import React, { Suspense, lazy, FC } from "react";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({
    default: mod.default,
  }))
);

interface LazyMonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  theme?: string;
  height?: string;
  onMount?: (editor: any, monaco: any) => void;
  options?: Record<string, any>;
}

export const LazyMonacoEditor: FC<LazyMonacoEditorProps> = (props) => {
  return (
    <Suspense fallback={<EditorFallback />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
};

const EditorFallback = () => (
  <div className="w-full h-full bg-gray-900 flex items-center justify-center">
    <div className="text-gray-400 text-sm">Loading editor...</div>
  </div>
);
