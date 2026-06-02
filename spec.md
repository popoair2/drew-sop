# Spec — Drew-Sop 個人資產管理 Dashboard

## 目標
個人用自己嘅資產管理 dashboard，分散唔同市場，手動入數。

## 資產類型
| 類型 | 例子 | 備註 |
|------|------|------|
| 美股 | AAPL, NVDA, TSLA | |
| 港美 ETF | 3067.HK, QQQ, VOO | |
| 港股 | 0700.HK, 0941.HK | |
| Bitcoin | BTC | |
| 主要貨幣 | USD, EUR, JPY, CNY, HKD | 兌港元匯率 |
| 貨幣市場基金 | 現金等價物 | 自己入價值 |

## 資產分類
- 用戶自定義分類（最少 3 個，可增減）
- 每個資產歸入一個分類
- 分類名稱用戶自定義（例如：增長、防守、現金等）
- **唔係按資產類型分類，而係按用戶定義嘅功能分類**

## 規模
- **30 隻資產以內**
- **每 5 分鐘更新一次**價格

## 功能需求
1. 顯示所有持倉嘅實時價格
2. 持倉分佈圖表（pie chart — 按自定義分類）
3. 資產走勢圖表（line chart — 按日/月/年）
4. 手動輸入/更新持倉數量
5. 顯示總資產價值（以 HKD 為基準）
6. 按日/月/年嘅資產變化值（金額 + 百分比）
7. 自定義資產分類管理（增減分類）
8. 貨幣兌換（所有資產統一折算 HKD）

## 非功能需求
- 一個人用
- 手動入數（唔連錢包/銀行/API）
- 免費 hosting（GitHub Pages — 用免費 subdomain）
- 免費 API
- Web app / HTML（純靜態）
- 唔需要計回報率（因為未必有成本數據）

## UI/UX 規格 — Neo-Brutalist Bento

### 整體視覺
- 高對比度深色模式 + 模組化 Bento Box 佈局
- **絕對扁平化** — 無陰影、無漸變、無 3D 效果

### 配色
| 用途 | 顏色 |
|------|------|
| 全局背景 | 純黑 #000000 |
| 全局文字 | 純白 #FFFFFF 或淺灰 |
| 卡片底色 | 大膽實色塊（淺灰綠、芥末黃、灰紫色、亮橘紅等） |
| 卡片內文字 | 純黑 #000000 |

### 字體
- 現代無襯線字體（Inter / Space Grotesk / Helvetica Neue）
- 核心數據極大且顯眼
- 分類標籤全大寫 ALL CAPS

### 組件
- 卡片：誇張大圓角（border-radius: 24px）
- 按鈕/標籤：膠囊形狀（Pill-shape）+ 1-2px 實線邊框
- 圖表極度簡化：
  - 進度條 = 純黑實心粗線
  - 柱狀圖 = 密集黑色幼直線（Barcode 效果）
  - 資產列表 = 純文字對齊，去背

## 技術方案
- **API**: Finnhub (free tier, 60 calls/min) — 股票/ETF/外匯
- **Crypto API**: CoinGecko (free) — Bitcoin
- **Frontend**: 靜態 HTML + CSS + JS（無框架）
- **圖表**: Chart.js（輕量）
- **Database**: localStorage（持倉記錄 + 歷史快照）
- **Hosting**: GitHub Pages（免費 subdomain）
- **貨幣基準**: HKD

## 數據結構
### Asset
```json
{
  "id": "uuid",
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "type": "us_stock",
  "category": "自定義分類ID",
  "quantity": 10,
  "currency": "USD"
}
```
### Category
```json
{
  "id": "uuid",
  "name": "增長",
  "color": "#B8E986"
}
```
### Price Cache
```json
{
  "symbol": "AAPL",
  "price": 192.50,
  "currency": "USD",
  "timestamp": 1717400000
}
```
### Daily Snapshot（用于日/月/年變化）
```json
{
  "date": "2026-06-03",
  "totalValueHKD": 1234567.89,
  "assets": { "uuid": { "priceHKD": 12345, "valueHKD": 123450 } }
}
```

## 待辦
- [ ] 註冊 Finnhub API key
- [ ] 決定分類顏色方案
- [ ] 第一版 prototype

## Changelog
| Date | Change |
|------|--------|
| 2026-06-03 | 初版 |
| 2026-06-03 | 加入 Neo-Brutalist Bento UI 規格、自定義分類、HKD 基準、日/月/年變化 |
