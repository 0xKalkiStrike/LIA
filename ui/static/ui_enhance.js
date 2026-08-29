/* ui_enhance.js — additive shell behaviour for the LIA redesign.
 * Intentionally separate from app.js: everything here only touches DOM
 * that app.js already owns via ids/classes, never app.js's internal
 * functions/state. Nothing in here is required for core chat/voice/
 * files/memory/vision/call functionality — those all still work with
 * this script absent.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isDashActive = () => !!document.getElementById('screen-dash')?.classList.contains('active');

  /* ── sidebar collapse / drawer ──────────────────────────────────── */
  const sidebarToggle = $('#btn-sidebar-toggle');
  const backdrop = $('#drawer-backdrop');

  function closeDrawers() {
    document.body.classList.remove('sidebar-open', 'context-open');
    $('#dash-right-sidebar')?.classList.remove('active');
  }

  sidebarToggle?.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  });

  backdrop?.addEventListener('click', closeDrawers);

  /* ── context (right) panel: internal tabs + desktop collapse ────── */
  $$('.ctx-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.ctx-tab').forEach(t => t.classList.remove('active'));
      $$('.context-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`.context-pane[data-ctx-pane="${tab.dataset.ctx}"]`)?.classList.add('active');
    });
  });

  $('#btn-context-collapse')?.addEventListener('click', () => {
    document.body.classList.toggle('context-collapsed');
  });

  // opening the vision panel should also surface the Vision tab within it
  $('#btn-toggle-sensors-panel')?.addEventListener('click', () => {
    document.body.classList.remove('context-collapsed');
    $('.ctx-tab[data-ctx="vision"]')?.click();
  });

  $$('[data-ces-tab]').forEach(el => {
    el.addEventListener('click', () => {
      $(`.tab[data-tab="${el.dataset.cesTab}"]`)?.click();
    });
  });

  /* ── quick actions (left sidebar) ────────────────────────────────── */
  $$('.qa-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qa = btn.dataset.qa;
      if (qa === 'new-chat') {
        const log = $('#chat-log');
        if (log) log.innerHTML = '';
        updateEmptyState();
        $('.tab[data-tab="chat"]')?.click();
        $('#chat-input')?.focus();
      } else if (qa.startsWith('tab:')) {
        $(`.tab[data-tab="${qa.slice(4)}"]`)?.click();
      }
    });
  });

  /* ── empty-state dashboard (shown when chat-log has no messages) ── */
  function updateEmptyState() {
    const log = $('#chat-log');
    const empty = $('#chat-empty-state');
    if (!log || !empty) return;
    const hasContent = log.children.length > 0;
    empty.classList.toggle('visible', !hasContent);
  }

  function setTimeGreeting() {
    const el = $('#ces-greeting');
    if (!el) return;
    const h = new Date().getHours();
    el.textContent = h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
  }
  setTimeGreeting();
  setInterval(setTimeGreeting, 10 * 60 * 1000);

  $$('.ces-card[data-ces]').forEach(card => {
    card.addEventListener('click', () => {
      const input = $('#chat-input');
      if (!input) return;
      input.value = card.dataset.ces;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  if ($('#chat-log')) {
    updateEmptyState();
    new MutationObserver(updateEmptyState).observe($('#chat-log'), { childList: true });
  }

  /* ── per-message hover actions: Copy + Speak (additive, non-invasive) ── */
  function enhanceMessage(node) {
    if (!node.classList?.contains('msg') || node.querySelector('.msg-actions')) return;
    const text = node.textContent;
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.title = 'Copy';
    copyBtn.textContent = '⧉';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '✓';
        setTimeout(() => (copyBtn.textContent = '⧉'), 1200);
      } catch { /* clipboard unavailable — silently ignore */ }
    });
    actions.appendChild(copyBtn);

    if ('speechSynthesis' in window) {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'msg-action-btn';
      speakBtn.title = 'Read aloud (browser voice)';
      speakBtn.textContent = '🔊';
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      });
      actions.appendChild(speakBtn);
    }

    node.appendChild(actions);
  }

  if ($('#chat-log')) {
    $$('.msg', $('#chat-log')).forEach(enhanceMessage);
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) enhanceMessage(n);
      }
    }).observe($('#chat-log'), { childList: true });
  }

  /* ── mobile bottom nav + "more" sheet ────────────────────────────── */
  const sheetOverlay = $('#mobile-sheet-overlay');

  function setActiveMobileTab(tabName) {
    $$('.mnav-btn[data-mtab]').forEach(b => b.classList.toggle('active', b.dataset.mtab === tabName));
  }

  $$('.mnav-btn[data-mtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      $(`.tab[data-tab="${btn.dataset.mtab}"]`)?.click();
      setActiveMobileTab(btn.dataset.mtab);
    });
  });

  $('#btn-mobile-more')?.addEventListener('click', () => sheetOverlay?.classList.add('active'));
  sheetOverlay?.addEventListener('click', (e) => { if (e.target === sheetOverlay) sheetOverlay.classList.remove('active'); });
  $$('.mobile-sheet-item[data-mtab]').forEach(item => {
    item.addEventListener('click', () => {
      $(`.tab[data-tab="${item.dataset.mtab}"]`)?.click();
      sheetOverlay?.classList.remove('active');
    });
  });
  $('#mobile-sheet-vision')?.addEventListener('click', () => { $('#btn-toggle-sensors-panel')?.click(); sheetOverlay?.classList.remove('active'); });
  $('#mobile-sheet-call')?.addEventListener('click', () => { $('#btn-live-call')?.click(); sheetOverlay?.classList.remove('active'); });
  $('#mobile-sheet-logout')?.addEventListener('click', () => { $('#btn-logout')?.click(); sheetOverlay?.classList.remove('active'); });

  // keep bottom-nav highlight in sync when a top tab is clicked directly
  $$('.dash-nav .tab').forEach(tab => {
    tab.addEventListener('click', () => setActiveMobileTab(tab.dataset.tab));
  });

  /* ── settings: two-column nav scrolls to sections ────────────────── */
  $$('.settings-nav-item[data-settings-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.settings-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.settingsJump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── command palette (Ctrl/Cmd+K) ────────────────────────────────── */
  const cmdkOverlay = $('#cmdk-overlay');
  const cmdkInput = $('#cmdk-input');
  const cmdkList = $('#cmdk-list');

  const commands = [
    { icon: '💬', label: 'New Conversation', run: () => { $('.qa-btn[data-qa="new-chat"]')?.click(); } },
    { icon: '📁', label: 'Open Files & Shell', run: () => $('.tab[data-tab="files"]')?.click() },
    { icon: '🧠', label: 'Search Memory', run: () => $('.tab[data-tab="memory"]')?.click() },
    { icon: '🗂', label: 'Open Activity Feed', run: () => $('.tab[data-tab="activity"]')?.click() },
    { icon: '🛰', label: 'Open Control Center', run: () => $('.tab[data-tab="device"]')?.click() },
    { icon: '⚙️', label: 'Open Settings', run: () => $('.tab[data-tab="settings"]')?.click() },
    { icon: '🎤', label: 'Start Voice Input', run: () => $('#btn-mic')?.click() },
    { icon: '👁', label: 'Toggle Vision Sensors', run: () => $('#btn-toggle-sensors-panel')?.click() },
    { icon: '📞', label: 'Start Live Call', run: () => $('#btn-live-call')?.click() },
    { icon: '↔', label: 'Toggle Sidebar', run: () => sidebarToggle?.click() },
  ];

  function renderCmdk(filter = '') {
    if (!cmdkList) return;
    const q = filter.trim().toLowerCase();
    const matches = commands.filter(c => c.label.toLowerCase().includes(q));
    cmdkList.innerHTML = '';
    if (!matches.length) {
      cmdkList.innerHTML = '<div class="cmdk-empty">No matching commands</div>';
      return;
    }
    matches.forEach((c, i) => {
      const item = document.createElement('div');
      item.className = 'cmdk-item' + (i === 0 ? ' active' : '');
      item.innerHTML = `<span class="cmdk-item-icon">${c.icon}</span><span>${c.label}</span>`;
      item.addEventListener('click', () => { c.run(); closeCmdk(); });
      cmdkList.appendChild(item);
    });
  }

  function openCmdk() {
    if (!cmdkOverlay || !isDashActive()) return;
    cmdkOverlay.classList.add('active');
    cmdkInput.value = '';
    renderCmdk();
    setTimeout(() => cmdkInput?.focus(), 10);
  }
  function closeCmdk() { cmdkOverlay?.classList.remove('active'); }

  $('#btn-open-cmdk')?.addEventListener('click', openCmdk);
  cmdkOverlay?.addEventListener('click', (e) => { if (e.target === cmdkOverlay) closeCmdk(); });
  cmdkInput?.addEventListener('input', () => renderCmdk(cmdkInput.value));
  cmdkInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { $('.cmdk-item.active, .cmdk-item')?.click(); }
  });

  document.addEventListener('keydown', (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cmdkOverlay?.classList.contains('active') ? closeCmdk() : openCmdk();
      return;
    }
    if (e.key === 'Escape') {
      if (cmdkOverlay?.classList.contains('active')) { closeCmdk(); return; }
      if (sheetOverlay?.classList.contains('active')) { sheetOverlay.classList.remove('active'); return; }
      if (document.body.classList.contains('sidebar-open') || document.body.classList.contains('context-open')) {
        closeDrawers();
      }
    }
  });

  /* ── keep drawer backdrop visible only when a drawer is actually open
     (i.e. only at the breakpoints where these panels behave as drawers) ── */
  function syncBackdrop() {
    const sidebarIsDrawer = window.innerWidth <= 900 && document.body.classList.contains('sidebar-open');
    const rightIsDrawer = window.innerWidth <= 1180 && $('#dash-right-sidebar')?.classList.contains('active');
    backdrop?.classList.toggle('active', !!(sidebarIsDrawer || rightIsDrawer));
  }
  new MutationObserver(syncBackdrop).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const rightSidebarEl = $('#dash-right-sidebar');
  if (rightSidebarEl) {
    new MutationObserver(syncBackdrop).observe(rightSidebarEl, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('resize', syncBackdrop);
})();
