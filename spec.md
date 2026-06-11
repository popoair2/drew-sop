# Drew-Sop Spec — UI Theme System

## 目標
將現有「Hacker Terminal」UI 重新架構為可切換嘅主題系統，方便日後加入新主題。

## 架構

### 主題引擎 (`js/themes.js`)
- `ThemeEngine` class：管理主題註冊、切換、持久化
- 主題定義為 JSON object，包含所有 CSS 變數
- 支援 `localStorage` 持久化（key: `ds_theme`）
- API: `ThemeEngine.init()`, `ThemeEngine.apply(name)`, `ThemeEngine.list()`, `ThemeEngine.current()`

### CSS 變數重构 (`css/style.css`)
- 將所有寫死嘅顏色/字體/間距值提取為 CSS custom properties (`--var-name`)
- 以 `[data-theme="xxx"]` selector 分組
- 預設主題：`hacker-terminal`
- 根層級 variables 作為 fallback

### 主題列表（初版）
1. **hacker-terminal** — 而家嘅 Matrix green on black
2. **paper-light** — 淺色清潔主題（白色背景、深色文字、藍色 accent）

### 切換 UI
- Settings 卡入面加 `theme_switcher` 組件
- CLI-style 按鈕 list：`[1] hacker-terminal  [2] paper-light`
- 用家揀完即刻生效 + 寫入 localStorage

### 版本
- 當前 cache: v15 → 今次要升到 v16

## 檔案變動
| File | Change |
|------|--------|
| css/style.css | 全面重构為 CSS variables |
| js/themes.exe | 新增 — 主題引擎 + 定義 |
| index.html | 加 theme switcher UI + `<script src>` |
| js/app.js | 整合 ThemeEngine init + switcher events |
| sw.js | Cache v16 |

## 向後兼容
- 冇 localStorage theme record 嘅用家預設顯示 hacker-terminal
- 所有現有功能（modals、charts、boot sequence）不受影響
