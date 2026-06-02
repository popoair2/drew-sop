# Drew-Sop 資產管理 Dashboard — 研究報告

## 需求整理
- 個人資產管理 dashboard（你一個人用）
- 資產分散唔同地方，手動入數（唔連錢包/銀行）
- 實時資產價格
- 少量圖表 + 數目表
- Web app / HTML（靜態 hosting 就得）
- 最平方案

---

## 免費資產價格 API 研究結果

### 1. Finnhub（推薦 ⭐）
- **免費額度**：60 calls/min，無限日數額
- **支援**：美股、港股、加密貨幣、Forex
- **實時價格**：`/quote` endpoint（免費，High Usage）
- **WebSocket**：免費 realtime
- **Sign up**：免費，即時有 API key
- **限制**：大部分進階數據（candles、financials）要 premium，但 **quote 係免費**
- **URL**：https://finnhub.io

### 2. Alpha Vantage
- **免費額度**：25 calls/day（免費 plan）
- **支援**：美股、外匯、crypto
- **缺點**：每日限制太少，唔適合多資產
- **URL**：https://www.alphavantage.co

### 3. Yahoo Finance（非官方 API）
- **方法**：用 `yfinance` Python library 或者 Yahoo Finance API endpoint
- **免費**：完全免費，冇限制
- **支援**：股票、ETF、crypto、indices
- **缺點**：非官方，可能會被擋（但係最多人用嘅免費方案）
- **URL**：https://finance.yahoo.com

### 4. Twelve Data
- **免費額度**：800 calls/day
- **支援**：股票、ETF、crypto、forex
- **實時**：付費先有，免費 plan 有 delay
- **URL**：https://twelvedata.com

### 5. CoinGecko（crypto 專用）
- **免費額度**：10-30 calls/min
- **支援**：crypto 為主
- **URL**：https://www.coingecko.com/en/api

### 推薦方案：
| 資產類型 | 推薦 API |
|---------|---------|
| 股票/ETF | Finnhub（免費 realtime）或 Yahoo Finance（無限） |
| 加密貨幣 | CoinGecko（免費）或 Finnhub |
| 外匯 | Finnhub |
| 港股 | Finnhub（支援 HK 股票代碼） |

**結論：Finnhub 一個 API 就夠覆蓋你大部分需求，免費 plan 已經夠用。**

---

## 建議架構

### Option A：純前端 HTML + JS（最簡單）
- 靜態 HTML + CSS + JS
- 用 `fetch()` 直接 call Finnhub API
- Database：用 **localStorage** 或者 **IndexedDB**（存你嘅資產記錄）
- Hosting：**GitHub Pages**（免費）或 **Vercel**（免費）
- 圖表：**Chart.js**（免費，輕量）
- **優點**：零 server 成本，完全免費
- **缺點**：API key 會暴露喺前端（但因為係你一個人用，問題唔大）

### Option B：Next.js + Supabase（你熟悉嘅 stack）
- Next.js frontend + API routes
- Supabase PostgreSQL 存資產記錄
- Server-side call API（API key 唔暴露）
- Hosting：Vercel（免費 tier）
- **優點**：你已經識，Supabase 免費 tier 夠用
- **缺點**：比 Option A 複雜

### Option C：純前端 + JSON file
- 靜態 HTML + JS
- 資產記錄存成 JSON file，手動 edit 或者用 UI 更新
- 唔需要 database
- **優點**：最簡單
- **缺點**：冇 database query 能力

---

## 建議：Option A（純前端）

理由：
1. 你一個人用，唔需要 backend
2. 完全免費（GitHub Pages + Finnhub free tier）
3. 部署簡單
4. 你熟悉 HTML/JS

---

## 準備工作清單

### 我（Orchestrator）可以做嘅：
- [ ] 喺 `~/projects/drew-sop/` 開 project 結構
- [ ] 寫 `AGENTS.md`（project 專用 agent 指令）
- [ ] 寫 `task.md`（呢個 project 嘅任務）
- [ ] 開 `spec.md`（根據你嘅需求）
- [ ] 研究定具體嘅 tech stack 同 file structure

### 需要你決定嘅：
1. **你主要持邊類資產？**（股票？crypto？港股？外匯？物業？）
2. **大概幾多隻資產？**（影響 API call 頻率）
3. **想要邊啲圖表？**（持倉分佈 pie chart？資產走勢 line chart？）
4. **邊個 hosting？**（GitHub Pages / Vercel / 其他）
5. **鍾意邊種 UI style？**（dark mode？minimal？）

---

*研究日期：2026-06-03*
