// ---- i18n ----
const STRINGS = {
  ja: {
    statusConnected: "接続中",
    statusDisconnected: "YouTube Musicを開いてください",
    labelPosition: "タイムライン",
    labelSpeed: "再生速度",
    labelLoop: "A-Bループ",
    labelSaved: (title) => `保存済みループ — ${title ?? "UNDEFINED"}`,
    btnFetchTitle: "曲名を取得",
    hintReload: "ページをリロードしてください",
    labelAllSongs: "保存済みの曲",
    btnShowMore: (n) => `他${n}件を表示`,
    btnShowLess: "折りたたむ",
    btnBack: "« 5秒",
    btnPlay: "▶ 再生",
    btnPause: "⏸ 一時停止",
    btnFwd: "5秒 »",
    btnSetA: "現在の再生位置をセット",
    btnSetB: "現在の再生位置をセット",
    btnClear: "クリア",
    btnSave: "保存",
    btnLoad: "読込",
    btnEdit: "編集",
    btnDelete: "×",
    btnEditSave: "保存",
    btnEditCancel: "戻す",
    btnJumpSong: "開く",
    loopOn: "ループ ON",
    loopOff: "ループ OFF",
    loopALabel: "▶ A点（開始）",
    loopBLabel: "■ B点（終了）",
    loopNamePlaceholder: "ループ名（例: サビ前半）",
    emptyHint: "保存済みのループはありません",
    emptyAllSongs: "保存済みの曲はありません",
    alertSetAB: "A点とB点を先にセットしてください",
    alertSaveAB: "A点とB点をセットしてから保存してください",
    warningTitleChanged: "⚠ 曲が変わりました。表示中のループは別の曲のものです。",
    loopCount: (n) => `${n}ループ`,
    labelEditor: "データエディタ",
    btnEditorClose: "← 戻る",
    btnDeleteSong: "曲を削除",
    btnOpenEditor: "編集エディタを開く",
    emptyEditor: "保存済みデータはありません",
  },
  en: {
    statusConnected: "Connected",
    statusDisconnected: "Open YouTube Music",
    labelPosition: "Timeline",
    labelSpeed: "Speed",
    labelLoop: "A-B Loop",
    labelSaved: (title) => `Saved Loops — ${title ?? "UNDEFINED"}`,
    btnFetchTitle: "Fetch title",
    hintReload: "Please reload the page",
    labelAllSongs: "Saved Songs",
    btnShowMore: (n) => `Show ${n} more`,
    btnShowLess: "Show less",
    btnBack: "« 5s",
    btnPlay: "▶ Play",
    btnPause: "⏸ Pause",
    btnFwd: "5s »",
    btnSetA: "Set Current Time",
    btnSetB: "Set Current Time",
    btnClear: "Clear",
    btnSave: "Save",
    btnLoad: "Load",
    btnEdit: "Edit",
    btnDelete: "×",
    btnEditSave: "Save",
    btnEditCancel: "Cancel",
    btnJumpSong: "Open",
    loopOn: "Loop ON",
    loopOff: "Loop OFF",
    loopALabel: "▶ Point A (Start)",
    loopBLabel: "■ Point B (End)",
    loopNamePlaceholder: "Loop name (e.g. chorus)",
    emptyHint: "No saved loops",
    emptyAllSongs: "No saved songs",
    alertSetAB: "Please set points A and B first.",
    alertSaveAB: "Please set points A and B before saving.",
    warningTitleChanged: "⚠ Song changed. Loops shown may be for a different song.",
    loopCount: (n) => `${n} loop${n !== 1 ? "s" : ""}`,
    labelEditor: "Data Editor",
    btnEditorClose: "← Back",
    btnDeleteSong: "Delete Song",
    btnOpenEditor: "Open Data Editor",
    emptyEditor: "No saved data",
  },
};
let lang = "en";
let T = STRINGS[lang];

// ---- Loop colors ----
const LOOP_COLORS = [
  { key: "coral",  hex: "#e94560" },
  { key: "orange", hex: "#f5a623" },
  { key: "green",  hex: "#4caf50" },
  { key: "sky",    hex: "#4fc3f7" },
  { key: "purple", hex: "#ab7de8" },
];
function getLoopColor(key) {
  if (!key) return LOOP_COLORS[0].hex;
  if (key.startsWith("#")) return key;
  return LOOP_COLORS.find(c => c.key === key)?.hex ?? LOOP_COLORS[0].hex;
}

async function loadLangPref() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["lang_pref"], (result) => {
      if (result.lang_pref && STRINGS[result.lang_pref]) {
        lang = result.lang_pref;
        T = STRINGS[lang];
      }
      document.getElementById("lang-select").value = lang;
      resolve();
    });
  });
}

function saveLangPref() {
  chrome.storage.local.set({ lang_pref: lang });
}

function updateSavedLoopsLabel() {
  const el = document.querySelector("[data-i18n='labelSaved']");
  if (el) el.textContent = T.labelSaved(lastKnownTitle);
  const hint = document.getElementById("saved-loops-hint");
  if (hint) hint.classList.toggle("visible", isConnected && !lastKnownTitle);
}

function applyLanguage() {
  T = STRINGS[lang];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (T[key] && typeof T[key] === "string") el.textContent = T[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (T[key]) el.placeholder = T[key];
  });
  updateLoopDisplay();
  updateSavedLoopsLabel();
  document.getElementById("btn-play").textContent = isPlaying ? T.btnPause : T.btnPlay;
  setStatus(isConnected);
}

// ---- Constants ----
const B_PREVIEW_SECONDS = 3;

// ---- State ----
let loopA = null;
let loopB = null;
let loopEnabled = false;
let duration = 0;
let isPlaying = false;
let isConnected = false;
let pollTimer = null;
let marqueeAnimFrame = null;
let marqueePhase = "pause-start";
let marqueePhaseStart = 0;
let lastKnownUrl = null;
let lastKnownTitle = null;
let firstConnect = true;
let lastCurrentTime = 0;
let isLoopBarDragging = false;
let activeLoopId = null;
let cachedLoops = [];

// ---- Helpers ----
function formatDate(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return lang === "ja" ? "今" : "Just now";
  if (mins < 60) return lang === "ja" ? `${mins}分前` : `${mins}m ago`;
  if (hours < 24) return lang === "ja" ? `${hours}時間前` : `${hours}h ago`;
  if (days < 7) return lang === "ja" ? `${days}日前` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", { month: "short", day: "numeric" });
}

function parseTitle(pageTitle) {
  if (!pageTitle) return "—";
  const cleaned = pageTitle.replace(" - YouTube Music", "").trim();
  return (cleaned && cleaned !== "YouTube Music") ? cleaned : "—";
}

function formatTime(sec) {
  if (sec === null || isNaN(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTimeSec(sec) { return formatTime(sec); }

function formatTimeDec(sec) {
  if (sec === null || isNaN(sec) || sec < 0) return ".-";
  return `.${Math.floor((sec % 1) * 10)}`;
}

function formatTimeFull(sec) { return formatTimeSec(sec) + formatTimeDec(sec); }

function getActiveTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id ?? null);
    });
  });
}

async function sendToContent(message) {
  const tabId = await getActiveTabId();
  if (!tabId) return null;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

// ---- Storage ----
function extractVideoId(url) {
  try { return new URL(url).searchParams.get("v") || null; } catch { return null; }
}

function generateId() { return crypto.randomUUID(); }

async function getSongs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["songs"], (r) => resolve(r.songs || {}));
  });
}

async function saveSongs(songs) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ songs }, resolve);
  });
}

function findSongEntry(songs, url) {
  const vid = extractVideoId(url);
  for (const entry of Object.entries(songs)) {
    if (vid && entry[1].videoId === vid) return entry;
  }
  for (const entry of Object.entries(songs)) {
    if (entry[1].url === url) return entry;
  }
  return [null, null];
}

async function updateSong(url, title) {
  const songs = await getSongs();
  const [id, existing] = findSongEntry(songs, url);
  if (!id) return;
  songs[id] = { ...existing, title: title || existing.title, url, lastOpened: Date.now() };
  await saveSongs(songs);
  renderSongsList();
}

// ---- UI Updates ----
function setStatus(connected) {
  isConnected = connected;
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  dot.className = connected ? "connected" : "error";
  txt.textContent = connected ? T.statusConnected : T.statusDisconnected;
}

function updateLoopDisplay() {
  document.getElementById("loop-a-sec").textContent = formatTimeSec(loopA);
  document.getElementById("loop-a-dec").textContent = formatTimeDec(loopA);
  document.getElementById("loop-b-sec").textContent = formatTimeSec(loopB);
  document.getElementById("loop-b-dec").textContent = formatTimeDec(loopB);
  const label = document.getElementById("loop-active-label");
  label.textContent = loopEnabled ? T.loopOn : T.loopOff;
  label.className = loopEnabled ? "on" : "";
  updateLoopBar(lastCurrentTime);
}

function showWarning(text) {
  document.getElementById("warning-text").textContent = text;
  document.getElementById("warning-bar").classList.add("visible");
}

function hideWarning() {
  document.getElementById("warning-bar").classList.remove("visible");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---- Loop Bar ----
function updateLoopBar(currentTime) {
  if (!duration) return;
  const track = document.getElementById("loop-bar-track");
  if (!track) return;

  // Remove old dynamic ranges, keep handles and playhead
  track.querySelectorAll(".loop-bar-range").forEach(el => el.remove());

  const playhead = document.getElementById("loop-bar-playhead");
  const handleA = document.getElementById("loop-bar-handle-a");
  const handleB = document.getElementById("loop-bar-handle-b");
  const labelA = document.getElementById("loop-bar-label-a");
  const labelB = document.getElementById("loop-bar-label-b");

  const pct = (t) => (Math.max(0, Math.min(t, duration)) / duration * 100).toFixed(3) + "%";
  const pctW = (a, b) => (Math.max(0, b - a) / duration * 100).toFixed(3) + "%";

  // Render all saved loops as colored ranges
  cachedLoops.forEach(loop => {
    const isActive = loop.id === activeLoopId;
    const color = getLoopColor(loop.color);
    const range = document.createElement("div");
    range.className = "loop-bar-range";
    range.style.cssText = `left:${pct(loop.a)};width:${pctW(loop.a,loop.b)};background:${color};opacity:${isActive ? "0.7" : "0.25"};display:block;`;
    track.insertBefore(range, playhead);
  });

  // Unsaved temporary loop (no activeLoopId)
  if (loopA !== null && loopB !== null && activeLoopId === null) {
    const range = document.createElement("div");
    range.className = "loop-bar-range";
    range.style.cssText = `left:${pct(loopA)};width:${pctW(loopA,loopB)};background:${LOOP_COLORS[0].hex};opacity:0.5;display:block;`;
    track.insertBefore(range, playhead);
  }

  playhead.style.left = pct(currentTime);

  // Handle color matches active loop (or default)
  const activeLoop = cachedLoops.find(l => l.id === activeLoopId);
  const handleColor = activeLoop ? getLoopColor(activeLoop.color) : LOOP_COLORS[0].hex;

  if (loopA !== null) {
    handleA.style.left = pct(loopA);
    handleA.style.display = "block";
    handleA.style.setProperty("--handle-color", handleColor);
    labelA.style.left = pct(loopA);
    labelA.textContent = formatTimeFull(loopA);
    labelA.style.display = "block";
    labelA.style.color = handleColor;
  } else {
    handleA.style.display = "none";
    labelA.style.display = "none";
  }

  if (loopB !== null) {
    handleB.style.left = pct(loopB);
    handleB.style.display = "block";
    handleB.style.setProperty("--handle-color", handleColor);
    labelB.style.left = pct(loopB);
    labelB.textContent = formatTimeFull(loopB);
    labelB.style.display = "block";
    labelB.style.color = handleColor;
  } else {
    handleB.style.display = "none";
    labelB.style.display = "none";
  }
}

function initLoopBar() {
  const track = document.getElementById("loop-bar-track");
  const handleA = document.getElementById("loop-bar-handle-a");
  const handleB = document.getElementById("loop-bar-handle-b");
  const playhead = document.getElementById("loop-bar-playhead");

  function timeFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * duration * 10) / 10;
  }

  function startDrag(type, e) {
    e.preventDefault();
    e.stopPropagation();
    isLoopBarDragging = true;

    function onMove(ev) {
      const t = timeFromClientX(ev.clientX);
      if (type === "a") {
        loopA = t;
        if (loopB !== null && loopB < loopA) loopB = loopA;
        updateLoopDisplay();
      } else if (type === "b") {
        loopB = loopA !== null ? Math.max(t, loopA) : t;
        updateLoopDisplay();
      } else {
        lastCurrentTime = t;
        updateLoopBar(t);
      }
    }

    async function onUp(ev) {
      isLoopBarDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const t = timeFromClientX(ev.clientX);
      if (type === "a") {
        if (loopEnabled && loopA !== null && loopB !== null)
          await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
        await sendToContent({ type: "SET_CURRENT_TIME", time: loopA });
      } else if (type === "b") {
        loopB = loopA !== null ? Math.max(t, loopA) : t;
        updateLoopDisplay();
        if (loopEnabled && loopA !== null && loopB !== null)
          await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
        const seekTo = loopA !== null
          ? Math.max(loopB - B_PREVIEW_SECONDS, loopA)
          : Math.max(loopB - B_PREVIEW_SECONDS, 0);
        await sendToContent({ type: "SET_CURRENT_TIME", time: seekTo });
      } else {
        await sendToContent({ type: "SET_CURRENT_TIME", time: t });
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  handleA.addEventListener("mousedown", (e) => startDrag("a", e));
  handleB.addEventListener("mousedown", (e) => startDrag("b", e));
  playhead.addEventListener("mousedown", (e) => startDrag("playhead", e));

  track.addEventListener("mousedown", (e) => {
    if (handleA.contains(e.target) || handleB.contains(e.target) || e.target === playhead) return;
    startDrag("playhead", e);
  });
}

// ---- Saved loops list ----
async function renderSavedList(url) {
  const songs = await getSongs();
  const [, song] = findSongEntry(songs, url);
  cachedLoops = song?.loops || [];
  updateLoopBar(lastCurrentTime);

  const list = document.getElementById("saved-list");
  const hint = document.getElementById("empty-hint");

  [...list.children].forEach((c) => { if (c !== hint) c.remove(); });

  if (cachedLoops.length === 0) {
    hint.style.display = "";
    hint.textContent = T.emptyHint;
    return;
  }
  hint.style.display = "none";

  cachedLoops.forEach((loop, index) => {
    const color = getLoopColor(loop.color);
    const isActive = loop.id === activeLoopId;
    const item = document.createElement("div");
    item.className = "saved-item" + (isActive ? " active" : "");
    item.innerHTML = `
      <div class="saved-item-color-bar" style="background:${color}"></div>
      <div class="saved-item-info">
        <div class="saved-item-name">${escapeHtml(loop.name)}</div>
        <div class="saved-item-times">${formatTimeFull(loop.a)} → ${formatTimeFull(loop.b)}</div>
      </div>
      <button class="btn-small" data-edit="${index}">${T.btnEdit}</button>
      <button class="btn-small" data-load="${index}">${T.btnLoad}</button>
      <button class="btn-danger" data-delete="${index}">${T.btnDelete}</button>
    `;

    item.querySelector(`[data-load]`).addEventListener("click", async (e) => {
      e.stopPropagation();
      loopA = loop.a;
      loopB = loop.b;
      activeLoopId = loop.id;
      loopEnabled = true;
      document.getElementById("loop-toggle").checked = true;
      updateLoopDisplay();
      renderSavedList(url);
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
    });

    item.querySelector(`[data-delete]`).addEventListener("click", async (e) => {
      e.stopPropagation();
      const songs2 = await getSongs();
      const [id2, song2] = findSongEntry(songs2, url);
      if (id2) {
        const wasActive = song2.loops[index]?.id === activeLoopId;
        songs2[id2].loops = (song2.loops || []).filter((_, i) => i !== index);
        if (wasActive) activeLoopId = null;
        if (songs2[id2].loops.length === 0) delete songs2[id2];
        await saveSongs(songs2);
      }
      renderSavedList(url);
      renderSongsList();
    });

    item.querySelector(`[data-edit]`).addEventListener("click", (e) => {
      e.stopPropagation();
      let editA = loop.a;
      let editB = loop.b;
      let editColor = loop.color || LOOP_COLORS[0].key;

      // Activate loop for real-time editing preview
      loopA = loop.a;
      loopB = loop.b;
      loopEnabled = true;
      activeLoopId = loop.id;
      document.getElementById("loop-toggle").checked = true;
      updateLoopDisplay();
      sendToContent({ type: "SET_LOOP", start: loop.a, end: loop.b, enabled: true });

      const editDots = LOOP_COLORS.map(c =>
        `<span class="color-dot${c.key === editColor ? " selected" : ""}" data-color="${c.key}" style="background:${c.hex}"></span>`
      ).join("");

      item.innerHTML = `
        <div class="saved-item-color-bar" style="background:${getLoopColor(editColor)}"></div>
        <div style="flex:1; min-width:0;">
          <input type="text" class="edit-name-input" value="${escapeHtml(loop.name)}" maxlength="30">
          <div class="edit-ab-row">
            <div class="edit-ab-box">
              <div class="edit-ab-label">A</div>
              <div class="edit-ab-times">
                <span class="edit-ab-time edit-a-sec" tabindex="0">${formatTimeSec(editA)}</span><span class="edit-ab-time time-dec edit-a-dec" tabindex="0">${formatTimeDec(editA)}</span>
              </div>
            </div>
            <div class="edit-ab-arrow">→</div>
            <div class="edit-ab-box">
              <div class="edit-ab-label">B</div>
              <div class="edit-ab-times">
                <span class="edit-ab-time edit-b-sec" tabindex="0">${formatTimeSec(editB)}</span><span class="edit-ab-time time-dec edit-b-dec" tabindex="0">${formatTimeDec(editB)}</span>
              </div>
            </div>
          </div>
          <div class="color-picker" style="margin-top:6px; justify-content:center;">${editDots}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
          <button class="btn-small edit-save">${T.btnEditSave}</button>
          <button class="btn-danger edit-cancel">${T.btnEditCancel}</button>
        </div>
      `;

      item.querySelectorAll(".color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
          item.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
          dot.classList.add("selected");
          editColor = dot.dataset.color;
          const cb = item.querySelector(".saved-item-color-bar");
          if (cb) cb.style.background = getLoopColor(editColor);
        });
      });

      const editASecEl = item.querySelector(".edit-a-sec");
      const editADecEl = item.querySelector(".edit-a-dec");
      const editBSecEl = item.querySelector(".edit-b-sec");
      const editBDecEl = item.querySelector(".edit-b-dec");

      function addEditTimeHandlers(secEl, decEl, getVal, setVal) {
        const adjust = (delta, isDecimal) => {
          const step = isDecimal ? 0.1 : 1;
          setVal(Math.max(0, Math.round((getVal() + delta * step) * 10) / 10));
          secEl.textContent = formatTimeSec(getVal());
          decEl.textContent = formatTimeDec(getVal());
          loopA = editA; loopB = editB;
          updateLoopDisplay();
          sendToContent({ type: "SET_LOOP", start: editA, end: editB, enabled: true });
        };
        secEl.addEventListener("wheel", (e2) => { e2.preventDefault(); adjust(e2.deltaY < 0 ? 1 : -1, false); }, { passive: false });
        secEl.addEventListener("keydown", (e2) => {
          if (e2.key === "ArrowUp") { e2.preventDefault(); adjust(1, false); }
          else if (e2.key === "ArrowDown") { e2.preventDefault(); adjust(-1, false); }
        });
        decEl.addEventListener("wheel", (e2) => { e2.preventDefault(); adjust(e2.deltaY < 0 ? 1 : -1, true); }, { passive: false });
        decEl.addEventListener("keydown", (e2) => {
          if (e2.key === "ArrowUp") { e2.preventDefault(); adjust(1, true); }
          else if (e2.key === "ArrowDown") { e2.preventDefault(); adjust(-1, true); }
        });
      }

      addEditTimeHandlers(editASecEl, editADecEl, () => editA, (v) => {
        editA = v;
        if (editB < editA) { editB = editA; editBSecEl.textContent = formatTimeSec(editB); editBDecEl.textContent = formatTimeDec(editB); }
      });
      addEditTimeHandlers(editBSecEl, editBDecEl, () => editB, (v) => { editB = Math.max(v, editA); });

      item.querySelector(".edit-save").addEventListener("click", async (e2) => {
        e2.stopPropagation();
        const newName = item.querySelector(".edit-name-input").value.trim() || loop.name;
        const songs2 = await getSongs();
        const [id2, song2] = findSongEntry(songs2, url);
        if (id2) {
          const updated = [...(song2.loops || [])];
          updated[index] = { ...(updated[index] || { id: generateId() }), name: newName, a: editA, b: editB, color: editColor };
          songs2[id2].loops = updated;
          await saveSongs(songs2);
        }
        renderSavedList(url);
      });

      item.querySelector(".edit-cancel").addEventListener("click", (e2) => {
        e2.stopPropagation();
        if (activeLoopId === loop.id) {
          loopA = loop.a; loopB = loop.b;
          updateLoopDisplay();
          sendToContent({ type: "SET_LOOP", start: loop.a, end: loop.b, enabled: true });
        }
        renderSavedList(url);
      });
    });

    list.appendChild(item);
  });
}

// ---- Songs list ----
function renderSongsList() {
  const container = document.getElementById("songs-list");
  const isExpanded = container.dataset.expanded === "true";

  chrome.storage.local.get(["songs"], ({ songs = {} }) => {
    const entries = Object.entries(songs)
      .map(([id, s]) => ({ id, title: s.title, url: s.url, count: s.loops?.length || 0, lastOpened: s.lastOpened || 0 }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.lastOpened - a.lastOpened);

    container.innerHTML = "";
    if (entries.length === 0) {
      const hint = document.createElement("div");
      hint.className = "empty-hint";
      hint.textContent = T.emptyAllSongs;
      container.appendChild(hint);
      return;
    }

    const SHOW_LIMIT = 5;
    const visible = isExpanded ? entries : entries.slice(0, SHOW_LIMIT);

    visible.forEach(({ title, url, count, lastOpened }) => {
      const item = document.createElement("div");
      item.className = "song-item";
      item.innerHTML = `
        <div class="song-item-info">
          <div class="song-item-title">${escapeHtml(title)}</div>
          <div class="song-item-meta">${T.loopCount(count)} · ${formatDate(lastOpened)}</div>
        </div>
        <button class="btn-small song-jump-btn">${T.btnJumpSong}</button>
      `;
      item.querySelector(".song-jump-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        const tabId = await getActiveTabId();
        if (tabId) chrome.tabs.update(tabId, { url });
      });
      container.appendChild(item);
    });

    if (entries.length > SHOW_LIMIT) {
      const moreBtn = document.createElement("button");
      moreBtn.className = "btn-small";
      moreBtn.style.cssText = "width:100%; margin-top:4px;";
      moreBtn.textContent = isExpanded ? T.btnShowLess : T.btnShowMore(entries.length - SHOW_LIMIT);
      moreBtn.addEventListener("click", () => {
        container.dataset.expanded = isExpanded ? "false" : "true";
        renderSongsList();
      });
      container.appendChild(moreBtn);
    }
  });
}

// ---- Editor ----
function parseTimeInput(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d+):(\d{2})(?:\.(\d))?$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]) + (match[3] ? parseInt(match[3]) * 0.1 : 0);
}

function openEditor() {
  document.getElementById("editor-overlay").style.display = "block";
  renderEditorSongs();
}

function closeEditor() {
  document.getElementById("editor-overlay").style.display = "none";
}

async function renderEditorSongs() {
  const songs = await getSongs();
  const container = document.getElementById("editor-songs-list");
  container.innerHTML = "";

  const entries = Object.entries(songs).sort((a, b) => (b[1].lastOpened || 0) - (a[1].lastOpened || 0));

  if (entries.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = T.emptyEditor;
    container.appendChild(hint);
    return;
  }

  for (const [songId, song] of entries) {
    const card = document.createElement("div");
    card.className = "editor-card";

    const loops = song.loops || [];
    const loopsHtml = loops.length > 0
      ? loops.map((loop, li) => {
          const loopColorKey = loop.color || LOOP_COLORS[0].key;
          const currentColorHex = getLoopColor(loopColorKey);
          const dots = LOOP_COLORS.map(c =>
            `<span class="color-dot${c.key === loopColorKey ? " selected" : ""}" data-color="${c.key}" data-hex="${c.hex}" style="background:${c.hex}" title="${c.key}"></span>`
          ).join("");
          return `
            <div class="editor-loop-wrap" data-loop-index="${li}" data-color="${loopColorKey}">
              <div class="editor-loop-row">
                <input class="editor-loop-name" type="text" value="${escapeHtml(loop.name)}" maxlength="30" placeholder="Name">
                <div class="editor-loop-right">
                  <div class="editor-loop-ab">
                    <input class="editor-loop-a" type="text" value="${formatTimeFull(loop.a)}" title="A point">
                    <span class="editor-loop-arrow">→</span>
                    <input class="editor-loop-b" type="text" value="${formatTimeFull(loop.b)}" title="B point">
                  </div>
                  <div class="color-picker">
                    ${dots}
                    <input type="text" class="color-hex-input" value="${currentColorHex}" placeholder="#rrggbb" maxlength="7">
                  </div>
                </div>
                <button class="btn-danger editor-del-loop" data-loop="${li}">×</button>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="empty-hint" style="padding:4px 0; font-size:10px;">${T.emptyHint}</div>`;

    card.innerHTML = `
      <div class="editor-card-top">
        <div class="editor-card-fields">
          <input class="editor-title-input" type="text" value="${escapeHtml(song.title)}" placeholder="Title">
          <input class="editor-url-input" type="text" value="${escapeHtml(song.url)}" placeholder="URL">
        </div>
        <button class="editor-del-song" title="${T.btnDeleteSong}">✕</button>
      </div>
      <div class="editor-loops-list">${loopsHtml}</div>
      <div class="editor-card-footer">
        <button class="btn-small editor-save-btn">${T.btnSave}</button>
      </div>
    `;

    // Dirty tracking
    const saveBtn = card.querySelector(".editor-save-btn");
    function markDirty() {
      card.classList.add("dirty");
      saveBtn.classList.add("dirty");
    }
    card.querySelectorAll(".editor-title-input, .editor-url-input").forEach(input => {
      input.addEventListener("input", markDirty);
    });

    // Color dot clicks + hex input + dirty
    card.querySelectorAll(".editor-loop-wrap").forEach(wrap => {
      wrap.querySelectorAll(".color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
          wrap.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
          dot.classList.add("selected");
          wrap.dataset.color = dot.dataset.color;
          const hexInput = wrap.querySelector(".color-hex-input");
          if (hexInput) hexInput.value = dot.dataset.hex;
          markDirty();
        });
      });
      const hexInput = wrap.querySelector(".color-hex-input");
      if (hexInput) {
        hexInput.addEventListener("input", () => {
          const val = hexInput.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            wrap.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
            wrap.dataset.color = val;
          }
          markDirty();
        });
      }
      wrap.querySelectorAll(".editor-loop-name, .editor-loop-a, .editor-loop-b").forEach(input => {
        input.addEventListener("input", markDirty);
      });
    });

    card.querySelector(".editor-save-btn").addEventListener("click", async () => {
      const newTitle = card.querySelector(".editor-title-input").value.trim();
      const newUrl = card.querySelector(".editor-url-input").value.trim();
      const songs2 = await getSongs();
      if (!songs2[songId]) return;

      const newLoops = [];
      card.querySelectorAll(".editor-loop-wrap").forEach((wrap) => {
        const origIndex = parseInt(wrap.dataset.loopIndex);
        const name = wrap.querySelector(".editor-loop-name").value.trim();
        const a = parseTimeInput(wrap.querySelector(".editor-loop-a").value);
        const b = parseTimeInput(wrap.querySelector(".editor-loop-b").value);
        const color = wrap.dataset.color || LOOP_COLORS[0].key;
        if (a !== null && b !== null) {
          const orig = songs2[songId].loops[origIndex] || { id: generateId() };
          newLoops.push({ ...orig, name: name || orig.name || "", a, b, color });
        }
      });

      songs2[songId] = {
        ...songs2[songId],
        title: newTitle || songs2[songId].title,
        url: newUrl || songs2[songId].url,
        videoId: extractVideoId(newUrl || songs2[songId].url),
        loops: newLoops,
      };
      await saveSongs(songs2);
      renderEditorSongs();
      renderSongsList();
      if (lastKnownUrl) renderSavedList(lastKnownUrl);
    });

    card.querySelector(".editor-del-song").addEventListener("click", async () => {
      const label = `"${song.title}"`;
      if (!confirm(lang === "ja" ? `${label} を削除しますか？` : `Delete ${label}?`)) return;
      const songs2 = await getSongs();
      delete songs2[songId];
      await saveSongs(songs2);
      renderEditorSongs();
      renderSongsList();
      if (lastKnownUrl) renderSavedList(lastKnownUrl);
    });

    card.querySelectorAll(".editor-del-loop").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const li = parseInt(btn.dataset.loop);
        const songs2 = await getSongs();
        if (songs2[songId]) {
          songs2[songId].loops = (songs2[songId].loops || []).filter((_, i) => i !== li);
          await saveSongs(songs2);
          renderEditorSongs();
          renderSongsList();
          if (lastKnownUrl) renderSavedList(lastKnownUrl);
        }
      });
    });

    container.appendChild(card);
  }
}

// ---- Marquee ----
const MARQUEE_SPEED = 40;
const MARQUEE_PAUSE = 2000;
const MARQUEE_GAP = 48;

function startMarquee() {
  const wrapper = document.getElementById("song-title-wrapper");
  const track = document.getElementById("song-title-track");
  const title = document.getElementById("song-title");
  const clone = document.getElementById("song-title-clone");
  if (!wrapper || !track || !title || !clone) return;
  const titleWidth = title.offsetWidth;
  if (titleWidth <= wrapper.clientWidth) { stopMarquee(); return; }
  clone.textContent = title.textContent;
  clone.style.display = "inline-block";
  clone.style.marginLeft = MARQUEE_GAP + "px";
  if (marqueeAnimFrame) cancelAnimationFrame(marqueeAnimFrame);
  marqueePhase = "pause-start";
  marqueePhaseStart = performance.now();
  marqueeAnimFrame = requestAnimationFrame(tickMarquee);
}

function stopMarquee() {
  if (marqueeAnimFrame) { cancelAnimationFrame(marqueeAnimFrame); marqueeAnimFrame = null; }
  const track = document.getElementById("song-title-track");
  const clone = document.getElementById("song-title-clone");
  if (track) track.style.transform = "translateX(0)";
  if (clone) { clone.textContent = ""; clone.style.display = "none"; }
}

function tickMarquee(now) {
  const wrapper = document.getElementById("song-title-wrapper");
  const track = document.getElementById("song-title-track");
  const title = document.getElementById("song-title");
  if (!wrapper || !track || !title) return;
  const titleWidth = title.offsetWidth;
  if (titleWidth <= wrapper.clientWidth) { track.style.transform = "translateX(0)"; marqueeAnimFrame = null; return; }
  const totalDist = titleWidth + MARQUEE_GAP;
  const elapsed = now - marqueePhaseStart;
  if (marqueePhase === "pause-start") {
    if (elapsed >= MARQUEE_PAUSE) { marqueePhase = "scrolling"; marqueePhaseStart = now; }
  } else if (marqueePhase === "scrolling") {
    const offset = (MARQUEE_SPEED * elapsed) / 1000;
    if (offset >= totalDist) {
      track.style.transform = "translateX(0)";
      marqueePhase = "pause-start";
      marqueePhaseStart = now;
    } else {
      track.style.transform = `translateX(${-offset}px)`;
    }
  }
  marqueeAnimFrame = requestAnimationFrame(tickMarquee);
}

async function disableLoop() {
  loopA = null;
  loopB = null;
  loopEnabled = false;
  activeLoopId = null;
  document.getElementById("loop-toggle").checked = false;
  updateLoopDisplay();
  await sendToContent({ type: "SET_LOOP", start: 0, end: 0, enabled: false });
}

// ---- Polling ----
async function poll() {
  const state = await sendToContent({ type: "GET_STATE" });

  if (!state || state.error) {
    setStatus(false);
    const errSpan = document.getElementById("song-title");
    if (errSpan.textContent !== T.statusDisconnected) {
      errSpan.textContent = T.statusDisconnected;
      stopMarquee();
    }
    document.getElementById("btn-play").textContent = T.btnPlay;
    firstConnect = true;
    return;
  }

  setStatus(true);
  duration = state.duration || 0;
  lastCurrentTime = state.currentTime;

  const rawTitle = parseTitle(state.title);
  const urlChanged = state.url !== lastKnownUrl;
  const titleChangedSameUrl = !urlChanged && rawTitle !== "—" && lastKnownTitle !== null && rawTitle !== lastKnownTitle;

  if (urlChanged || firstConnect) {
    hideWarning();
    renderSavedList(state.url);
    lastKnownTitle = null;
    if (rawTitle !== "—") updateSong(state.url, rawTitle);
    if (urlChanged) await disableLoop();
  } else if (titleChangedSameUrl) {
    showWarning(T.warningTitleChanged);
    renderSavedList(state.url);
    if (rawTitle !== "—") updateSong(state.url, rawTitle);
    await disableLoop();
  }

  firstConnect = false;
  lastKnownUrl = state.url;
  if (rawTitle !== "—") lastKnownTitle = rawTitle;

  const titleSpan = document.getElementById("song-title");
  if (titleSpan.textContent !== rawTitle) {
    titleSpan.textContent = rawTitle;
    stopMarquee();
    requestAnimationFrame(() => startMarquee());
    updateSavedLoopsLabel();
  }

  if (!isLoopBarDragging) {
    document.getElementById("current-time").textContent = formatTime(state.currentTime);
    document.getElementById("duration").textContent = formatTime(state.duration);
    updateLoopBar(state.currentTime);
  }

  isPlaying = !state.paused;
  document.getElementById("btn-play").textContent = isPlaying ? T.btnPause : T.btnPlay;

  const speedSlider = document.getElementById("speed-slider");
  if (document.activeElement !== speedSlider) {
    speedSlider.value = state.playbackRate;
    document.getElementById("speed-value").textContent = state.playbackRate.toFixed(2) + "×";
  }
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  await loadLangPref();
  applyLanguage();
  renderSongsList();
  initLoopBar();

  poll();
  pollTimer = setInterval(poll, 500);

  // ---- Editor ----
  document.getElementById("btn-editor-open").addEventListener("click", openEditor);
  document.getElementById("btn-editor-close").addEventListener("click", () => {
    if (document.querySelector(".editor-card.dirty")) {
      const msg = lang === "ja"
        ? "保存されていない変更があります。保存せずに戻りますか？"
        : "You have unsaved changes. Go back without saving?";
      if (!confirm(msg)) return;
    }
    closeEditor();
  });

  // ---- Language ----
  document.getElementById("lang-select").addEventListener("change", async (e) => {
    lang = e.target.value;
    saveLangPref();
    applyLanguage();
    const state = await sendToContent({ type: "GET_STATE" });
    if (state?.url) renderSavedList(state.url);
    renderSongsList();
  });

  // ---- Fetch title button ----
  document.getElementById("btn-fetch-title").addEventListener("click", async () => {
    const btn = document.getElementById("btn-fetch-title");
    const reloadHint = document.getElementById("saved-loops-reload-hint");
    btn.disabled = true;
    await poll();
    btn.disabled = false;
    if (!lastKnownTitle) reloadHint.style.display = "block";
  });

  // ---- Warning close ----
  document.getElementById("warning-close").addEventListener("click", hideWarning);

  // ---- Space key: play/pause ----
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      sendToContent({ type: "TOGGLE_PLAY" });
    }
  });

  // ---- Play/Pause ----
  document.getElementById("btn-play").addEventListener("click", async () => {
    await sendToContent({ type: "TOGGLE_PLAY" });
  });

  // ---- Back/Forward ----
  document.getElementById("btn-back5").addEventListener("click", async () => {
    const state = await sendToContent({ type: "GET_STATE" });
    if (state) await sendToContent({ type: "SET_CURRENT_TIME", time: Math.max(0, state.currentTime - 5) });
  });
  document.getElementById("btn-fwd5").addEventListener("click", async () => {
    const state = await sendToContent({ type: "GET_STATE" });
    if (state) await sendToContent({ type: "SET_CURRENT_TIME", time: Math.min(duration, state.currentTime + 5) });
  });

  // ---- Speed slider ----
  const speedSlider = document.getElementById("speed-slider");
  speedSlider.addEventListener("input", () => {
    document.getElementById("speed-value").textContent = parseFloat(speedSlider.value).toFixed(2) + "×";
  });
  speedSlider.addEventListener("change", async () => {
    await sendToContent({ type: "SET_PLAYBACK_RATE", rate: parseFloat(speedSlider.value) });
  });
  speedSlider.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const newRate = Math.min(1.5, Math.max(0.5,
      Math.round((parseFloat(speedSlider.value) + (e.deltaY < 0 ? 0.05 : -0.05)) / 0.05) * 0.05
    ));
    speedSlider.value = newRate;
    document.getElementById("speed-value").textContent = newRate.toFixed(2) + "×";
    await sendToContent({ type: "SET_PLAYBACK_RATE", rate: newRate });
  }, { passive: false });

  document.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const rate = parseFloat(btn.dataset.speed);
      speedSlider.value = rate;
      document.getElementById("speed-value").textContent = rate.toFixed(2) + "×";
      await sendToContent({ type: "SET_PLAYBACK_RATE", rate });
    });
  });

  // ---- Loop A/B set buttons ----
  document.getElementById("btn-set-a").addEventListener("click", async () => {
    const state = await sendToContent({ type: "GET_STATE" });
    if (!state) return;
    loopA = Math.round(state.currentTime * 10) / 10;
    if (loopB !== null && loopB < loopA) loopB = loopA;
    activeLoopId = null;
    updateLoopDisplay();
    if (loopEnabled && loopA !== null && loopB !== null)
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
  });

  document.getElementById("btn-set-b").addEventListener("click", async () => {
    const state = await sendToContent({ type: "GET_STATE" });
    if (!state) return;
    const t = Math.round(state.currentTime * 10) / 10;
    loopB = loopA !== null ? Math.max(t, loopA) : t;
    activeLoopId = null;
    updateLoopDisplay();
    if (loopEnabled && loopA !== null && loopB !== null)
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
  });

  // ---- A/B scroll & keyboard adjust ----
  function makeTimeAdjustable(secId, decId, getTime, setTime, afterAdjust) {
    const secEl = document.getElementById(secId);
    const decEl = document.getElementById(decId);
    const apply = async (delta, step) => {
      if (getTime() === null) return;
      setTime(Math.max(0, Math.round((getTime() + delta * step) * 10) / 10));
      updateLoopDisplay();
      if (loopEnabled && loopA !== null && loopB !== null)
        await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
      if (afterAdjust) await afterAdjust();
    };
    secEl.addEventListener("wheel", (e) => { e.preventDefault(); apply(e.deltaY < 0 ? 1 : -1, 1); }, { passive: false });
    secEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); apply(1, 1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); apply(-1, 1); }
    });
    decEl.addEventListener("wheel", (e) => { e.preventDefault(); apply(e.deltaY < 0 ? 1 : -1, 0.1); }, { passive: false });
    decEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); apply(1, 0.1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); apply(-1, 0.1); }
    });
  }

  makeTimeAdjustable("loop-a-sec", "loop-a-dec", () => loopA, (v) => {
    loopA = v;
    if (loopB !== null && loopB < loopA) loopB = loopA;
  });

  makeTimeAdjustable("loop-b-sec", "loop-b-dec", () => loopB, (v) => {
    loopB = loopA !== null ? Math.max(v, loopA) : v;
  }, async () => {
    if (loopEnabled && loopB !== null) {
      const seekTo = loopA !== null
        ? Math.max(loopB - B_PREVIEW_SECONDS, loopA)
        : Math.max(loopB - B_PREVIEW_SECONDS, 0);
      await sendToContent({ type: "SET_CURRENT_TIME", time: seekTo });
    }
  });

  // ---- Loop toggle ----
  document.getElementById("loop-toggle").addEventListener("change", async (e) => {
    loopEnabled = e.target.checked;
    if (loopEnabled && (loopA === null || loopB === null)) {
      loopEnabled = false;
      e.target.checked = false;
      alert(T.alertSetAB);
      return;
    }
    updateLoopDisplay();
    await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: loopEnabled });
  });

  document.getElementById("btn-clear-loop").addEventListener("click", async () => {
    loopA = null; loopB = null; loopEnabled = false; activeLoopId = null;
    document.getElementById("loop-toggle").checked = false;
    updateLoopDisplay();
    await sendToContent({ type: "SET_LOOP", start: 0, end: 0, enabled: false });
  });

  // ---- Save loop ----
  document.getElementById("btn-save-loop").addEventListener("click", async () => {
    if (loopA === null || loopB === null) { alert(T.alertSaveAB); return; }
    const nameInput = document.getElementById("loop-name-input");
    const name = nameInput.value.trim() || `ループ ${formatTime(loopA)}-${formatTime(loopB)}`;
    const state = await sendToContent({ type: "GET_STATE" });
    if (!state) return;

    const songs = await getSongs();
    const [id, existing] = findSongEntry(songs, state.url);
    const rawTitle = parseTitle(state.title);
    const now = Date.now();
    const vid = extractVideoId(state.url);
    const existingCount = id ? (existing.loops || []).length : 0;
    const colorKey = LOOP_COLORS[existingCount % LOOP_COLORS.length].key;
    const newLoop = { id: generateId(), name, a: loopA, b: loopB, color: colorKey };

    if (id) {
      songs[id] = {
        ...existing,
        title: rawTitle !== "—" ? rawTitle : existing.title,
        url: state.url,
        lastOpened: now,
        loops: [...(existing.loops || []), newLoop],
      };
    } else {
      const newId = generateId();
      songs[newId] = {
        title: rawTitle !== "—" ? rawTitle : state.url,
        url: state.url,
        videoId: vid,
        createdAt: now,
        lastOpened: now,
        loops: [newLoop],
      };
    }
    await saveSongs(songs);
    nameInput.value = "";
    renderSavedList(state.url);
    renderSongsList();
  });
});
