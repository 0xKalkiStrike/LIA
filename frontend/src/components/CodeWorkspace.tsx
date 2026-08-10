"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { LazyMonacoEditor } from "./LazyMonacoEditor";
import {
  FolderOpen,
  File,
  FilePlus,
  Save,
  Play,
  Download,
  ArrowLeft,
  X,
  Code2,
  FileCode,
  Palette,
  Braces,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface CodeWorkspaceProps {
  projectId: string;
  token: string;
  onClose: () => void;
}

interface ProjectData {
  app_id: string;
  files: Record<string, string>;
  manifest: {
    app_id: string;
    project_name: string;
    files: string[];
    created_at?: number;
  };
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  html: <Code2 className="w-3.5 h-3.5 text-orange-400" />,
  css: <Palette className="w-3.5 h-3.5 text-blue-400" />,
  js: <Braces className="w-3.5 h-3.5 text-yellow-400" />,
  ts: <Braces className="w-3.5 h-3.5 text-blue-500" />,
  json: <Braces className="w-3.5 h-3.5 text-green-400" />,
  py: <FileCode className="w-3.5 h-3.5 text-green-500" />,
  jsx: <Braces className="w-3.5 h-3.5 text-cyan-400" />,
  tsx: <Braces className="w-3.5 h-3.5 text-cyan-500" />,
};

const LANG_MAP: Record<string, string> = {
  html: "html",
  css: "css",
  js: "javascript",
  ts: "typescript",
  json: "json",
  py: "python",
  jsx: "javascript",
  tsx: "typescript",
  md: "markdown",
  txt: "plaintext",
  sh: "shell",
  sql: "sql",
};

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
  projectId,
  token,
  onClose,
}) => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [activeFile, setActiveFile] = useState<string>("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const apiBase = "";

  // Load project
  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/workspace/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ProjectData = await res.json();
        setProject(data);
        setFileContents(data.files);
        const firstFile =
          data.manifest?.files?.[0] || Object.keys(data.files)[0] || "";
        if (firstFile) {
          setActiveFile(firstFile);
          setOpenTabs([firstFile]);
        }
      }
    } catch (e) {
      console.warn("Failed to load project:", e);
    }
    setLoading(false);
  };

  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return LANG_MAP[ext] || "plaintext";
  };

  const getFileIcon = (filename: string): React.ReactNode => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return (
      FILE_ICONS[ext] || <File className="w-3.5 h-3.5 text-slate-400" />
    );
  };

  const openFile = (filename: string) => {
    setActiveFile(filename);
    if (!openTabs.includes(filename)) {
      setOpenTabs((prev) => [...prev, filename]);
    }
  };

  const closeTab = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => prev.filter((f) => f !== filename));
    if (activeFile === filename) {
      const remaining = openTabs.filter((f) => f !== filename);
      setActiveFile(remaining[remaining.length - 1] || "");
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile || value === undefined) return;
    setFileContents((prev) => ({ ...prev, [activeFile]: value }));
    setUnsavedFiles((prev) => new Set(prev).add(activeFile));
  };

  const saveFile = async (filename?: string) => {
    const fileToSave = filename || activeFile;
    if (!fileToSave || !fileContents[fileToSave]) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${apiBase}/api/workspace/project/${projectId}/file`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: fileToSave,
            content: fileContents[fileToSave],
          }),
        }
      );
      if (res.ok) {
        setUnsavedFiles((prev) => {
          const next = new Set(prev);
          next.delete(fileToSave);
          return next;
        });
        // Auto-refresh preview
        setPreviewKey((k) => k + 1);
      }
    } catch (e) {
      console.warn("Save failed:", e);
    }
    setSaving(false);
  };

  const saveAllFiles = async () => {
    for (const filename of unsavedFiles) {
      await saveFile(filename);
    }
  };

  const createFile = async () => {
    if (!newFileName.trim()) return;
    try {
      const res = await fetch(
        `${apiBase}/api/workspace/project/${projectId}/file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: newFileName.trim(),
            content: "",
          }),
        }
      );
      if (res.ok) {
        setFileContents((prev) => ({ ...prev, [newFileName.trim()]: "" }));
        openFile(newFileName.trim());
        setNewFileName("");
        setShowNewFileInput(false);
        loadProject();
      }
    } catch (e) {
      console.warn("Create file failed:", e);
    }
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      const res = await fetch(
        `${apiBase}/api/workspace/project/${projectId}/file?filename=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        closeTab(filename, { stopPropagation: () => {} } as any);
        const { [filename]: _, ...rest } = fileContents;
        setFileContents(rest);
        loadProject();
      }
    } catch (e) {
      console.warn("Delete failed:", e);
    }
  };

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFile, fileContents]);

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  const previewUrl = `/static/generated/apps/${projectId}/index.html`;
  const downloadUrl = `/static/generated/apps/${projectId}.zip`;
  const allFiles = Object.keys(fileContents).sort();

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0d1117] text-white overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="h-11 flex items-center justify-between px-3 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="w-[1px] h-5 bg-[#30363d]" />
          <div className="flex items-center space-x-1.5">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              {project?.manifest?.project_name?.replace(/_/g, " ").toUpperCase() || "CODE WORKSPACE"}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => saveFile()}
            disabled={saving || !unsavedFiles.has(activeFile)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg transition-all disabled:opacity-30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
          <button
            onClick={() => setPreviewKey((k) => k + 1)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run</span>
          </button>
          <a
            href={downloadUrl}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ZIP</span>
          </a>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ─── File Explorer ─── */}
        <div className="w-52 bg-[#0d1117] border-r border-[#30363d] flex flex-col flex-shrink-0">
          <div className="h-9 flex items-center justify-between px-3 text-[10px] font-bold text-slate-500 tracking-widest border-b border-[#30363d]/50 flex-shrink-0">
            <div className="flex items-center space-x-1.5">
              <FolderOpen className="w-3 h-3" />
              <span>EXPLORER</span>
            </div>
            <button
              onClick={() => setShowNewFileInput(true)}
              className="p-1 hover:bg-slate-700/50 rounded transition-all text-slate-400 hover:text-cyan-400"
              title="New File"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showNewFileInput && (
            <div className="px-2 py-1.5 border-b border-[#30363d]/50">
              <input
                type="text"
                placeholder="filename.ext"
                className="w-full bg-[#161b22] border border-cyan-500/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFile();
                  if (e.key === "Escape") setShowNewFileInput(false);
                }}
                autoFocus
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {allFiles.map((filename) => (
              <div
                key={filename}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer transition-all text-xs ${
                  activeFile === filename
                    ? "bg-[#1f2937] text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#161b22]"
                }`}
                onClick={() => openFile(filename)}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {getFileIcon(filename)}
                  <span className="truncate">{filename}</span>
                  {unsavedFiles.has(filename) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile(filename);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Editor + Preview Split ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="h-9 flex items-center bg-[#0d1117] border-b border-[#30363d] overflow-x-auto flex-shrink-0">
            {openTabs.map((tab) => (
              <div
                key={tab}
                onClick={() => setActiveFile(tab)}
                className={`flex items-center space-x-2 px-3 h-full cursor-pointer border-r border-[#30363d]/50 text-xs transition-all min-w-0 ${
                  activeFile === tab
                    ? "bg-[#1f2937] text-white border-t-2 border-t-cyan-400"
                    : "text-slate-500 hover:text-slate-300 border-t-2 border-t-transparent"
                }`}
              >
                {getFileIcon(tab)}
                <span className="truncate max-w-[100px]">{tab}</span>
                {unsavedFiles.has(tab) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
                <button
                  onClick={(e) => closeTab(tab, e)}
                  className="p-0.5 hover:bg-slate-600/50 rounded transition-all opacity-60 hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Editor + Preview */}
          <div className="flex-1 flex min-h-0">
            {/* Monaco Editor */}
            <div className="flex-1 min-w-0">
              {activeFile ? (
                <LazyMonacoEditor
                  height="100%"
                  language={getLanguage(activeFile)}
                  value={fileContents[activeFile] || ""}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: true,
                    },
                    acceptSuggestionOnEnter: "on",
                    tabCompletion: "on",
                    bracketPairColorization: { enabled: false },
                    guides: { bracketPairs: false, indentation: false },
                    renderLineHighlight: "none",
                    cursorBlinking: "blink",
                    cursorSmoothCaretAnimation: "off",
                    smoothScrolling: false,
                    padding: { top: 8 },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600">
                  <div className="text-center space-y-3">
                    <Code2 className="w-12 h-12 mx-auto opacity-30" />
                    <p className="text-sm">Select a file to start editing</p>
                  </div>
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div className="w-[42%] border-l border-[#30363d] flex flex-col flex-shrink-0">
              <div className="h-8 flex items-center justify-between px-3 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
                <div className="flex items-center space-x-1.5">
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider">
                    LIVE PREVIEW
                  </span>
                </div>
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="p-1 hover:bg-slate-700/50 rounded transition-all text-slate-400 hover:text-cyan-400"
                  title="Refresh Preview"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 bg-white">
                <iframe
                  ref={iframeRef}
                  key={previewKey}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Live Preview"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
