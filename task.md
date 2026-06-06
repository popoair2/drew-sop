# Task — Drew-Sop

## Current Phase: Feature — Manual Dividend Yield Input

### Background
Andrew 手動加股息率，因為 API 拎唔到。每種資產都要可以入。

### This Sprint: Add Manual Dividend Yield Field

**Scope:**
1. **Asset data structure** — 加 `dividendYield` field (number, percentage, e.g. 2.5 means 2.5%)
2. **Edit/Add asset modal** — 加手動輸入派息率嘅 input field（百分比，可小數）
3. **Asset list display** — 喺資產列表顯示派息率（例如 "Div: 2.5%"）
4. **spec.md** — 更新 Asset data structure

**Rules:**
- 所有資產類型都要有呢個 field（美股、ETF、港股、crypto、貨幣、貨幣基金）
- 預設值 0，可留空（表示唔知/唔適用）
- 唔使計 dividend amount（純粹顯示派息率 %）
- 唔影響 total value 計算
- 改動範圍：`spec.md`, `js/storage.js`, `js/app.js`, `index.html`（如果 modal 喺 HTML）

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
- [x] Dividend yield display in asset list (commit b7c4af4)
- [x] Edit category functionality
- [x] Category headers use assigned color
- [x] Remove clear all data button
- [x] Retro-futuristic industrial dashboard redesign
- [x] **Fix Bug 1**: 手動派息率無顯示 — Supabase `dividend_yield` column missing, added localStorage fallback
- [x] **Fix Bug 2**: 資產 edit 儲存後無更改 — `updateAsset` using `.upsert()` caused duplicate key error, changed to `.update().eq()`
- [x] **Fix Bug 3**: 新增唔到資產 — `addAsset` sending `dividend_yield` to non-existent column, removed from payload

### In Progress
- [ ] Testing in browser

### Pending
- [ ] Deploy to GitHub Pages (pushed, waiting for GitHub Pages refresh)
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
│   ├── storage.js      ✅ localStorage CRUD
│   ├── api.js          ✅ Finnhub + CoinGecko
│   ├── charts.js       ✅ Chart.js wrappers
│   └── app.js          ✅ Main app logic
├── assets/             (empty)
├── AGENTS.md           ✅
├── spec.md             ✅
├── task.md             ✅ This file
└── research.md         ✅
```
