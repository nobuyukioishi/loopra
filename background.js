const COLOR_ICON = { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: "icons/icon128.png" };
const grayIconCache = {};

async function buildGrayIcon(size) {
  const res = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const g = Math.round((0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2])) + 120; // Modify the brightness by adding a constant value (80~150)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
  }
  return img;
}

async function getGrayIcons() {
  if (!grayIconCache[16]) {
    await Promise.all([16, 48, 128].map(async (s) => { grayIconCache[s] = await buildGrayIcon(s); }));
  }
  return grayIconCache;
}

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

async function updateActionState(tabId, url) {
  const isYTM = url && url.includes("music.youtube.com");
  chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: !!isYTM });
  if (isYTM) {
    chrome.action.setIcon({ path: COLOR_ICON, tabId });
    chrome.action.enable(tabId);
  } else {
    const grayIcons = await getGrayIcons();
    chrome.action.setIcon({ imageData: grayIcons, tabId });
    chrome.action.disable(tabId);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateActionState(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab.url) updateActionState(tabId, tab.url);
  });
});
