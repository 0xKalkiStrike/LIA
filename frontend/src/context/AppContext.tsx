"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface Profile {
  username: string;
  display_name: string;
  role: string;
  char_gender: string;
  char_skin: string;
  char_hair_style: string;
  char_hair_color: string;
  char_eyes: string;
  char_outfit: string;
  char_style: string;
  char_name: string;
  char_face_shape: string;
  char_nose_shape: string;
  char_lip_shape: string;
  char_makeup: string;
  char_freckles: number;
  char_height: number;
  char_proportions: string;
  char_posture: string;
  char_accessories: string; // JSON array string
  char_clothing_style: string;
  avatar_type: string;
  vrm_path: string;
  voice_persona: string;
  voice_accent: string;
  language_mode: string;
  speech_rate: number;
  pitch: number;
  volume_level: number;
  greeting_style: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  emotion?: string;
  task?: any;
  taskResult?: any;
  searchQuery?: string;
  searchResults?: any[];
  isStreaming?: boolean;
  // Workspace action data
  webApp?: { app_id: string; project_name: string; preview_url: string; download_url: string };
  presentation?: { presentation_id: string; topic: string; total_slides: number; download_url: string };
}

export interface CollabTurn {
  agent: string;
  title: string;
  emoji: string;
  content: string;
}

export interface Task {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  due_at: number | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string;
  updated_at: number;
  created_at: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_time: number;
  end_time: number;
}

export interface Reminder {
  id: string;
  title: string;
  trigger_at: number;
  status: "pending" | "triggered" | "dismissed";
}

interface AppContextType {
  token: string | null;
  profile: Profile | null;
  hasUsers: boolean;
  voices: any;
  accents: any;
  langModes: any[];
  chatHistory: ChatMessage[];
  collabTurns: CollabTurn[];
  isCollabActive: boolean;
  isSpeaking: boolean;
  spokenText: string;
  wsConnected: boolean;
  activeTab: string;
  tasks: Task[];
  notes: Note[];
  events: CalendarEvent[];
  reminders: Reminder[];
  systemStats: any;
  processes: any[];
  currentPath: string;
  files: any[];
  activeTaskToApprove: any;
  // Workspace state
  activeProjectId: string | null;
  activePresentationId: string | null;
  openCodeWorkspace: (projectId: string) => void;
  openPresentationWorkspace: (presId: string) => void;
  closeWorkspace: () => void;
  
  signup: (username: string, display_name: string, secret_word: string, profileData: Partial<Profile>) => Promise<void>;
  login: (username: string, secret_word: string) => Promise<void>;
  logout: () => void;
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
  sendChatMessage: (message: string, collaborate?: boolean) => void;
  approveTask: (approved: boolean) => Promise<void>;
  
  // CRUD
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string, tags?: string) => Promise<void>;
  updateNote: (id: string, title: string, content: string, tags?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  
  fetchTasks: () => Promise<void>;
  createTask: (title: string, due_at?: number) => Promise<void>;
  updateTask: (id: string, title: string, status: "pending" | "in_progress" | "completed", due_at?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  fetchEvents: () => Promise<void>;
  createEvent: (title: string, description: string, start_time: number, end_time: number) => Promise<void>;
  updateEvent: (id: string, title: string, description: string, start_time: number, end_time: number) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  
  fetchReminders: () => Promise<void>;
  createReminder: (title: string, trigger_at: number) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  
  clearBrainMemory: () => Promise<void>;
  exportBrainMemory: () => void;
  uploadCustomVoice: (file: File) => Promise<string>;
  uploadCustomVrm: (file: File) => Promise<string>;
  deleteCustomVrm: () => Promise<void>;
  saveVoiceSettings: (voice_id: string, accent: string, pitch: number, speed: number, style: string, emotional_speech: boolean) => Promise<void>;
  fetchVoiceSettings: () => Promise<any>;
  previewVoice: (opts: { text?: string; voiceId?: string; accent?: string; pitch?: number; speed?: number }) => void;
  
  setToken: (t: string | null) => void;
  setActiveTab: (tab: string) => void;
  setCurrentPath: (path: string) => void;
  fetchFiles: (path?: string) => Promise<void>;
  executeCommand: (command: string) => Promise<void>;
  runTelemetryTrigger: (event: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Pick the most fitting installed browser voice for an accent + persona.
// Honours the accent locale first (so British/Indian/etc. actually change),
// then prefers the persona's named voice (male/female character) within it.
function pickBrowserVoice(
  list: SpeechSynthesisVoice[],
  accentCfg: any,
  personaCfg: any
): SpeechSynthesisVoice | null {
  if (!list || !list.length) return null;
  const lang = (accentCfg?.lang || "en-US").toLowerCase();
  const inLang = list.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2))
  );
  const exact = inLang.filter((v) => v.lang.toLowerCase() === lang);
  const pool = exact.length ? exact : inLang.length ? inLang : list;

  const tryHints = (hints?: string[]) => {
    for (const h of hints || []) {
      const v = pool.find((v) => v.name.toLowerCase().includes(h.toLowerCase()));
      if (v) return v;
    }
    return null;
  };

  return (
    tryHints(personaCfg?.web_voice_hint) ||
    tryHints(accentCfg?.web_voice_hint) ||
    pool[0] ||
    null
  );
}

const API_BASE = "";
const getWsBase = () => {
  if (typeof window === "undefined") return "ws://localhost:8001";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const port = isLocal ? "8001" : window.location.port;
  const host = port ? `${window.location.hostname}:${port}` : window.location.host;
  return `${proto}//${host}`;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasUsers, setHasUsers] = useState(false);
  const [voices, setVoices] = useState<any>({});
  const [accents, setAccents] = useState<any>({});
  const [langModes, setLangModes] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [collabTurns, setCollabTurns] = useState<CollabTurn[]>([]);
  const [isCollabActive, setIsCollabActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [systemStats, setSystemStats] = useState<any>({});
  const [processes, setProcesses] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState("C:/hacker/LIA");
  const [files, setFiles] = useState<any[]>([]);
  const [activeTaskToApprove, setActiveTaskToApprove] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activePresentationId, setActivePresentationId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamIdRef = useRef<string | null>(null);

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) {
      localStorage.setItem("lia_token", t);
    } else {
      localStorage.removeItem("lia_token");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("lia_token");
    if (saved) setTokenState(saved);
    checkState();
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchNotes();
      fetchTasks();
      fetchEvents();
      fetchReminders();
      fetchFiles(currentPath);
      fetchSystemStats();
      const t = setInterval(fetchSystemStats, 4000);
      connectWebSocket();
      return () => {
        clearInterval(t);
        if (wsRef.current) wsRef.current.close();
      };
    } else {
      setProfile(null);
      if (wsRef.current) wsRef.current.close();
    }
  }, [token]);

  const checkState = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/state`);
      const d = await res.json();
      setHasUsers(d.has_users);
      setVoices(d.voices || {});
      setAccents(d.accents || {});
      setLangModes(d.language_modes || []);
    } catch (e) {
      console.warn("Failed to check LIA state: ", e);
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
      }
    } catch (e) {
      console.warn("Failed to fetch profile: ", e);
    }
  };

  const fetchSystemStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/device`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setSystemStats(d);
      }
      const pRes = await fetch(`${API_BASE}/api/device/processes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (pRes.ok) {
        const pd = await pRes.json();
        setProcesses(pd.processes || []);
      }
    } catch (e) {
      console.warn("Failed to fetch device stats: ", e);
    }
  };

  const fetchFiles = async (path?: string) => {
    if (!token) return;
    const targetPath = path || currentPath;
    try {
      const res = await fetch(`${API_BASE}/api/desktop/files?path=${encodeURIComponent(targetPath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setFiles(d.files || []);
        if (path) setCurrentPath(path);
      }
    } catch (e) {
      console.warn("Failed to fetch files: ", e);
    }
  };

  const executeCommand = async (command: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/desktop/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ task_type: "execute_command", target: command })
      });
      if (res.ok) {
        const d = await res.json();
        alert(d.message || "Command executed successfully.");
      }
    } catch (e) {
      alert("Command execution failed.");
    }
  };

  const connectWebSocket = () => {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();

    const wsBase = getWsBase();
    const ws = new WebSocket(`${wsBase}/api/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log("LIA WebSockets Connected");
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log("LIA WebSockets Disconnected");
    };

    ws.onmessage = (event) => {
      const data = event.data;
      try {
        const msg = JSON.parse(data);
        
        // Handle streaming text
        if (msg.type === "text") {
          updateStreamMessage(msg.content);
        }
        
        // Handle collaboration debate starts
        else if (msg.type === "collab_start") {
          setIsCollabActive(true);
          setCollabTurns([]);
        }
        
        // Handle individual agent debate turn
        else if (msg.type === "collab_turn") {
          setCollabTurns((prev) => [...prev, {
            agent: msg.agent,
            title: msg.title,
            emoji: msg.emoji,
            content: msg.content
          }]);
        }
        
        // Handle streaming complete / done
        else if (msg.type === "done") {
          setIsCollabActive(false);
          finalizeStreamMessage(msg);
          if (msg.task) {
            setActiveTaskToApprove(msg.task);
          }
        }
      } catch (e) {
        // Fallback for raw text lines (usually SSE text chunks)
        updateStreamMessage(data);
      }
    };
  };

  const updateStreamMessage = (content: string) => {
    setChatHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.isStreaming) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + content }
        ];
      } else {
        return [
          ...prev,
          { id: Math.random().toString(), sender: "assistant", text: content, isStreaming: true }
        ];
      }
    });
  };

  const finalizeStreamMessage = (msg: any) => {
    setChatHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.isStreaming) {
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            text: msg.reply || last.text,
            isStreaming: false,
            emotion: msg.emotion,
            task: msg.task,
            taskResult: msg.task_result,
            searchQuery: msg.search_query,
            searchResults: msg.search_results,
            webApp: msg.is_web_app ? {
              app_id: msg.app_id,
              project_name: msg.project_name || "Web App",
              preview_url: msg.preview_url,
              download_url: msg.download_url,
            } : undefined,
            presentation: msg.presentation_id ? {
              presentation_id: msg.presentation_id,
              topic: msg.topic || "Presentation",
              total_slides: msg.total_slides || 5,
              download_url: msg.download_url,
            } : undefined,
          }
        ];
      }
      return prev;
    });

    // Auto-launch workspace if app or presentation was generated
    if (msg.is_web_app && msg.app_id) {
      openCodeWorkspace(msg.app_id);
    } else if (msg.presentation_id) {
      openPresentationWorkspace(msg.presentation_id);
    }

    // Speak response out loud
    if (msg.reply && profile) {
      speakText(msg.reply, msg.emotion);
    }
  };

  // Core speech engine. Uses the browser Web Speech API (realistic OS neural
  // voices, offline, accent-aware) as the primary path, and falls back to the
  // server-side Piper TTS (with the auth token as a query param, since an
  // <audio> GET cannot send an Authorization header).
  // Strip markdown formatting for TTS
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1") // **bold** → bold
      .replace(/__(.*?)__/g, "$1") // __bold__ → bold
      .replace(/\*(.*?)\*/g, "$1") // *italic* → italic
      .replace(/_(.*?)_/g, "$1") // _italic_ → italic
      .replace(/`(.*?)`/g, "$1") // `code` → code
      .replace(/```[\s\S]*?```/g, "") // ``` code blocks ``` → (remove)
      .replace(/~~(.*?)~~/g, "$1") // ~~strikethrough~~ → strikethrough
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // [link](url) → link
      .replace(/#+\s/g, "") // # headings → (remove #)
      .replace(/\n{2,}/g, "\n") // multiple newlines → single newline
      .trim();
  };

  const synthSpeak = (opts: {
    text: string;
    personaId?: string;
    accentId?: string;
    pitch?: number;
    rate?: number;
  }) => {
    const text = stripMarkdown((opts.text || "")).trim();
    if (!text) return;
    const personaId = opts.personaId || "friday";
    const accentId = opts.accentId || "us";
    const pitch = opts.pitch ?? 1.0;
    const rate = opts.rate ?? 1.0;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const synth = window.speechSynthesis;
        const accentCfg = (accents || {})[accentId] || {};
        const personaCfg = (voices || {})[personaId] || {};
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = accentCfg.lang || "en-US";
        // Web Speech ranges: pitch 0–2, rate 0.1–10. Clamp our UI values.
        utter.pitch = Math.min(2, Math.max(0, pitch));
        utter.rate = Math.min(2, Math.max(0.5, rate));

        // Track speaking state for lip sync
        utter.onstart = () => {
          setIsSpeaking(true);
          setSpokenText(text);
        };
        utter.onend = () => {
          setIsSpeaking(false);
          setSpokenText("");
        };
        utter.onerror = () => {
          setIsSpeaking(false);
          setSpokenText("");
        };

        const apply = () => {
          const chosen = pickBrowserVoice(synth.getVoices(), accentCfg, personaCfg);
          if (chosen) utter.voice = chosen;
          synth.cancel();
          synth.speak(utter);
        };
        // Voices can load asynchronously on first use.
        if (synth.getVoices().length === 0) {
          synth.onvoiceschanged = () => {
            synth.onvoiceschanged = null;
            apply();
          };
          // Safety: some browsers never fire the event — speak anyway shortly.
          setTimeout(apply, 250);
        } else {
          apply();
        }
        return;
      } catch (e) {
        // fall through to server TTS
      }
    }

    // Fallback: server Piper TTS (token required as query param).
    if (!token) return;
    const url = `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&voice=${personaId}&accent=${accentId}&pitch=${pitch}&speed=${rate}&token=${token}`;
    const audio = new Audio(url);
    audio.play().catch((e) => console.log("Audio speech prevented: ", e));
  };

  const speakText = (text: string, _emotion?: string) => {
    synthSpeak({
      text,
      personaId: profile?.voice_persona || "friday",
      accentId: profile?.voice_accent || "us",
      pitch: profile?.pitch || 1.0,
      rate: profile?.speech_rate || 1.0,
    });
  };

  const previewVoice = (opts: {
    text?: string;
    voiceId?: string;
    accent?: string;
    pitch?: number;
    speed?: number;
  }) => {
    synthSpeak({
      text: opts.text || "Hello Commander. Voice systems online and ready to assist you.",
      personaId: opts.voiceId || profile?.voice_persona || "friday",
      accentId: opts.accent || profile?.voice_accent || "us",
      pitch: opts.pitch ?? profile?.pitch ?? 1.0,
      rate: opts.speed ?? profile?.speech_rate ?? 1.0,
    });
  };

  const sendChatMessage = (message: string, collaborate = false) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to HTTP
      setChatHistory((prev) => [...prev, { id: Math.random().toString(), sender: "user", text: message }]);
      apiCall("/api/chat", { method: "POST", body: JSON.stringify({ message }) })
        .then((res) => {
          setChatHistory((prev) => [...prev, {
            id: Math.random().toString(),
            sender: "assistant",
            text: res.reply,
            emotion: res.emotion,
            task: res.task,
            taskResult: res.task_result,
            searchQuery: res.search_query,
            searchResults: res.search_results,
            webApp: res.is_web_app ? {
              app_id: res.app_id,
              project_name: res.project_name || "Web App",
              preview_url: res.preview_url,
              download_url: res.download_url,
            } : undefined,
            presentation: res.presentation_id ? {
              presentation_id: res.presentation_id,
              topic: res.topic || "Presentation",
              total_slides: res.total_slides || 5,
              download_url: res.download_url,
            } : undefined,
          }]);
          if (res.is_web_app && res.app_id) {
            openCodeWorkspace(res.app_id);
          } else if (res.presentation_id) {
            openPresentationWorkspace(res.presentation_id);
          }
          if (res.reply) speakText(res.reply, res.emotion);
        });
      return;
    }
    
    // Add user message
    setChatHistory((prev) => [...prev, { id: Math.random().toString(), sender: "user", text: message }]);
    wsRef.current.send(JSON.stringify({ type: "chat", message, stream: true, collaborate }));
  };

  const approveTask = async (approved: boolean) => {
    if (!activeTaskToApprove || !token) return;
    try {
      const res = await fetch(`${API_BASE}/api/desktop/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          task_type: activeTaskToApprove.type === "launch_app" ? "launch_app" : "execute_command",
          target: activeTaskToApprove.app || activeTaskToApprove.command
        })
      });
      if (res.ok) {
        const d = await res.json();
        setChatHistory((prev) => [...prev, {
          id: Math.random().toString(),
          sender: "system",
          text: `Task approved and completed: ${d.message || "success"}`
        }]);
      }
    } catch (e) {
      console.warn("Task execution failed: ", e);
    }
    setActiveTaskToApprove(null);
  };

  const signup = async (username: string, display_name: string, secret_word: string, profileData: Partial<Profile>) => {
    const res = await fetch(`${API_BASE}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, display_name, secret_word, profile: profileData })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Signup failed");
    setToken(d.token);
    setProfile(d.profile);
    checkState();
  };

  const login = async (username: string, secret_word: string) => {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, secret_word })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Authentication failed");
    setToken(d.token);
    setProfile(d.profile);
  };

  const logout = () => {
    setToken(null);
    setProfile(null);
    setChatHistory([]);
  };

  const updateProfile = async (changes: Partial<Profile>) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(changes)
    });
    if (res.ok) {
      const d = await res.json();
      setProfile(d);
    }
  };

  const runTelemetryTrigger = async (event: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/vision/telemetry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ event })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.reply) {
          setChatHistory((prev) => [...prev, {
            id: Math.random().toString(),
            sender: "assistant",
            text: d.reply,
            emotion: "friendly"
          }]);
          speakText(d.reply, "friendly");
        }
      }
    } catch (e) {
      console.warn("Telemetry trigger error: ", e);
    }
  };

  // Helper
  const apiCall = async (url: string, opts: any = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${url}`, { ...opts, headers });
    return await res.json();
  };

  // CRUD Functions
  const fetchNotes = async () => {
    const d = await apiCall("/api/notes");
    setNotes(d || []);
  };
  const createNote = async (title: string, content: string, tags = "[]") => {
    await apiCall("/api/notes", { method: "POST", body: JSON.stringify({ title, content, tags }) });
    fetchNotes();
  };
  const updateNote = async (id: string, title: string, content: string, tags = "[]") => {
    await apiCall(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify({ title, content, tags }) });
    fetchNotes();
  };
  const deleteNote = async (id: string) => {
    await apiCall(`/api/notes/${id}`, { method: "DELETE" });
    fetchNotes();
  };

  const fetchTasks = async () => {
    const d = await apiCall("/api/tasks");
    setTasks(d || []);
  };
  const createTask = async (title: string, due_at: number | null = null) => {
    await apiCall("/api/tasks", { method: "POST", body: JSON.stringify({ title, due_at }) });
    fetchTasks();
  };
  const updateTask = async (id: string, title: string, status: "pending" | "in_progress" | "completed", due_at: number | null = null) => {
    await apiCall(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify({ title, status, due_at }) });
    fetchTasks();
  };
  const deleteTask = async (id: string) => {
    await apiCall(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const fetchEvents = async () => {
    const d = await apiCall("/api/calendar");
    setEvents(d || []);
  };
  const createEvent = async (title: string, description: string, start_time: number, end_time: number) => {
    await apiCall("/api/calendar", { method: "POST", body: JSON.stringify({ title, description, start_time, end_time }) });
    fetchEvents();
  };
  const updateEvent = async (id: string, title: string, description: string, start_time: number, end_time: number) => {
    await apiCall(`/api/calendar/${id}`, { method: "PUT", body: JSON.stringify({ title, description, start_time, end_time }) });
    fetchEvents();
  };
  const deleteEvent = async (id: string) => {
    await apiCall(`/api/calendar/${id}`, { method: "DELETE" });
    fetchEvents();
  };

  const fetchReminders = async () => {
    const d = await apiCall("/api/reminders");
    setReminders(d || []);
  };
  const createReminder = async (title: string, trigger_at: number) => {
    await apiCall("/api/reminders", { method: "POST", body: JSON.stringify({ title, trigger_at }) });
    fetchReminders();
  };
  const deleteReminder = async (id: string) => {
    await apiCall(`/api/reminders/${id}`, { method: "DELETE" });
    fetchReminders();
  };

  const clearBrainMemory = async () => {
    await apiCall("/api/memories/clear", { method: "DELETE" });
    setChatHistory([]);
  };

  const exportBrainMemory = () => {
    window.open(`${API_BASE}/api/memories/export?authorization=Bearer ${token}`);
  };

  const uploadCustomVoice = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("legal_authorized", "true");
    const res = await fetch(`${API_BASE}/api/voice/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Voice upload failed");
    return d.voice_url;
  };

  const uploadCustomVrm = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/avatar/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "VRM upload failed");
    await fetchProfile();
    return d.vrm_url;
  };

  const deleteCustomVrm = async () => {
    const res = await fetch(`${API_BASE}/api/avatar/custom`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || "Failed to remove custom VRM");
    await fetchProfile();
  };

  const saveVoiceSettings = async (voice_id: string, accent: string, pitch: number, speed: number, style: string, emotional_speech: boolean) => {
    await apiCall("/api/voice/settings", {
      method: "POST",
      body: JSON.stringify({ voice_id, accent, pitch, speed, style, emotional_speech, legal_authorized: true })
    });
  };

  const fetchVoiceSettings = async () => {
    return await apiCall("/api/voice/settings");
  };

  const openCodeWorkspace = (projectId: string) => {
    setActiveProjectId(projectId);
    setActivePresentationId(null);
    setActiveTab("code");
  };

  const openPresentationWorkspace = (presId: string) => {
    setActivePresentationId(presId);
    setActiveProjectId(null);
    setActiveTab("presentation");
  };

  const closeWorkspace = () => {
    setActiveProjectId(null);
    setActivePresentationId(null);
    setActiveTab("chat");
  };

  return (
    <AppContext.Provider value={{
      token, profile, hasUsers, voices, accents, langModes, chatHistory, collabTurns, isCollabActive, isSpeaking, spokenText, wsConnected, activeTab,
      tasks, notes, events, reminders, systemStats, processes, currentPath, files, activeTaskToApprove,
      activeProjectId, activePresentationId, openCodeWorkspace, openPresentationWorkspace, closeWorkspace,
      signup, login, logout, updateProfile, sendChatMessage, approveTask,
      fetchNotes, createNote, updateNote, deleteNote,
      fetchTasks, createTask, updateTask, deleteTask,
      fetchEvents, createEvent, updateEvent, deleteEvent,
      fetchReminders, createReminder, deleteReminder,
      clearBrainMemory, exportBrainMemory, uploadCustomVoice, uploadCustomVrm, deleteCustomVrm, saveVoiceSettings, fetchVoiceSettings, previewVoice,
      setToken, setActiveTab, setCurrentPath, fetchFiles, executeCommand, runTelemetryTrigger
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};
