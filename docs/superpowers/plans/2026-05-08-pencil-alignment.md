# Pencil Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align all 4 app screens (Hub, Game, Leaderboard, Admin Dashboard) to match the Pencil design file `pencil-new.pen`.

**Architecture:** Pure visual/layout changes only — no logic, data fetching, routing, or test changes. Each task targets specific component files and is independently committable.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/components/hub/TopBar.tsx` | Remove `<Image>`, simplify fichas display to plain text |
| `src/app/page.tsx` | Add `ARCADE HUB` badge, `►` icon on button, `VER TUDO` links |
| `src/components/hub/RankingPreview.tsx` | Add `VER TUDO →` link in section header |
| `src/components/game/StatsBar.tsx` | Remove `lives` prop, 3-column layout: SCORE \| WAVE \| HI-SCORE |
| `src/components/game/BurgerInvaders.tsx` | Add game header row: `← SAIR` \| title \| `♥♥♥` |
| `src/app/ranking/page.tsx` | Remove `<TopBar>`, add compact `← VOLTAR \| RANKING \| GLOBAL` header |
| `src/components/ranking/LeaderboardTable.tsx` | Replace emoji medals with `#N`, dim entries outside topN, sticky current player at bottom |
| `src/app/admin/page.tsx` | Add `NOVA TEMPORADA` button, rename KPI labels, replace right panel with fichas rules |
| `src/components/admin/AdminSidebar.tsx` | Remove emoji icons from nav items |

---

## Task 1: TopBar — simplify fichas display

**Files:**
- Modify: `src/components/hub/TopBar.tsx`

- [ ] **Step 1: Replace the component**

Replace the full content of `src/components/hub/TopBar.tsx` with:

```tsx
'use client'

type Props = {
  fichasBalance: number
  onInsertFicha: () => void
}

export default function TopBar({ fichasBalance }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-bg sticky top-0 z-40">
      <span className="font-display text-secondary text-xl tracking-widest">
        90&apos;S BURGERS
      </span>
      <span className="font-display text-secondary text-lg tracking-wider">
        ★ {fichasBalance}
      </span>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/hub/TopBar.tsx
git commit -m "feat: topbar simplificada — texto + contagem de fichas sem botão"
```

---

## Task 2: Hub Hero — ARCADE HUB badge + ► icon + VER TUDO links

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/hub/RankingPreview.tsx`

- [ ] **Step 1: Update page.tsx hero section and section headers**

In `src/app/page.tsx`, replace the `<section>` hero block and the `<GameGrid>` + `<RankingPreview>` wrappers with:

```tsx
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <span className="bg-primary text-white font-display text-xs tracking-widest px-3 py-1 rounded mb-3 inline-block">
          ARCADE HUB
        </span>
        <h1 className="font-display text-secondary text-5xl sm:text-6xl tracking-widest leading-none mb-2">
          JOGAR E GANHAR
        </h1>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Jogue, suba no ranking e ganhe desconto no delivery enquanto estiver no top 3
        </p>
        <button
          onClick={handleInsertFicha}
          className="bg-primary hover:bg-red-700 active:scale-95 transition-all font-display text-white text-2xl tracking-widest px-8 py-3 rounded shadow-[0_0_20px_#b92526] flex items-center gap-2"
        >
          <span>►</span> INSERIR FICHA
        </button>
        {player && (
          <p className="text-gray-500 text-xs mt-3">
            Bem-vindo, <span className="text-secondary">{player.nickname}</span>!
          </p>
        )}
      </section>

      {/* Seus Jogos */}
      <div className="flex items-center justify-between px-4 max-w-lg mx-auto w-full mb-1">
        <h2 className="font-display text-tertiary text-xl tracking-widest">SEUS JOGOS</h2>
        <Link href="/ranking" className="font-display text-xs text-gray-400 hover:text-secondary tracking-wider transition-colors">
          VER TUDO →
        </Link>
      </div>
      <GameGrid games={games} />
```

Also add `import Link from 'next/link'` at the top if not present, and ensure the `<RankingPreview>` section header is removed from the page (it will be added in the component itself in Step 2).

The full updated `src/app/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import { useFichas } from '@/hooks/useFichas'
import { useRanking } from '@/hooks/useRanking'
import TopBar from '@/components/hub/TopBar'
import GameGrid from '@/components/hub/GameGrid'
import RankingPreview from '@/components/hub/RankingPreview'
import AuthModal from '@/components/hub/AuthModal'

export default function HomePage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showAuthModal, setShowAuthModal] = useState(false)
  const fichasBalance = useFichas(player?.id ?? null)
  const burgerInvadersGame = games.find((g) => g.slug === 'burger-invaders') ?? null
  const { ranking } = useRanking(burgerInvadersGame?.id ?? null)

  useEffect(() => {
    getCurrentPlayer().then(setPlayer)
    supabase
      .from('games')
      .select('*')
      .eq('active', true)
      .then(({ data }) => setGames((data as Game[]) ?? []))
  }, [])

  function handleInsertFicha() {
    if (!player) setShowAuthModal(true)
  }

  function handleAuthSuccess(p: Player) {
    setPlayer(p)
    setShowAuthModal(false)
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <TopBar fichasBalance={fichasBalance} onInsertFicha={handleInsertFicha} />

      <section className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <span className="bg-primary text-white font-display text-xs tracking-widest px-3 py-1 rounded mb-3 inline-block">
          ARCADE HUB
        </span>
        <h1 className="font-display text-secondary text-5xl sm:text-6xl tracking-widest leading-none mb-2">
          JOGAR E GANHAR
        </h1>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Jogue, suba no ranking e ganhe desconto no delivery enquanto estiver no top 3
        </p>
        <button
          onClick={handleInsertFicha}
          className="bg-primary hover:bg-red-700 active:scale-95 transition-all font-display text-white text-2xl tracking-widest px-8 py-3 rounded shadow-[0_0_20px_#b92526] flex items-center gap-2"
        >
          <span>►</span> INSERIR FICHA
        </button>
        {player && (
          <p className="text-gray-500 text-xs mt-3">
            Bem-vindo, <span className="text-secondary">{player.nickname}</span>!
          </p>
        )}
      </section>

      <div className="flex items-center justify-between px-4 max-w-lg mx-auto w-full mb-1">
        <h2 className="font-display text-tertiary text-xl tracking-widest">SEUS JOGOS</h2>
        <Link href="/ranking" className="font-display text-xs text-gray-400 hover:text-secondary tracking-wider transition-colors">
          VER TUDO →
        </Link>
      </div>
      <GameGrid games={games} />

      <RankingPreview
        entries={ranking}
        discountPct={burgerInvadersGame?.discount_pct ?? 10}
        topN={burgerInvadersGame?.top_n_discount ?? 3}
      />

      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Add VER TUDO to RankingPreview**

Replace full content of `src/components/hub/RankingPreview.tsx` with:

```tsx
import Link from 'next/link'
import DiscountBadge from '@/components/ui/DiscountBadge'
import type { RankingEntry } from '@/hooks/useRanking'

type Props = {
  entries: RankingEntry[]
  discountPct: number
  topN: number
}

export default function RankingPreview({ entries, discountPct, topN }: Props) {
  const preview = entries.slice(0, 2)

  return (
    <section className="px-4 pb-6 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-tertiary text-xl tracking-widest">RANKING</h2>
        <Link href="/ranking" className="font-display text-xs text-gray-400 hover:text-secondary tracking-wider transition-colors">
          VER TUDO →
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="text-center text-gray-500 text-sm">
          Nenhuma pontuação ainda. Seja o primeiro!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {preview.map((entry) => (
            <li
              key={entry.player_id}
              className="flex items-center justify-between bg-black border border-gray-800 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-gray-400 w-6">#{entry.position}</span>
                <span className="font-body text-white text-sm">
                  {entry.players?.nickname ?? 'Jogador'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {entry.score.toLocaleString('pt-BR')}
                </span>
                {Number(entry.position) <= topN && (
                  <DiscountBadge pct={discountPct} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/hub/RankingPreview.tsx
git commit -m "feat: hub home — badge ARCADE HUB, ícone ►, links VER TUDO"
```

---

## Task 3: Game Screen — header row com SAIR + título + vidas

**Files:**
- Modify: `src/components/game/StatsBar.tsx`
- Modify: `src/components/game/BurgerInvaders.tsx`

- [ ] **Step 1: Update StatsBar to 3 columns (remove lives)**

Replace full content of `src/components/game/StatsBar.tsx` with:

```tsx
type Props = {
  score: number
  wave: number
  hiScore: number
}

export default function StatsBar({ score, wave, hiScore }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black border-b border-gray-800 w-full">
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Score</span>
        <span className="font-display text-secondary text-xl tracking-wider">
          {score.toString().padStart(6, '0')}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Wave</span>
        <span className="font-display text-tertiary text-xl tracking-wider">{wave}</span>
      </div>
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Hi-Score</span>
        <span className="font-display text-primary text-xl tracking-wider">
          {hiScore.toString().padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add game header to BurgerInvaders**

Replace the `return` block in `src/components/game/BurgerInvaders.tsx` with:

```tsx
  return (
    <div className="flex flex-col items-center w-full">
      {/* Game header: SAIR | BURGER INVADERS | ♥♥♥ */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-black border-b border-gray-800">
        <button
          onClick={() => router.push('/')}
          className="font-display text-gray-400 hover:text-secondary text-sm tracking-widest transition-colors"
        >
          ← SAIR
        </button>
        <span className="font-display text-secondary text-base tracking-widest">
          BURGER INVADERS
        </span>
        <span className="text-primary text-lg tracking-widest">
          {'♥'.repeat(Math.max(0, displayState.lives))}
        </span>
      </div>

      <StatsBar
        score={displayState.score}
        wave={displayState.wave}
        hiScore={displayState.hiScore}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      <TouchControls onAction={touchAction} />
    </div>
  )
```

- [ ] **Step 3: Commit**

```bash
git add src/components/game/StatsBar.tsx src/components/game/BurgerInvaders.tsx
git commit -m "feat: game screen — header com SAIR/título/vidas, statsbar 3 colunas"
```

---

## Task 4: Leaderboard — header compacto + estilos da lista

**Files:**
- Modify: `src/app/ranking/page.tsx`
- Modify: `src/components/ranking/LeaderboardTable.tsx`

- [ ] **Step 1: Replace ranking page header**

Replace full content of `src/app/ranking/page.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import { useRanking } from '@/hooks/useRanking'
import LeaderboardTable from '@/components/ranking/LeaderboardTable'

export default function RankingPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const activeGame = games.find((g) => g.id === activeGameId) ?? null
  const { ranking, loading } = useRanking(activeGameId)

  useEffect(() => {
    async function init() {
      const [currentPlayer, { data: gamesData }] = await Promise.all([
        getCurrentPlayer(),
        supabase.from('games').select('*').eq('active', true),
      ])
      setPlayer(currentPlayer)
      const g = (gamesData as Game[]) ?? []
      setGames(g)
      if (g.length > 0) setActiveGameId(g[0].id)
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Compact header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-bg sticky top-0 z-40">
        <Link href="/" className="font-display text-gray-400 hover:text-secondary text-sm tracking-widest transition-colors">
          ← VOLTAR
        </Link>
        <span className="font-display text-secondary text-xl tracking-widest">
          🏆 RANKING
        </span>
        <span className="font-display text-gray-500 text-sm tracking-widest">
          GLOBAL
        </span>
      </header>

      <main className="flex flex-col items-center py-6 gap-4">
        {games.length > 1 && (
          <div className="flex gap-2">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGameId(g.id)}
                className={`font-display text-sm tracking-widest px-4 py-1.5 rounded border transition-colors ${
                  activeGameId === g.id
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {g.name.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <LeaderboardTable
          entries={ranking}
          currentPlayerId={player?.id ?? null}
          discountPct={activeGame?.discount_pct ?? 10}
          topN={activeGame?.top_n_discount ?? 3}
          loading={loading}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update LeaderboardTable styles**

Replace full content of `src/components/ranking/LeaderboardTable.tsx` with:

```tsx
'use client'

import DiscountBadge from '@/components/ui/DiscountBadge'
import type { RankingEntry } from '@/hooks/useRanking'

type Props = {
  entries: RankingEntry[]
  currentPlayerId: string | null
  discountPct: number
  topN: number
  loading: boolean
}

export default function LeaderboardTable({
  entries,
  currentPlayerId,
  discountPct,
  topN,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="font-display text-gray-500 text-xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        Nenhuma pontuação ainda. Seja o primeiro!
      </p>
    )
  }

  const currentEntry = entries.find((e) => e.player_id === currentPlayerId)
  const top10 = entries.slice(0, 10)
  const currentIsInTop10 = top10.some((e) => e.player_id === currentPlayerId)

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {currentEntry && (
        <div className="mb-4 bg-tertiary/10 border border-tertiary rounded px-4 py-2 text-center">
          <span className="font-display text-tertiary text-lg tracking-wider">
            SUA POSIÇÃO: #{currentEntry.position}
          </span>
          <span className="text-gray-400 text-sm ml-3">
            {currentEntry.score.toLocaleString('pt-BR')} pts
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {top10.map((entry) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId
          const hasDiscount = Number(entry.position) <= topN

          return (
            <li
              key={entry.player_id}
              className={`flex items-center justify-between rounded px-3 py-2 border transition-colors ${
                isCurrentPlayer
                  ? 'border-tertiary bg-tertiary/10'
                  : hasDiscount
                  ? 'border-secondary/40 bg-secondary/5'
                  : 'border-gray-800 bg-black opacity-70'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-gray-400 w-7 text-sm">
                  #{entry.position}
                </span>
                <span
                  className={`text-sm font-body ${
                    isCurrentPlayer ? 'text-tertiary font-semibold' : 'text-white'
                  }`}
                >
                  {entry.players?.nickname ?? 'Jogador'}
                  {isCurrentPlayer && (
                    <span className="text-xs text-gray-400 ml-1">(você)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {entry.score.toLocaleString('pt-BR')}
                </span>
                {hasDiscount && <DiscountBadge pct={discountPct} />}
              </div>
            </li>
          )
        })}

        {currentEntry && !currentIsInTop10 && (
          <>
            <li className="text-center text-gray-600 font-display text-sm py-1">· · ·</li>
            <li className="flex items-center justify-between rounded px-3 py-2 border border-tertiary bg-tertiary/10">
              <div className="flex items-center gap-3">
                <span className="font-display text-gray-400 w-7 text-sm">
                  #{currentEntry.position}
                </span>
                <span className="text-sm font-body text-tertiary font-semibold">
                  {currentEntry.players?.nickname ?? 'Jogador'}
                  <span className="text-xs text-gray-400 ml-1">(você)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {currentEntry.score.toLocaleString('pt-BR')}
                </span>
              </div>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/ranking/page.tsx src/components/ranking/LeaderboardTable.tsx
git commit -m "feat: leaderboard — header compacto VOLTAR/RANKING/GLOBAL, jogador fixo no fim"
```

---

## Task 5: Admin Dashboard — NOVA TEMPORADA + KPIs + painel de fichas

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Update admin dashboard page**

Replace full content of `src/app/admin/page.tsx` with:

```tsx
import Link from 'next/link'
import { KpiCard } from '@/components/admin/KpiCard'
import { getAdminKpis, getDashboardRanking } from '@/lib/admin/dashboard'
import { listFichaRules } from '@/lib/admin/fichas-admin'

export default async function AdminDashboardPage() {
  const [kpis, ranking, fichaRules] = await Promise.all([
    getAdminKpis(),
    getDashboardRanking(),
    listFichaRules(),
  ])

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">DASHBOARD</h1>
        <Link
          href="/admin/games"
          className="bg-[#b92526] hover:bg-red-700 text-white font-display text-sm tracking-widest px-4 py-2 rounded transition-colors"
        >
          NOVA TEMPORADA
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Jogadores" value={kpis.total_players} accent="yellow" />
        <KpiCard label="Fichas" value={kpis.total_fichas_distributed} accent="orange" />
        <KpiCard label="Descontos" value={kpis.active_discounts} accent="red" />
        <KpiCard label="Webhooks" value={kpis.total_webhook_orders} accent="yellow" />
      </div>

      {/* Two-panel row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: ranking */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">TOP RANKING</h2>
          {ranking.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhum score registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((row) => (
                <div
                  key={`${row.game_id}-${row.player_id}`}
                  className="flex items-center justify-between bg-[#0f0f0f] rounded px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-gray-400 w-6 text-sm">#{row.position}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{row.nickname}</p>
                      <p className="text-[#555] text-xs">{row.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#f0df5a] font-bold">{row.score.toLocaleString('pt-BR')}</p>
                    <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">
                      -10%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: fichas rules */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">FICHAS</h2>
          {fichaRules.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhuma regra configurada.</p>
          ) : (
            <div className="space-y-2">
              {fichaRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-[#0f0f0f] rounded px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm">
                      {rule.min_value === 0
                        ? 'Qualquer pedido'
                        : `Pedido acima de R$ ${rule.min_value}`}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5">
                      {rule.fichas_amount} {rule.fichas_amount === 1 ? 'FICHA' : 'FICHAS'}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-display px-2 py-0.5 rounded ${
                      rule.active
                        ? 'bg-green-900 text-green-400'
                        : 'bg-[#222] text-[#555]'
                    }`}
                  >
                    {rule.active ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/fichas"
            className="mt-4 block text-center font-display text-xs text-gray-500 hover:text-secondary tracking-wider transition-colors"
          >
            GERENCIAR FICHAS →
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove emoji icons from AdminSidebar nav items**

In `src/components/admin/AdminSidebar.tsx`, update the `NAV_ITEMS` array and remove the `icon` rendering:

```tsx
const NAV_ITEMS = [
  { href: '/admin', label: 'DASHBOARD' },
  { href: '/admin/players', label: 'PLAYERS' },
  { href: '/admin/games', label: 'GAMES' },
  { href: '/admin/fichas', label: 'FICHAS' },
  { href: '/admin/saipos', label: 'SAIPOS' },
]
```

And update the link render inside `nav`:

```tsx
<Link key={href} href={href}
  className={`flex items-center px-4 py-3 font-display text-sm tracking-widest transition-colors ${
    isActive ? 'bg-primary text-white' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
  }`}>
  {label}
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/AdminSidebar.tsx
git commit -m "feat: admin dashboard — botão NOVA TEMPORADA, KPIs PT, painel de fichas"
```

---

## Task 6: Verificação final

- [ ] **Step 1: Build sem erros**

```bash
cd /home/elias-santos/repos/game-90s && npm run build 2>&1 | tail -20
```

Expected: `Route (app)` table printed, no TypeScript/lint errors.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit final se necessário**

Se houver pequenos ajustes de tipos:

```bash
git add -p
git commit -m "fix: ajustes de tipo pós-alinhamento Pencil"
```
