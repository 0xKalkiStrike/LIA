"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

export const ProductivityHub: React.FC = () => {
  const {
    notes,
    tasks,
    events,
    reminders,
    createNote,
    updateNote,
    deleteNote,
    createTask,
    updateTask,
    deleteTask,
    createEvent,
    deleteEvent,
    createReminder,
    deleteReminder,
    fetchNotes,
    fetchTasks,
    fetchEvents,
    fetchReminders,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState("notes");

  // Local state for forms
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("09:00");
  const [eventEnd, setEventEnd] = useState("10:00");

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    fetchNotes();
    fetchTasks();
    fetchEvents();
    fetchReminders();
  }, []);

  // Notes actions
  const handleSelectNote = (n: any) => {
    setSelectedNoteId(n.id);
    setNoteTitle(n.title);
    setNoteContent(n.content);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    if (selectedNoteId) {
      await updateNote(selectedNoteId, noteTitle, noteContent);
    } else {
      await createNote(noteTitle, noteContent);
    }
    // reset form
    setSelectedNoteId(null);
    setNoteTitle("");
    setNoteContent("");
  };

  const handleNewNote = () => {
    setSelectedNoteId(null);
    setNoteTitle("");
    setNoteContent("");
  };

  // Task actions
  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    await createTask(taskTitle);
    setTaskTitle("");
  };

  // Event actions
  const handleAddEvent = async () => {
    if (!eventTitle.trim() || !eventDate) return;
    const startStr = `${eventDate}T${eventStart}:00`;
    const endStr = `${eventDate}T${eventEnd}:00`;
    const startTs = new Date(startStr).getTime() / 1000;
    const endTs = new Date(endStr).getTime() / 1000;
    
    await createEvent(eventTitle, eventDesc, startTs, endTs);
    setEventTitle("");
    setEventDesc("");
  };

  // Reminder actions
  const handleAddReminder = async () => {
    if (!reminderTitle.trim() || !reminderTime) return;
    const ts = new Date(reminderTime).getTime() / 1000;
    await createReminder(reminderTitle, ts);
    setReminderTitle("");
    setReminderTime("");
  };

  return (
    <div className="w-full h-full flex flex-col p-5 bg-slate-900/90 text-white rounded-2xl glass border border-slate-700/50 shadow-2xl overflow-hidden">
      {/* Productivity Navbar */}
      <div className="flex border-b border-slate-800 pb-3 flex-shrink-0 space-x-2">
        {[
          { id: "notes", label: "Notes" },
          { id: "tasks", label: "Checklists" },
          { id: "calendar", label: "Calendar" },
          { id: "reminders", label: "Reminders" }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === tab.id
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.1)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto pt-4 min-h-0">
        
        {/* Notes Tab */}
        {activeSubTab === "notes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* List */}
            <div className="space-y-2 border-r border-slate-800/50 pr-2 overflow-y-auto max-h-[360px]">
              <div className="flex justify-between items-center pb-2">
                <span className="text-[10px] font-bold text-slate-400">SAVED NOTES</span>
                <button
                  className="text-[10px] font-bold text-cyan-400 hover:underline"
                  onClick={handleNewNote}
                >
                  + Add New
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No notes found.</div>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      selectedNoteId === n.id
                        ? "bg-cyan-950/20 border-cyan-500 text-cyan-400"
                        : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70 text-slate-200"
                    }`}
                    onClick={() => handleSelectNote(n)}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-xs truncate max-w-[120px]">{n.title}</h4>
                      <button
                        className="text-[10px] text-slate-500 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(n.id);
                          if (selectedNoteId === n.id) handleNewNote();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">{n.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Editing Pad */}
            <div className="space-y-3 flex flex-col justify-between h-full max-h-[360px] min-h-[220px]">
              <div className="space-y-2 flex-1 flex flex-col">
                <input
                  type="text"
                  placeholder="Note Title"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <textarea
                  placeholder="Write content (Markdown supported)..."
                  className="w-full flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none min-h-[140px]"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1.5 text-xs rounded-lg transition-all"
                onClick={handleSaveNote}
              >
                {selectedNoteId ? "Update Note" : "Save Note"}
              </button>
            </div>
          </div>
        )}

        {/* Checklists Tab */}
        {activeSubTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Add a new checklist task..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
              <button
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 rounded-lg"
                onClick={handleAddTask}
              >
                Add Task
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-400">ACTIVE TASKS ({tasks.length})</span>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">All tasks completed!</div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/40 hover:bg-slate-800/60 transition-all text-xs"
                  >
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.status === "completed"}
                        onChange={() =>
                          updateTask(
                            t.id,
                            t.title,
                            t.status === "completed" ? "pending" : "completed"
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 accent-cyan-500 w-4 h-4"
                      />
                      <span className={t.status === "completed" ? "line-through text-slate-500" : "text-slate-200"}>
                        {t.title}
                      </span>
                    </label>
                    <button
                      className="text-slate-500 hover:text-red-400 text-[10px] font-bold transition-all"
                      onClick={() => deleteTask(t.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeSubTab === "calendar" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* List of Events */}
            <div className="space-y-2 border-r border-slate-800/50 pr-2 overflow-y-auto max-h-[360px]">
              <span className="text-[10px] font-bold text-slate-400">SCHEDULED EVENTS</span>
              {events.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No events scheduled.</div>
              ) : (
                events.map((ev) => {
                  const dateStr = new Date(ev.start_time * 1000).toLocaleString();
                  return (
                    <div
                      key={ev.id}
                      className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-left relative"
                    >
                      <button
                        className="absolute right-2 top-2 text-[10px] text-slate-500 hover:text-red-400"
                        onClick={() => deleteEvent(ev.id)}
                      >
                        Cancel
                      </button>
                      <h4 className="font-semibold text-xs text-slate-200">{ev.title}</h4>
                      <p className="text-[10px] text-cyan-400 mt-1">{dateStr}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{ev.description}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Booking Pad */}
            <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/40 space-y-3 max-h-[360px] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-300">BOOK NEW EVENT</span>
              <input
                type="text"
                placeholder="Event Title"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
              />
              <input
                type="text"
                placeholder="Description"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
              />
              <input
                type="date"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                />
                <input
                  type="time"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1.5 text-xs rounded-lg transition-all"
                onClick={handleAddEvent}
              >
                Schedule Event
              </button>
            </div>
          </div>
        )}

        {/* Reminders Tab */}
        {activeSubTab === "reminders" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* List */}
            <div className="space-y-2 border-r border-slate-800/50 pr-2 overflow-y-auto max-h-[360px]">
              <span className="text-[10px] font-bold text-slate-400">ACTIVE REMINDERS</span>
              {reminders.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No active reminders.</div>
              ) : (
                reminders.map((r) => {
                  const triggerStr = new Date(r.trigger_at * 1000).toLocaleString();
                  return (
                    <div
                      key={r.id}
                      className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-left relative"
                    >
                      <button
                        className="absolute right-2 top-2 text-[10px] text-slate-500 hover:text-red-400"
                        onClick={() => deleteReminder(r.id)}
                      >
                        Remove
                      </button>
                      <h4 className="font-semibold text-xs text-slate-200">{r.title}</h4>
                      <p className="text-[10px] text-cyan-400 mt-1">Alarm: {triggerStr}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Set Reminder */}
            <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/40 space-y-3 h-fit">
              <span className="text-[10px] font-bold text-slate-300">CREATE REMINDER ALARM</span>
              <input
                type="text"
                placeholder="Reminder Title"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
              />
              <input
                type="datetime-local"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
              <button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1.5 text-xs rounded-lg transition-all"
                onClick={handleAddReminder}
              >
                Set Reminder
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};
