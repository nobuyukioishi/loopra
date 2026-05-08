// ---- i18n ----
const STRINGS = {
  ja: {
    statusConnected: "接続中",
    statusDisconnected: "YouTube Musicを開いてください",
    labelPosition: "再生位置",
    labelSpeed: "再生速度",
    labelLoop: "A-Bループ",
    labelSaved: "保存済みループ",
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
    labelSettings: "設定",
    settingAutoOpen: "YouTube Musicを開いたとき自動起動",
  },
  en: {
    statusConnected: "Connected",
    statusDisconnected: "Open YouTube Music",
    labelPosition: "Position",
    labelSpeed: "Speed",
    labelLoop: "A-B Loop",
    labelSaved: "Saved Loops",
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
    labelSettings: "Settings",
    settingAutoOpen: "Auto-open with YouTube Music",
  },
};
let lang = "en";
let T = STRINGS[lang];

async function loadLangPref() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["lang_pref"], (result) => {
      if (result.lang_pref && STRINGS[result.lang_pref]) {
        lang = result.lang_pref;
        T = STRINGS[lang];
        document.getElementById("lang-select").value = lang;
      }
      resolve();
    });
  });
}

function saveLangPref() {
  chrome.storage.local.set({ lang_pref: lang });
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
  document.getElementById("btn-play").textContent = isPlaying ? T.btnPause : T.btnPlay;
  setStatus(isConnected);
}

// ---- State ----
let loopA = null;
let loopB = null;
let loopEnabled = false;
let duration = 0;
let isSeeking = false;
let isPlaying = false;
let isConnected = false;
let pollTimer = null;
let marqueeAnimFrame = null;
let marqueePhase = "pause-start";
let marqueePhaseStart = 0;
let lastKnownUrl = null;
let lastKnownTitle = null;
let firstConnect = true;

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
  const cleaned = pageTitle.replace(" - YouTube Music", "").trim();
  return (cleaned && cleaned !== "YouTube Music") ? cleaned : "—";
}

function formatTime(sec) {
  if (sec === null || isNaN(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

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
function storageKey(url) {
  try {
    const u = new URL(url);
    return "loops_" + (u.searchParams.get("v") || u.pathname);
  } catch {
    return "loops_default";
  }
}

async function loadLoops(url) {
  const key = storageKey(url);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] || []));
  });
}

async function saveLoops(url, loops) {
  const key = storageKey(url);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: loops }, resolve);
  });
}

function updateSongIndex(url, title) {
  const key = storageKey(url);
  chrome.storage.local.get(["song_index"], (result) => {
    const index = result.song_index || {};
    const existing = index[key];
    const now = Date.now();
    index[key] = {
      title,
      url,
      createdAt: existing?.createdAt ?? now,
      lastOpened: now,
    };
    chrome.storage.local.set({ song_index: index }, renderSongsList);
  });
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
  document.getElementById("loop-a-display").textContent = formatTime(loopA);
  document.getElementById("loop-b-display").textContent = formatTime(loopB);
  const label = document.getElementById("loop-active-label");
  label.textContent = loopEnabled ? T.loopOn : T.loopOff;
  label.className = loopEnabled ? "on" : "";
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

// ---- Saved loops list ----
async function renderSavedList(url) {
  const loops = await loadLoops(url);
  const list = document.getElementById("saved-list");
  const hint = document.getElementById("empty-hint");

  [...list.children].forEach((c) => { if (c !== hint) c.remove(); });

  if (loops.length === 0) {
    hint.style.display = "";
    hint.textContent = T.emptyHint;
    return;
  }
  hint.style.display = "none";

  loops.forEach((loop, index) => {
    const item = document.createElement("div");
    item.className = "saved-item";
    item.innerHTML = `
      <div class="saved-item-info">
        <div class="saved-item-name">${escapeHtml(loop.name)}</div>
        <div class="saved-item-times">${formatTime(loop.a)} → ${formatTime(loop.b)}</div>
      </div>
      <button class="btn-small" data-edit="${index}">${T.btnEdit}</button>
      <button class="btn-small" data-load="${index}">${T.btnLoad}</button>
      <button class="btn-danger" data-delete="${index}">${T.btnDelete}</button>
    `;

    item.querySelector(`[data-load]`).addEventListener("click", async (e) => {
      e.stopPropagation();
      loopA = loop.a;
      loopB = loop.b;
      loopEnabled = true;
      document.getElementById("loop-toggle").checked = true;
      updateLoopDisplay();
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
    });

    item.querySelector(`[data-delete]`).addEventListener("click", async (e) => {
      e.stopPropagation();
      const updated = loops.filter((_, i) => i !== index);
      await saveLoops(url, updated);
      renderSavedList(url);
      renderSongsList();
    });

    item.querySelector(`[data-edit]`).addEventListener("click", (e) => {
      e.stopPropagation();
      let editA = loop.a;
      let editB = loop.b;

      item.innerHTML = `
        <div style="flex:1; min-width:0;">
          <input type="text" class="edit-name-input" value="${escapeHtml(loop.name)}" maxlength="30">
          <div class="edit-ab-row">
            <div class="edit-ab-box">
              <div class="edit-ab-label">A</div>
              <span class="edit-ab-time edit-a-time" tabindex="0">${formatTime(editA)}</span>
            </div>
            <div class="edit-ab-arrow">→</div>
            <div class="edit-ab-box">
              <div class="edit-ab-label">B</div>
              <span class="edit-ab-time edit-b-time" tabindex="0">${formatTime(editB)}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
          <button class="btn-small edit-save">${T.btnEditSave}</button>
          <button class="btn-danger edit-cancel">${T.btnEditCancel}</button>
        </div>
      `;

      const editAEl = item.querySelector(".edit-a-time");
      const editBEl = item.querySelector(".edit-b-time");

      function addEditTimeHandlers(el, getVal, setVal) {
        const update = (delta) => {
          setVal(Math.max(0, getVal() + delta));
          el.textContent = formatTime(getVal());
        };
        el.addEventListener("wheel", (e2) => { e2.preventDefault(); update(e2.deltaY < 0 ? 1 : -1); }, { passive: false });
        el.addEventListener("keydown", (e2) => {
          if (e2.key === "ArrowUp") { e2.preventDefault(); update(1); }
          else if (e2.key === "ArrowDown") { e2.preventDefault(); update(-1); }
        });
      }

      addEditTimeHandlers(editAEl, () => editA, (v) => {
        editA = v;
        if (editB < editA) { editB = editA; editBEl.textContent = formatTime(editB); }
      });
      addEditTimeHandlers(editBEl, () => editB, (v) => {
        editB = Math.max(v, editA);
      });

      item.querySelector(".edit-save").addEventListener("click", async (e2) => {
        e2.stopPropagation();
        const newName = item.querySelector(".edit-name-input").value.trim() || loop.name;
        const allLoops = await loadLoops(url);
        allLoops[index] = { name: newName, a: editA, b: editB };
        await saveLoops(url, allLoops);
        renderSavedList(url);
      });

      item.querySelector(".edit-cancel").addEventListener("click", (e2) => {
        e2.stopPropagation();
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

  chrome.storage.local.get(null, (allData) => {
    const index = allData.song_index || {};
    const songs = Object.entries(index)
      .map(([key, info]) => ({
        key, title: info.title, url: info.url,
        count: Array.isArray(allData[key]) ? allData[key].length : 0,
        lastOpened: info.lastOpened || 0,
        createdAt: info.createdAt || 0,
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.lastOpened - a.lastOpened);

    container.innerHTML = "";
    if (songs.length === 0) {
      const hint = document.createElement("div");
      hint.className = "empty-hint";
      hint.textContent = T.emptyAllSongs;
      container.appendChild(hint);
      return;
    }

    const SHOW_LIMIT = 5;
    const visible = isExpanded ? songs : songs.slice(0, SHOW_LIMIT);

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

    if (songs.length > SHOW_LIMIT) {
      const moreBtn = document.createElement("button");
      moreBtn.className = "btn-small";
      moreBtn.style.cssText = "width:100%; margin-top:4px;";
      moreBtn.textContent = isExpanded ? T.btnShowLess : T.btnShowMore(songs.length - SHOW_LIMIT);
      moreBtn.addEventListener("click", () => {
        container.dataset.expanded = isExpanded ? "false" : "true";
        renderSongsList();
      });
      container.appendChild(moreBtn);
    }
  });
}

// ---- Marquee ----
const MARQUEE_SPEED = 40; // px/s
const MARQUEE_PAUSE = 2000; // ms
const MARQUEE_GAP = 48; // px gap between end of text and clone start

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

  const rawTitle = parseTitle(state.title);
  const urlChanged = state.url !== lastKnownUrl;
  const titleChangedSameUrl = !urlChanged && rawTitle !== "—" && lastKnownTitle !== null && rawTitle !== lastKnownTitle;

  if (urlChanged || firstConnect) {
    hideWarning();
    renderSavedList(state.url);
    lastKnownTitle = null;
    if (rawTitle !== "—") updateSongIndex(state.url, rawTitle);
  } else if (titleChangedSameUrl) {
    showWarning(T.warningTitleChanged);
    renderSavedList(state.url);
    if (rawTitle !== "—") updateSongIndex(state.url, rawTitle);
  }

  firstConnect = false;
  lastKnownUrl = state.url;
  if (rawTitle !== "—") lastKnownTitle = rawTitle;

  const titleSpan = document.getElementById("song-title");
  if (titleSpan.textContent !== rawTitle) {
    titleSpan.textContent = rawTitle;
    stopMarquee();
    requestAnimationFrame(() => startMarquee());
  }

  if (!isSeeking) {
    document.getElementById("current-time").textContent = formatTime(state.currentTime);
    document.getElementById("duration").textContent = formatTime(state.duration);
    const seekBar = document.getElementById("seek-bar");
    seekBar.max = state.duration || 100;
    seekBar.value = state.currentTime;
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

  // ---- Auto-open setting ----
  const autoOpenToggle = document.getElementById("toggle-auto-open");
  chrome.storage.local.get(["auto_open"], (result) => {
    autoOpenToggle.checked = !!result.auto_open;
  });
  autoOpenToggle.addEventListener("change", () => {
    chrome.storage.local.set({ auto_open: autoOpenToggle.checked });
  });

  poll();
  pollTimer = setInterval(poll, 500);

  // ---- Language ----
  document.getElementById("lang-select").addEventListener("change", async (e) => {
    lang = e.target.value;
    saveLangPref();
    applyLanguage();
    const state = await sendToContent({ type: "GET_STATE" });
    if (state?.url) renderSavedList(state.url);
    renderSongsList();
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

  // ---- Seek bar ----
  const seekBar = document.getElementById("seek-bar");
  seekBar.addEventListener("mousedown", () => (isSeeking = true));
  seekBar.addEventListener("touchstart", () => (isSeeking = true));
  seekBar.addEventListener("input", () => {
    document.getElementById("current-time").textContent = formatTime(+seekBar.value);
  });
  seekBar.addEventListener("change", async () => {
    isSeeking = false;
    await sendToContent({ type: "SET_CURRENT_TIME", time: +seekBar.value });
  });
  seekBar.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const newTime = Math.max(0, Math.min(duration, parseFloat(seekBar.value) + (e.deltaY < 0 ? 5 : -5)));
    seekBar.value = newTime;
    document.getElementById("current-time").textContent = formatTime(newTime);
    await sendToContent({ type: "SET_CURRENT_TIME", time: newTime });
  }, { passive: false });

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
    loopA = state.currentTime;
    if (loopB !== null && loopB < loopA) loopB = loopA;
    updateLoopDisplay();
    if (loopEnabled && loopA !== null && loopB !== null)
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
  });

  document.getElementById("btn-set-b").addEventListener("click", async () => {
    const state = await sendToContent({ type: "GET_STATE" });
    if (!state) return;
    loopB = loopA !== null ? Math.max(state.currentTime, loopA) : state.currentTime;
    updateLoopDisplay();
    if (loopEnabled && loopA !== null && loopB !== null)
      await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
  });

  // ---- A/B scroll & keyboard adjust ----
  function makeTimeAdjustable(elementId, getTime, setTime) {
    const el = document.getElementById(elementId);
    const update = async (delta) => {
      if (getTime() === null) return;
      setTime(Math.max(0, getTime() + delta));
      updateLoopDisplay();
      if (loopEnabled && loopA !== null && loopB !== null)
        await sendToContent({ type: "SET_LOOP", start: loopA, end: loopB, enabled: true });
    };
    el.addEventListener("wheel", (e) => { e.preventDefault(); update(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); update(1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); update(-1); }
    });
  }

  makeTimeAdjustable("loop-a-display", () => loopA, (v) => {
    loopA = v;
    if (loopB !== null && loopB < loopA) loopB = loopA;
  });
  makeTimeAdjustable("loop-b-display", () => loopB, (v) => {
    loopB = loopA !== null ? Math.max(v, loopA) : v;
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
    loopA = null; loopB = null; loopEnabled = false;
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

    const loops = await loadLoops(state.url);
    loops.push({ name, a: loopA, b: loopB });
    await saveLoops(state.url, loops);
    nameInput.value = "";

    const rawTitle = parseTitle(state.title);
    if (rawTitle !== "—") updateSongIndex(state.url, rawTitle);

    renderSavedList(state.url);
    renderSongsList();
  });
});
