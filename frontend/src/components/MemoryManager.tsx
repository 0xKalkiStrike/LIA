"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

export const MemoryManager: React.FC = () => {
  const {
    chatHistory,
    clearBrainMemory,
    exportBrainMemory,
    token
  } = useApp();

  const [memories, setMemories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("fact");

  useEffect(() => {
    fetchMemories();
  }, [chatHistory]); // refresh list when chats complete and memory changes

  const fetchMemories = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8001/api/memories", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setMemories(d || []);
      }
    } catch (e) {
      console.warn("Failed to fetch memories: ", e);
    }
  };

  const handleAddMemory = async () => {
    if (!newContent.trim() || !token) return;
    try {
      const res = await fetch("http://localhost:8001/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newContent, category: newCategory })
      });
      if (res.ok) {
        setNewContent("");
        fetchMemories();
      }
    } catch (e) {
      alert("Failed to add memory.");
    }
  };

  const handleDelete = async (content: string) => {
    // Delete matches content
    if (!token) return;
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      // In LIA 2.0 we delete by clearing and refetching, or writing a delete endpoint.
      // Since memories are saved in sqlite/postgresql, let's write a simple delete request to server
      const res = await fetch(`http://localhost:8001/api/memories?content=${encodeURIComponent(content)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      // Fallback: if delete by content is not supported, alert. But we can implement simple memory clearing
      fetchMemories();
    } catch (e) {
      console.warn("Delete memory failed: ", e);
    }
  };

  const handleClearAll = async () => {
    if (confirm("⚠️ WARNING: This will permanently delete all of LIA's memories, facts, and chat logs about you. This action CANNOT be undone.\n\nDo you wish to proceed?")) {
      await clearBrainMemory();
      setMemories([]);
      alert("LIA's memory database cleared.");
    }
  };

  const filtered = memories.filter((m) => {
    const matchesSearch = m.content.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === "all" || m.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="w-full max-w-md h-full flex flex-col justify-between p-6 bg-slate-900/90 text-white rounded-2xl glass border border-slate-700/50 shadow-2xl">
      <div className="flex-1 overflow-y-auto pr-1 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Layered Memory</h2>
          <p className="text-xs text-slate-400 mt-1">Review, add, prune, or download saved personal database records.</p>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Search facts..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="fact">Facts</option>
            <option value="preference">Preferences</option>
            <option value="goal">Goals</option>
            <option value="dream">Dreams</option>
            <option value="career">Career</option>
            <option value="relationship">Relationships</option>
            <option value="milestone">Milestones</option>
          </select>
        </div>

        {/* Add Memory Form */}
        <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/40 space-y-2">
          <label className="text-[10px] font-bold text-slate-300">ADD DIRECT MEMORY</label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. I hate celery..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <select
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="goal">Goal</option>
              <option value="dream">Dream</option>
              <option value="career">Career</option>
            </select>
            <button
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 rounded-lg font-bold"
              onClick={handleAddMemory}
            >
              Add
            </button>
          </div>
        </div>

        {/* Memories list */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          <label className="text-[10px] font-bold text-slate-300 tracking-wider">SAVED LOGS ({filtered.length})</label>
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">No matching memories saved.</div>
          ) : (
            filtered.map((m, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-2.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-lg border border-slate-700/30 transition-all text-xs"
              >
                <div className="space-y-0.5 pr-2">
                  <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-cyan-950 text-cyan-400 border border-cyan-800/30">
                    {m.category}
                  </span>
                  <p className="text-slate-200 mt-1 leading-relaxed">{m.content}</p>
                </div>
                <button
                  className="text-slate-500 hover:text-red-400 font-bold transition-all text-xs flex-shrink-0"
                  onClick={() => handleDelete(m.content)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex space-x-2">
        <button
          className="flex-1 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-all"
          onClick={exportBrainMemory}
        >
          Export Brain (.json)
        </button>
        <button
          className="flex-1 bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 font-semibold py-2.5 rounded-xl text-xs transition-all"
          onClick={handleClearAll}
        >
          Delete All Data
        </button>
      </div>
    </div>
  );
};
