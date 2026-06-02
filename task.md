# Task — Drew-Sop

## Current Phase: Build — Core Files Done

### Done
- [x] Project folder created (`~/projects/drew-sop/`)
- [x] Research free API options → `research.md`
- [x] Channel mapping added to orchestrator config
- [x] Profile created (drew-sop)
- [x] Spec updated with UI style, categories, HKD base, change tracking
- [x] Tech stack finalised
- [x] `index.html` — Full Bento layout with modals
- [x] `css/style.css` — Neo-Brutalist Bento theme
- [x] `js/utils.js` — Formatting, UUID, currency helpers
- [x] `js/storage.js` — localStorage CRUD for assets, categories, prices, snapshots
- [x] `js/api.js` — Finnhub + CoinGecko price fetching
- [x] `js/charts.js` — Chart.js pie + line chart wrappers
- [x] `js/app.js` — Main app: render, CRUD, auto-refresh, modals

### In Progress
- [ ] Testing in browser
- [ ] Deploy to GitHub Pages

### Pending
- [ ] Andrew to provide Finnhub API key for live testing
- [ ] GitHub repo setup + Pages deploy
- [ ] Iteration based on feedback

## Blocker
- Need Andrew's Finnhub API key before price fetching can be tested live

## File Structure
```
~/projects/drew-sop/
├── index.html          ✅ Main entry
├── css/
│   └── style.css       ✅ Neo-Brutalist Bento styles
├── js/
│   ├── utils.js        ✅ Helpers
│   ├── storage.js      ✅ localStorage layer
│   ├── api.js          ✅ Finnhub + CoinGecko
│   ├── charts.js       ✅ Chart.js wrappers
│   └── app.js          ✅ Main app logic
├── assets/             (empty)
├── AGENTS.md           ✅
├── spec.md             ✅ Updated
├── task.md             ✅ This file
└── research.md         ✅
```
