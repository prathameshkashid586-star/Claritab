<div align="center">

# ⬡ Claritab

### AI-powered Chrome Extension for smarter tab management and research

![Version](https://img.shields.io/badge/version-4.0.2-5b8fff?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-4ade80?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-Extension-f59e0b?style=flat-square)
![AI](https://img.shields.io/badge/AI-Claude%20%7C%20Gemini%20%7C%20GPT%20%7C%20Groq-a78bfa?style=flat-square)
![Free](https://img.shields.io/badge/free-forever-4ade80?style=flat-square)

**Built by a CS student from Pune 🇮🇳 who got tired of having 30 tabs open with no idea which source to trust.**

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/ohoipbbmkecgcjpgeclpdlgdoiojcicp) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>

---

## 🤔 Why Claritab?

Every student, researcher, and developer knows this feeling — 20+ tabs open, browser slowing down, no idea which source is credible, and sessions lost every time Chrome crashes.

Existing tab managers just list your tabs. **Claritab understands them.**

It reads your tabs, groups them by topic, scores them for research quality, and saves your sessions automatically. All for free.

---

## ✨ Features

### 🤖 AI-Powered
- **AI Summaries** — click ✦ on any tab to get a 3-sentence summary instantly
- **AI Auto-Grouping** — one click groups all your tabs by topic automatically
- **AI Auto-Assign** — new tabs are automatically assigned to the best matching group
- **Research Comparator** — scores tabs by credibility, depth and neutrality. Tells you which source to trust
- **AI Name Suggest** — AI suggests a name for your manual groups

### 📋 Tab Management
- **All Tabs View** — list, search, close and switch tabs from one place
- **Live Tab Sync** — tab list updates in real time as tabs open, close or change
- **Manual Grouping** — select tabs with checkboxes, create custom groups
- **Edit Groups** — rename groups, move tabs between groups, delete tabs
- **Keyboard Shortcuts** — `Ctrl+F` search, `Ctrl+G` groups, `Ctrl+Shift+S` sessions, `Ctrl+H` health, `Esc` close panels

### 🎯 Productivity
- **Focus Mode** — select tabs to focus on, all others get dimmed visually with FOCUS/OTHER badges
- **Tab Health Score** — scores your browser out of 100, detects duplicates and old tabs, fixes them automatically
- **Session Save** — save your current tabs as a named session, restore anytime
- **Auto-save** — silently saves your tabs every 5 minutes in the background
- **Device Sync** — sessions and groups sync across all your Chrome browsers via Google account
- **Export / Import** — export sessions as JSON, import on any device

### 🔑 Multi AI Provider
Choose your preferred AI — no lock-in:

| Provider | Model | Key Format | Cost |
|----------|-------|-----------|------|
| Groq | llama-3.1-8b-instant | `gsk_...` | **Free tier** ✅ |
| Gemini (Google) | gemini-2.5-flash-lite | `AIzaSy...` | **Free forever** ✅ |
| Claude (Anthropic) | claude-haiku | `sk-ant-...` | $5 free credits |
| GPT-4o (OpenAI) | gpt-4o-mini | `sk-...` | $5 free credits |

> 💡 **Recommended for students:** Use **Groq** — completely free, no credit card needed, no rate limit issues. Get your key at [console.groq.com](https://console.groq.com)

---

## 🚀 Installation

### From Chrome Web Store ✅ Live
[👉 Install Claritab](https://chromewebstore.google.com/detail/ohoipbbmkecgcjpgeclpdlgdoiojcicp)

### Manual Installation (Developer Mode)
1. Download or clone this repository
```bash
git clone https://github.com/prathameshkashid586-star/claritab.git
```
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer Mode** (toggle in top-right)
4. Click **Load unpacked** → select the `claritab` folder
5. Claritab icon appears in your Chrome toolbar ✅

---

## ⚙️ Setup

1. Click the Claritab icon in your toolbar
2. Click **⚙** settings → select your AI provider
3. Paste your API key → click **Save**
4. Start exploring your tabs with AI!

> Get a **free Groq API key** at [console.groq.com](https://console.groq.com) — no credit card required, no rate limits for normal use.

---

## 🎮 How to Use

### AI Auto-Group
1. Open tabs on any topic
2. Go to **⬡ Groups** tab
3. Click **✦ AI Auto-Group**
4. Watch AI organize your tabs instantly
5. New tabs you open will be auto-assigned to the best matching group

### Research Comparator
1. Auto-group or manually group your research tabs
2. Expand any group
3. Click **⚖ Compare for Research**
4. See credibility, depth and neutrality scores for each source

### Focus Mode
1. Go to **◎ Focus** tab
2. Check the tabs you want to focus on
3. Click **Activate Focus**
4. Focused tabs glow green with a FOCUS badge, others are dimmed
5. Click **Exit Focus** to return to normal

### Session Save
1. Go to **💾 Sessions** tab
2. Click **💾 Save Current Session**
3. Give it a name → Save
4. Restore anytime — even after Chrome crashes

---

## 📁 File Structure

```
claritab/
├── manifest.json       ← Extension config (Manifest V3)
├── popup.html          ← UI structure
├── popup.css           ← Styling
├── popup.js            ← All popup functionality (~1900 lines)
├── background.js       ← Auto-save + device sync + AI API calls
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🛠️ Built With

- **HTML, CSS, JavaScript** — no frameworks, pure vanilla
- **Chrome Extensions API** (Manifest V3)
- `chrome.storage.sync` — cross-device sync
- `chrome.storage.local` — local fallback + API key storage
- `chrome.alarms` — background auto-save every 5 minutes
- `chrome.scripting` — page content extraction for AI summaries
- `chrome.tabs` — live tab event listeners (onCreated, onRemoved, onUpdated, onActivated)
- **Claude / Gemini / GPT-4o / Groq APIs** — all AI features route through background.js to avoid CORS

---

## 📋 Changelog

### v4.0.2 (Latest)
- 🐛 Fixed Gemini false "quota exceeded" error — updated to gemini-2.5-flash-lite model
- 🐛 Fixed closed tabs not being removed from groups after browser restart
- 🐛 Added proper 400/401/403 error messages for all AI providers
- 🐛 Fixed Groq and OpenAI error ordering

### v4.0.1
- 🐛 Fixed tab removal from groups using URL fallback matching
- 🐛 Fixed Gemini empty response causing false quota error

### v4.0.0
- 🎉 Initial public release
- ✨ AI Auto-Grouping, Research Comparator, Focus Mode, Session Save
- ✨ Multi-provider AI support (Claude, Gemini, GPT-4o, Groq)
- ✨ Tab Health Score, onboarding flow, device sync

---

## 🗺️ Roadmap

- [x] Chrome Web Store listing ✅
- [ ] Tab Collapse — collapse all tabs into a list, restore individually (coming in v4.1)
- [ ] Tab grouping with Chrome's native tab groups API
- [ ] Export research comparison as PDF
- [ ] Scheduled focus sessions with timer
- [ ] Collaborative sessions — share tab lists with teammates
- [ ] Browser history integration

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs by [opening an issue](../../issues)
- Suggest features via issues
- Submit pull requests

---

## 📄 License

MIT License — free to use, modify and distribute.

---

<div align="center">

**If Claritab helped you, consider giving it a ⭐ on GitHub!**

Made with ❤️ by a student from Pune, India 🇮🇳

</div>
