// content.js
// サイドパネル（sidepanel.js）からのメッセージを受け取り、
// ページ上の<video>要素を操作するブリッジ

let loopInterval = null;
let loopStart = null;
let loopEnd = null;
let loopEnabled = false;

function getVideo() {
  return document.querySelector("video");
}

// ループ監視
function startLoopWatch() {
  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(() => {
    const video = getVideo();
    if (!video || !loopEnabled) return;
    if (loopEnd !== null && video.currentTime >= loopEnd) {
      video.currentTime = loopStart ?? 0;
    }
  }, 100);
}

function stopLoopWatch() {
  if (loopInterval) clearInterval(loopInterval);
  loopInterval = null;
}

// サイドパネルからのメッセージ受信
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const video = getVideo();

  switch (message.type) {
    case "GET_STATE": {
      if (!video) {
        sendResponse({ error: "video not found" });
        return true;
      }
      sendResponse({
        currentTime: video.currentTime,
        duration: video.duration || 0,
        playbackRate: video.playbackRate,
        paused: video.paused,
        title: document.title,
        url: location.href
      });
      break;
    }

    case "SET_PLAYBACK_RATE": {
      if (video) video.playbackRate = message.rate;
      sendResponse({ ok: true });
      break;
    }

    case "SET_CURRENT_TIME": {
      if (video) video.currentTime = message.time;
      sendResponse({ ok: true });
      break;
    }

    case "SET_LOOP": {
      loopStart = message.start;
      loopEnd = message.end;
      loopEnabled = message.enabled;
      if (loopEnabled) {
        startLoopWatch();
        if (video) video.currentTime = loopStart;
      } else {
        stopLoopWatch();
      }
      sendResponse({ ok: true });
      break;
    }

    case "TOGGLE_PLAY": {
      if (video) {
        if (video.paused) video.play();
        else video.pause();
      }
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ error: "unknown message type" });
  }

  return true;
});
