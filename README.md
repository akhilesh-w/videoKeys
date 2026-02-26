# VideoKeys

YouTube keyboard shortcuts on every site. Control any HTML5 video with the shortcuts you already know.

## Features

- **Universal** — Works on Twitter/X, Reddit, Vimeo, and any site with `<video>` elements
- **Smart video detection** — Finds the right video even in infinite scroll feeds
- **Visual feedback** — YouTube-style overlay indicators
- **Per-site control** — Enable/disable on specific domains
- **Zero conflict** — Automatically skips YouTube and ignores input fields

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `J` | Rewind 10s |
| `L` | Forward 10s |
| `←` / `→` | Seek ±5s |
| `↑` / `↓` | Volume ±5% |
| `M` | Mute / Unmute |
| `F` | Fullscreen |
| `Shift+>` / `Shift+<` | Speed up / down |
| `0`–`9` | Seek to 0%–90% |
| `,` / `.` | Frame step (when paused) |

## Install

1. Clone this repo or download as ZIP
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `videoKeys` folder
5. Navigate to any site with videos and start using shortcuts

## How It Works

The extension injects a content script on all pages (except YouTube). It detects `<video>` elements using MutationObserver and viewport analysis, tracks which video you're interacting with, and maps YouTube-style keyboard shortcuts to the standard HTMLMediaElement API.

Shortcuts are disabled when you're typing in text fields, search boxes, or content-editable areas.
