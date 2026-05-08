// ツールバーアイコンクリックでサイドパネルを開く
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// YouTube Musicのタブでサイドパネルを有効化 & 自動起動
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("music.youtube.com")) {
    chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });

    if (changeInfo.status === "complete") {
      chrome.storage.local.get(["auto_open"], (result) => {
        if (result.auto_open) chrome.sidePanel.open({ tabId });
      });
    }
  }
});
