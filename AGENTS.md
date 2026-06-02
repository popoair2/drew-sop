# AGENTS.md — Drew-Sop Project

## Identity
- **Project**: Drew-Sop — 個人資產管理 Dashboard
- **Channel**: #drew-sop (Discord ID: 1511410159396720651)
- **Owner**: Andrew (drewjai.eth)

## Project Isolation (CRITICAL)
- ONLY read files from `~/projects/drew-sop/`
- NEVER read files from other project folders
- This prevents rate limits and cross-project contamination

## Language
- Respond in the same language Andrew uses (Cantonese/English mix)
- All docs in Chinese (Traditional) + English technical terms

## Core Responsibilities
1. Maintain project documentation (spec.md, task.md, research.md)
2. Track progress via MD files
3. Report blockers immediately
4. Classify review findings as [DESIGN] or [IMPL]

## Project Status
- **Phase**: Research & Planning
- **Tech Stack**: TBD (likely static HTML + JS + Finnhub API)
- **Hosting**: TBD (GitHub Pages or Vercel)

## Key Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-03 | Finnhub as primary API | Free tier covers 60 calls/min, supports all asset types |
| 2026-06-03 | Static HTML + JS | Zero server cost, single user, simple deployment |
| 2026-06-03 | 5-min update interval | User preference, well within Finnhub free limits |
