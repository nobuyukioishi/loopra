# Loopra

> AB Loop & Speed Control for YouTube Music

Loopra is a Chrome extension that lets you loop any section of a song and control playback speed on YouTube Music — perfect for music practice, transcription, and deep listening.

---

## Features

- **AB Loop** — Set start (A) and end (B) points to loop any section of a track
- **Speed Control** — Adjust playback from 0.5× to 1.5× with a slider or presets
- **Saved Loops** — Save multiple named loops per song and reload them instantly
- **Saved Songs** — Browse recently looped songs and jump back to them
- **Seek & Fine-tune** — Scroll wheel or arrow keys to nudge A/B points by 1 second
- **Auto-open** — Optionally open the side panel automatically when YouTube Music launches
- **Bilingual UI** — Supports English and Japanese (日本語対応)

---

## Installation

Loopra is not yet on the Chrome Web Store. To install manually:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `Loopra` folder

The Loopra icon will appear in your toolbar. Open YouTube Music and click the icon to launch the side panel.

---

## Usage

1. Open [YouTube Music](https://music.youtube.com) and start a song
2. Click the **Loopra icon** in the Chrome toolbar to open the side panel
3. Play to the start of the section you want to loop → click **Set Current Time** under **A**
4. Play to the end → click **Set Current Time** under **B**
5. Toggle the loop switch **ON**
6. Adjust A/B points with scroll wheel or ↑↓ arrow keys for fine-tuning
7. Click **Save** to store the loop with a name for later

---

## Screenshots

*Coming soon*

---

## Tech Stack

- Chrome Extension Manifest V3
- Chrome Side Panel API
- Vanilla JS / HTML / CSS (no build step)

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## License

MIT
