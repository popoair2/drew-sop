# Drew-Sop Task — UI Theme System

## 當前任務：UI 主題切換功能

### Status: IN PROGRESS
### Started: 2026-06-12

### Steps
- [x] 1. Plan architecture
- [ ] 2. Refactor css/style.css → CSS variables
- [ ] 3. Create js/themes.js — ThemeEngine + theme definitions
- [ ] 4. Update index.html — theme switcher in settings + script tag
- [ ] 5. Update js/app.js — integrate ThemeEngine
- [ ] 6. Update sw.js cache version to v16
- [ ] 7. Test all themes

### Decisions
- Theme engine: custom lightweight class (no dependency)
- Persistence: localStorage key `ds_theme`
- Default theme: `hacker-terminal`
- CSS approach: `[data-theme]` attribute on `<html>` element
- Initial themes: hacker-terminal, paper-light

### Blockers
- None
