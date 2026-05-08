# Pencil Design Alignment — game-90s

**Date:** 2026-05-08  
**Source:** `/home/elias-santos/repos/game-90s/pencil-new.pen`  
**Scope:** Align all 4 screens to match the Pencil design file exactly.

---

## Overview

The application was built with correct logic and routing but the visual UI diverges from the Pencil designs. This spec describes every visual/layout change needed per screen. No logic, data fetching, or routing changes are required.

---

## Screen 01 — Hub Home (`src/app/page.tsx` + hub components)

### TopBar (`src/components/hub/TopBar.tsx`)
- Remove the `<Image>` logo component
- Left side: `90'S BURGERS` in `font-display text-secondary` (already present, keep)
- Right side: Replace the `<button>` with a plain display element: `★ {fichasBalance}` in yellow — not interactive (the fichas count is informational, the INSERIR FICHA button is in the hero)
- Keep `sticky top-0 z-40` and bottom border

### Hero Section (`src/app/page.tsx`)
- Above the `<h1>`, add a red label pill: `ARCADE HUB` — small caps, red bg (`bg-primary`), white text, rounded, inline
- Title stays: `JOGAR E GANHAR` in `font-display text-secondary`
- Button: prepend `► ` play icon before `INSERIR FICHA`
- If player is logged in, show welcome text below button (already implemented)

### GameGrid section header (`src/app/page.tsx` or `GameGrid`)
- Section header row: `SEUS JOGOS` on the left + `VER TUDO →` link (`href="/ranking"`) on the right (no dedicated games page exists yet)
- Header text in `font-display text-tertiary`
- "VER TUDO" in smaller `text-xs text-gray-400 hover:text-secondary`

### RankingPreview section header (`src/components/hub/RankingPreview.tsx`)
- Section header row: `RANKING` on the left + `VER TUDO →` link (`href="/ranking"`) on the right
- Same style pattern as GameGrid header

---

## Screen 02 — Game Screen (`src/components/game/BurgerInvaders.tsx` + `StatsBar.tsx`)

### Game Header row (new — above StatsBar)
- New row at top of the game component with 3 zones:
  - Left: `← SAIR` link (navigates to `/`) in `font-display text-gray-400 hover:text-secondary`
  - Center: `BURGER INVADERS` in `font-display text-secondary tracking-widest`
  - Right: heart icons `♥` repeated `lives` times in `text-primary`
- Background: black, bottom border `border-gray-800`

### StatsBar (`src/components/game/StatsBar.tsx`)
- Remove `Vidas` column (lives move to header)
- Reorganize to 3 equal columns: `SCORE | WAVE | HI-SCORE`
- Remove `lives` prop (no longer needed in StatsBar)
- Pass `lives` to the new header row instead

---

## Screen 03 — Leaderboard (`src/app/ranking/page.tsx` + `LeaderboardTable.tsx`)

### Page header
- Remove `<TopBar>` from ranking page
- Replace with a compact header bar (full width, dark bg, bottom border):
  - Left: `← VOLTAR` link to `/` in `font-display text-gray-400`
  - Center: `🏆 RANKING` in `font-display text-secondary`
  - Right: `GLOBAL` label in `font-display text-gray-500 text-sm`

### Current player position banner
- Keep the existing "SUA POSIÇÃO: #N" banner
- Add score display inside the banner: `#47 — 12.840 pts`

### Leaderboard list
- Top `topN` entries: highlighted with `border-secondary bg-secondary/5`, discount badge
- Entries below topN: dimmer style `border-gray-800 bg-black opacity-70`
- If current player is outside top 10, append them at the bottom after a visual separator `···`
- Remove emoji medals (🥇🥈🥉), use `#1 #2 #3` in `font-display` instead (matches Pencil design)

---

## Screen 04 — Admin Dashboard (`src/app/admin/page.tsx` + `AdminSidebar.tsx`)

### Page header area
- Add `NOVA TEMPORADA` button (currently missing) to the page header, right-aligned
- Header layout: `DASHBOARD` title on the left + `NOVA TEMPORADA` red button (`bg-primary font-display`) on the right (flex justify-between)
- Button links to `/admin/games` where seasons are managed

### KPI cards (`src/components/admin/KpiCard.tsx`)
- Rename labels: `Total Players` → `Jogadores`, `Fichas Distribuídas` → `Fichas`, `Descontos Ativos` → `Admins`, `Webhooks Recebidos` → `Webhooks`
- The `Admins` KPI currently maps to `active_discounts` — this needs to be verified; if the metric is wrong, swap the data source to a count of admin users

### Right panel — Fichas rules
- Replace the Saipos webhook status panel with a `FICHAS` rules panel that shows each active ficha rule as a card: `Qualquer pedido → N FICHA(S)`, with a green/red badge for active/inactive
- Keep the Saipos panel as a separate section below (or in its own admin page)

### Sidebar (`src/components/admin/AdminSidebar.tsx`)
- Remove emoji icons from nav items — design shows text-only nav links
- Active state: `bg-primary text-white` (already correct)
- Sidebar header: logo image stays, `ADMIN PANEL` subtitle stays

---

## What does NOT change
- All data fetching, API routes, Supabase queries, hooks, game engine logic
- Routing structure
- Admin sub-pages (Players, Games, Fichas, Saipos) — only Dashboard is in scope per the Pencil file
- Auth flow
- Game-over page

---

## Implementation order
1. TopBar
2. Hub Hero + section headers
3. Game header + StatsBar
4. Leaderboard page header + list styling
5. Admin Dashboard header + KPIs + right panel
