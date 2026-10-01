"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };
  let token = store.get("lia_token");
  let signup = false, busy = false, abort = null;
  const SUGGESTIONS = [
    "What's the latest news in AI?",
    "Check my system's CPU, memory and disk usage",
    "Write a Python script that renames photos by date and save it to the workspace",
    "What is 18% of 2,450 plus 1,299 × 3?",
    "Remind me to drink water in 20 minutes",
    "Summarize https://en.wikipedia.org/wiki/Ollama",
  ];

  // ---------- helpers
  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(opts.headers || {}) } });
    if (r.status === 401) { logout(); throw new Error("Session expired"); }
    return r;
  }
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Small, XSS-safe markdown renderer (escape first, then format).
  function md(src) {
    const blocks = [];
    let t = esc(src).replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (_, lang, code) => {
      blocks.push(`<pre><button class="copy" type="button">Copy</button><code>${code.replace(/\n$/, "")}</code></pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });
    const inline = (s) => s
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    const out = []; let list = null, para = [];
    const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join("<br>")) + "</p>"); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`); list = null; } };
    for (const line of t.split("\n")) {
      let m;
      if (/^\u0000\d+\u0000$/.test(line.trim())) { flushP(); flushL(); out.push(line.trim()); }
      else if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); out.push(`<h${Math.min(m[1].length + 2, 4)}>${inline(m[2])}</h${Math.min(m[1].length + 2, 4)}>`); }
      else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); }
      else if (!line.trim()) { flushP(); flushL(); }
      else { flushL(); para.push(line); }
    }
    flushP(); flushL();
    return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
  }

  // ---------- auth
  function showAuth() {
    $("app").hidden = true; $("auth").hidden = false;
    $("auth-sub").textContent = signup ? "Create your local account." : "Sign in to your local assistant.";
    $("a-name-wrap").hidden = !signup;
    $("auth-btn").textContent = signup ? "Create account" : "Sign in";
    $("auth-toggle").textContent = signup ? "I already have an account" : "Create an account";
  }
  $("auth-toggle").onclick = () => { signup = !signup; $("auth-err").textContent = ""; showAuth(); };
  $("auth-form").onsubmit = async (e) => {
    e.preventDefault(); $("auth-err").textContent = "";
    const username = $("a-user").value.trim(), secret_word = $("a-pass").value;
    try {
      const r = await fetch(signup ? "/api/signup" : "/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup ? { username, secret_word, display_name: $("a-name").value.trim() || username } : { username, secret_word }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed");
      token = d.token; store.set("lia_token", token); boot(d.profile);
    } catch (err) { $("auth-err").textContent = err.message; }
  };
  function logout() { store.del("lia_token"); token = null; location.reload(); }
  $("logout").onclick = logout;

  // ---------- boot
  async function boot(profile) {
    $("auth").hidden = true; $("app").hidden = false;
    try { profile = profile || await (await api("/api/profile")).json(); } catch { return; }
    $("who").textContent = profile.display_name ? `${profile.display_name}'s LIA` : "LIA";
    const info = await (await api("/api/agent/info")).json();
    $("status-dot").classList.toggle("on", info.ollama_online);
    $("status-dot").title = info.ollama_online ? "Ollama connected" : "Ollama offline";
    const sel = $("model"); sel.innerHTML = "";
    const saved = store.get("lia_model");
    const models = info.models.length ? info.models : [info.default_model];
    models.forEach((m) => sel.add(new Option(m, m)));
    sel.value = models.includes(saved) ? saved : (models.includes(info.default_model) ? info.default_model : models[0]);
    $("model-hint").textContent = info.ollama_online ? `${models.length} local model(s) found.` : "Ollama is offline — start it with `ollama serve`.";
    $("model-badge").textContent = sel.value;
    $("autonomy").value = store.get("lia_autonomy") || info.autonomy;
    $("tool-list").innerHTML = info.tools.map((t) => `<li title="${esc(t.description)}">${esc(t.name.replace(/_/g, " "))}${t.risky ? '<span class="tag">asks</span>' : ""}</li>`).join("");
    $("chips").innerHTML = SUGGESTIONS.map((s) => `<button class="chip" type="button">${esc(s)}</button>`).join("");
    const hist = await (await api("/api/agent/history?limit=40")).json();
    if (hist.length) { $("welcome").hidden = true; hist.forEach((h) => addMsg(h.role === "user" ? "user" : "bot", h.content)); scrollDown(true); }
  }
  $("model").onchange = () => { store.set("lia_model", $("model").value); $("model-badge").textContent = $("model").value; };
  $("autonomy").onchange = () => store.set("lia_autonomy", $("autonomy").value);

  // ---------- chat UI
  const chat = $("chat");
  function scrollDown(force) {
    if (force || chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160) chat.scrollTop = chat.scrollHeight;
  }
  function addMsg(role, text) {
    const wrap = document.createElement("div"); wrap.className = "msg " + role;
    const b = document.createElement("div"); b.className = "bubble";
    if (role === "user") b.textContent = text; else b.innerHTML = md(text);
    wrap.appendChild(b); chat.appendChild(wrap); return b;
  }
  chat.addEventListener("click", (e) => {
    if (e.target.classList.contains("copy")) {
      navigator.clipboard?.writeText(e.target.nextElementSibling.textContent);
      e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1200);
    }
    if (e.target.classList.contains("chip")) send(e.target.textContent);
  });

  function toolCard(parent, ev) {
    const d = document.createElement("details"); d.className = "tool run"; d.id = "tool-" + ev.id;
    const args = JSON.stringify(ev.args, null, 2);
    d.innerHTML = `<summary><span class="st"></span><strong>${esc(ev.name.replace(/_/g, " "))}</strong>` +
      `<span class="muted small">${esc(Object.values(ev.args || {}).join(" ").slice(0, 70))}</span></summary>` +
      `<div class="label">Input</div><pre>${esc(args)}</pre><div class="out"></div>`;
    parent.appendChild(d); return d;
  }

  async function send(text) {
    text = (text ?? $("input").value).trim();
    if (!text || busy) return;
    busy = true; $("send").hidden = true; $("stop").hidden = false; $("welcome").hidden = true;
    $("input").value = ""; autosize();
    addMsg("user", text);
    const bubble = addMsg("bot", ""); bubble.classList.add("cursor");
    let segment = null, segText = "", full = "";
    const startSegment = () => { segment = document.createElement("div"); segText = ""; bubble.appendChild(segment); };
    abort = new AbortController();
    try {
      const r = await api("/api/agent/chat", { method: "POST", signal: abort.signal, body: JSON.stringify({ message: text, model: $("model").value, autonomy: $("autonomy").value }) });
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "text") { if (!segment) startSegment(); segText += ev.content; full += ev.content; segment.innerHTML = md(segText); }
          else if (ev.type === "tool_call") { segment = null; toolCard(bubble, ev); }
          else if (ev.type === "confirm") {
            const card = $("tool-" + ev.id); card.open = true;
            const bar = document.createElement("div"); bar.className = "approve";
            bar.innerHTML = `<span>LIA wants to run <b>${esc(ev.name.replace(/_/g, " "))}</b>. Allow?</span><button class="btn sm primary" data-a="1" type="button">Allow</button><button class="btn sm" data-a="0" type="button">Deny</button>`;
            bar.onclick = async (e) => { const a = e.target.dataset?.a; if (a === undefined) return; bar.remove(); await api("/api/agent/approve", { method: "POST", body: JSON.stringify({ id: ev.id, approved: a === "1" }) }); };
            card.appendChild(bar);
          } else if (ev.type === "tool_result") {
            const card = $("tool-" + ev.id); if (card) {
              card.classList.remove("run"); card.classList.add(ev.ok ? "ok" : "bad"); card.querySelector(".approve")?.remove();
              card.querySelector(".out").innerHTML = `<div class="label">Result</div><pre>${esc(ev.output || "")}</pre>`;
            }
          } else if (ev.type === "error") { if (!segment) startSegment(); segText += "\n\n⚠️ " + ev.content; segment.innerHTML = md(segText); }
          else if (ev.type === "done") { if (store.get("lia_speak") === "1" && ev.reply) speak(ev.reply); }
          scrollDown();
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") { if (!segment) startSegment(); segment.innerHTML = md("⚠️ " + err.message); }
    } finally {
      bubble.classList.remove("cursor"); busy = false; abort = null; $("send").hidden = false; $("stop").hidden = true; scrollDown(true); $("input").focus();
    }
  }
  $("composer").onsubmit = (e) => { e.preventDefault(); send(); };

  // ---------- folder upload (lets LIA read a whole project's files)
  $("add-folder").onclick = () => $("folder-input").click();
  $("folder-input").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    $("welcome").hidden = true;
    const rootName = (files[0].webkitRelativePath || files[0].name).split("/")[0] || "folder";
    const banner = document.createElement("div");
    banner.className = "folder-banner pending";
    banner.innerHTML = `<span class="f-icon">📁</span><div class="f-meta"><div class="f-name">${esc(rootName)}</div><div class="muted small">Uploading ${files.length} file(s)…</div></div>`;
    chat.appendChild(banner); scrollDown(true);
    try {
      const fd = new FormData();
      const paths = [];
      for (const f of files) { fd.append("files", f); paths.push(f.webkitRelativePath || f.name); }
      fd.append("paths", JSON.stringify(paths));
      fd.append("dest", rootName);
      const r = await fetch("/api/workspace/upload-folder", { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Upload failed");
      banner.classList.remove("pending");
      banner.querySelector(".f-meta").innerHTML = `<div class="f-name">${esc(d.folder)}</div><div class="muted small">${d.files_saved} file(s) uploaded${d.files_skipped ? `, ${d.files_skipped} skipped` : ""} — ask me anything about it</div>`;
      scrollDown(true);
    } catch (err) {
      banner.classList.remove("pending");
      banner.querySelector(".f-meta").innerHTML = `<div class="f-name">Upload failed</div><div class="muted small">${esc(err.message)}</div>`;
    }
  };
  $("stop").onclick = () => abort?.abort();
  const inp = $("input");
  const autosize = () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 180) + "px"; };
  inp.addEventListener("input", autosize);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

  // ---------- sidebar actions
  $("menu").onclick = () => $("app").classList.add("open");
  $("scrim").onclick = () => $("app").classList.remove("open");
  $("new-chat").onclick = () => { chat.querySelectorAll(".msg").forEach((m) => m.remove()); $("welcome").hidden = false; $("app").classList.remove("open"); };
  $("clear-hist").onclick = async () => { if (confirm("Delete all saved chat history?")) { await api("/api/agent/history", { method: "DELETE" }); $("new-chat").click(); } };
  function applyTheme(t) { document.documentElement.dataset.theme = t; store.set("lia_theme", t); }
  applyTheme(store.get("lia_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("theme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

  // ---------- voice
  $("speak").checked = store.get("lia_speak") === "1";
  $("speak").onchange = () => { store.set("lia_speak", $("speak").checked ? "1" : "0"); if (!$("speak").checked) speechSynthesis?.cancel(); };
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const clean = text.replace(/```[\s\S]*?```/g, " code block. ").replace(/[*_`#>\[\]()]/g, "").slice(0, 900);
    speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(clean));
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) $("mic").hidden = true;
  else {
    const rec = new SR(); rec.interimResults = true; rec.lang = navigator.language || "en-US"; let on = false;
    rec.onresult = (e) => { inp.value = [...e.results].map((r) => r[0].transcript).join(""); autosize(); if (e.results[e.results.length - 1].isFinal) { rec.stop(); send(); } };
    rec.onend = () => { on = false; $("mic").classList.remove("rec"); };
    rec.onerror = rec.onend;
    $("mic").onclick = () => { if (on) rec.stop(); else { on = true; $("mic").classList.add("rec"); try { rec.start(); } catch {} } };
  }

  // ---------- start
  if (token) boot(); else showAuth();
})();
