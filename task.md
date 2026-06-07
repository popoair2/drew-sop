# Task — Hacker/Terminal UI Redesign

## Goal
Redesign the entire Drew-Sop dashboard to match a terminal/hacker aesthetic:
black background, green monospace text, terminal-style components.

## Reference Style
- Pure black (#000000) background
- Matrix green (#00FF41) primary text + dim green (#003B00, #008F11) accents
- Monospace font (Courier New, monospace) for ALL text including data
- Terminal window aesthetic: command prompts, > prefixes, blinking cursors
- Progress bars instead of pie charts (CLI-style horizontal bars)
- ASCII/box-drawing borders (┌─┐│└─┘)
- Scanline / CRT subtle effects (optional, minimal)
- High contrast, no rounded corners (or very minimal)
- No colored card backgrounds — all on black with green borders
- Tab-style navigation mimicking terminal tabs
- Tables with box-drawing characters for borders
- Blinking cursor on "ACTIVE" indicators
- System log style for updates/errors

## Scope

### 1. CSS Complete Rewrite (`css/style.css`)
- New color system: black bg, green text palette
- Monospace font stack as primary
- Terminal-style cards (green border on black, no rounded corners)
- CLI-style progress bars replacing pie chart
- Terminal-style table rendering (box-drawing aesthetics)
- Remove all cream/beige/coral/mustard colors
- Remove Google Fonts Space Grotesk — use system monospace
- Scanline overlay effect (subtle, optional)
- Responsive adjustments maintained

### 2. HTML Modifications (`index.html`)
- Remove Google Fonts link
- Add monospace font styling
- Add scanline overlay div
- Update header to show "root@drew-sop:~#" style prompt
- Add terminal-style boot sequence animation on load
- Update SW version comment

### 3. JS Rendering Updates (`js/app.js`, `js/charts.js`)
- Pie chart → ASCII/terminal horizontal bar chart (no Chart.js for pie)
- Line chart stays (Chart.js) but restyled with green on black
- Add typewriter effect for loading states
- Update colors from cream/coral to green palette
- Add "last updated" as terminal timestamp
- Category legend → CLI progress bar style

### 4. Spec Update (`spec.md`)
- Update UI/UX section to reflect terminal style

## Files to Modify
- `css/style.css` — complete rewrite
- `index.html` — font + structural tweaks
- `js/charts.js` — restyle + replace pie with bar
- `js/app.js` — update renderers for terminal aesthetic
- `spec.md` — update UI spec

## Out of Scope
- No changes to `storage.js` or `api.js` (functionality unchanged)
- No changes to `utils.js` (formatting helpers unchanged)
