# 90s Burgers — Plano 1: Foundation + Player Hub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffoldar o projeto Next.js 14, configurar Supabase, implementar auth anônima com cadastro de jogador, e entregar as quatro telas do hub (Home, Burger Invaders, Game Over, Leaderboard) com o jogo funcional.

**Architecture:** Next.js 14 App Router com Supabase para auth anônima, banco de dados e Realtime. O jogo roda em canvas HTML5 puro com `requestAnimationFrame`; a engine fica em `lib/game/` completamente desacoplada de React, e o componente `BurgerInvaders.tsx` apenas monta o canvas e repassa input. Scores são persistidos no Supabase ao final de cada partida via `lib/scores.ts`.

**Tech Stack:** Next.js 14 (App Router), Supabase JS v2, Tailwind CSS, Bangers (Google Fonts), TypeScript, Vitest + @testing-library/react

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/001_initial.sql` | DDL completo (tabelas + views) |
| `src/lib/supabase.ts` | Singleton do cliente Supabase (browser + server) |
| `src/lib/scores.ts` | `saveScore`, `getPlayerBestScore` |
| `src/lib/fichas.ts` | `getFichaBalance` (soma de fichas do player) |
| `src/lib/game/engine.ts` | Estado puro do jogo: `createGameState`, `tickGame`, tipos |
| `src/lib/game/renderer.ts` | Desenho no canvas: `renderFrame` |
| `src/lib/game/input.ts` | Mapeamento de teclas/touch para ações |
| `src/hooks/useGameLoop.ts` | RAF loop + integração engine |
| `src/hooks/useFichas.ts` | Realtime subscription + saldo de fichas |
| `src/hooks/useRanking.ts` | Busca ranking por game_id |
| `src/components/ui/DiscountBadge.tsx` | Badge `-10%` reutilizável |
| `src/components/hub/TopBar.tsx` | Logo + saldo de fichas |
| `src/components/hub/GameGrid.tsx` | Grid 2×2 de games |
| `src/components/hub/RankingPreview.tsx` | Preview top 2 com badges |
| `src/components/hub/AuthModal.tsx` | Modal cadastro nickname + telefone |
| `src/components/game/StatsBar.tsx` | Barra SCORE / WAVE / HI-SCORE |
| `src/components/game/TouchControls.tsx` | Botões ◀ FIRE ▶ |
| `src/components/game/BurgerInvaders.tsx` | Canvas + loop + input wiring |
| `src/components/ranking/LeaderboardTable.tsx` | Tabela com tabs, destaques e badges |
| `src/app/layout.tsx` | Root layout (fontes, CSS global, providers) |
| `src/app/page.tsx` | Hub Home `/` |
| `src/app/games/burger-invaders/page.tsx` | Tela do jogo |
| `src/app/games/burger-invaders/game-over/page.tsx` | Tela Game Over |
| `src/app/ranking/page.tsx` | Leaderboard |

---

## Task 1: Scaffold do Projeto Next.js

**Files:**
- Create: `package.json` (via `create-next-app`)
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Criar o projeto**

```bash
cd /home/elias-santos/repos/game-90s
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Expected: projeto criado, `src/app/layout.tsx` existe.

- [ ] **Step 2: Instalar dependências**

```bash
npm install @supabase/supabase-js@2
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `node_modules/@supabase` e `node_modules/vitest` presentes.

- [ ] **Step 3: Configurar Vitest**

Criar `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Criar `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Adicionar script de teste ao package.json**

Abrir `package.json` e adicionar em `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configurar Tailwind com tokens de cor e fonte Bangers**

Substituir `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#b92526',
        secondary: '#f0df5a',
        tertiary: '#ec9837',
        bg: '#0a0a0a',
      },
      fontFamily: {
        display: ['var(--font-bangers)', 'cursive'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 6: Atualizar root layout com fontes e background**

Substituir `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Bangers, Inter } from 'next/font/google'
import './globals.css'

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '90s Burgers Game Hub',
  description: 'Jogue, suba no ranking e ganhe descontos!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${bangers.variable} ${inter.variable} bg-bg text-white font-body min-h-screen`}
      >
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Atualizar globals.css**

Substituir `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: #0a0a0a;
  color: white;
}
```

- [ ] **Step 8: Verificar que o app sobe**

```bash
npm run dev &
sleep 4
curl -s http://localhost:3000 | grep -o '<html' | head -1
kill %1
```

Expected: `<html`

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 + Tailwind + Vitest"
```

---

## Task 2: Migration SQL do Supabase

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Criar diretório de migrations**

```bash
mkdir -p /home/elias-santos/repos/game-90s/supabase/migrations
```

- [ ] **Step 2: Escrever migration completa**

Criar `supabase/migrations/001_initial.sql`:

```sql
-- Tabela de jogadores (leads)
CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname    text UNIQUE NOT NULL,
  phone       text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Tabela de jogos
CREATE TABLE IF NOT EXISTS games (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  active          boolean DEFAULT false,
  top_n_discount  int DEFAULT 3,
  discount_pct    int DEFAULT 10,
  season          int DEFAULT 1
);

-- Tabela de pontuações
CREATE TABLE IF NOT EXISTS scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE,
  game_id     uuid REFERENCES games(id) ON DELETE CASCADE,
  score       int NOT NULL,
  wave        int,
  season      int NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

-- Tabela de fichas (créditos/débitos)
CREATE TABLE IF NOT EXISTS fichas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE,
  amount      int NOT NULL,
  reason      text,
  ref_id      text,
  created_at  timestamptz DEFAULT now()
);

-- View: melhor score por player por temporada ativa
CREATE OR REPLACE VIEW ranking AS
  WITH best AS (
    SELECT s.game_id, s.player_id, MAX(s.score) AS score
    FROM scores s
    JOIN games g ON g.id = s.game_id
    WHERE s.season = g.season
    GROUP BY s.game_id, s.player_id
  )
  SELECT
    game_id,
    player_id,
    score,
    RANK() OVER (PARTITION BY game_id ORDER BY score DESC) AS position
  FROM best;

-- View: descontos ativos
CREATE OR REPLACE VIEW active_discounts AS
  SELECT r.player_id, r.game_id, g.discount_pct
  FROM ranking r
  JOIN games g ON g.id = r.game_id
  WHERE r.position <= g.top_n_discount
    AND g.active = true;

-- Seed: jogo Burger Invaders
INSERT INTO games (name, slug, active, top_n_discount, discount_pct, season)
VALUES ('Burger Invaders', 'burger-invaders', true, 3, 10, 1)
ON CONFLICT (slug) DO NOTHING;

-- RLS: habilitar
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policies: leitura pública de games
CREATE POLICY "games_public_read" ON games FOR SELECT USING (true);

-- Policies: jogador vê e insere seus próprios dados
CREATE POLICY "players_self" ON players FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "scores_self_insert" ON scores FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "scores_public_read" ON scores FOR SELECT USING (true);

CREATE POLICY "fichas_self_read" ON fichas FOR SELECT
  USING (player_id = auth.uid());
```

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase migration DDL with tables, views, RLS"
```

---

## Task 3: Variáveis de Ambiente e Cliente Supabase

**Files:**
- Create: `.env.local` (não commitado)
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Criar .env.local**

Criar `.env.local` com as credenciais do projeto Supabase (substituir pelos valores reais do dashboard):

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

- [ ] **Step 2: Adicionar .env.local ao .gitignore**

Abrir `.gitignore` e garantir que existe a linha:

```
.env.local
```

- [ ] **Step 3: Escrever cliente Supabase**

Criar `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'burgers-hub-session',
  },
})

export type Player = {
  id: string
  nickname: string
  phone: string
  created_at: string
}

export type Game = {
  id: string
  name: string
  slug: string
  active: boolean
  top_n_discount: number
  discount_pct: number
  season: number
}

export type Score = {
  id: string
  player_id: string
  game_id: string
  score: number
  wave: number | null
  season: number
  created_at: string
}

export type Ficha = {
  id: string
  player_id: string
  amount: number
  reason: string | null
  ref_id: string | null
  created_at: string
}

export type RankingRow = {
  game_id: string
  player_id: string
  score: number
  position: number
}
```

- [ ] **Step 4: Escrever teste do cliente**

Criar `src/lib/__tests__/supabase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws when env vars are missing', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    await expect(import('../supabase')).rejects.toThrow(
      'Missing NEXT_PUBLIC_SUPABASE_URL'
    )

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('exports supabase client when env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

    const { supabase } = await import('../supabase')
    expect(supabase).toBeDefined()
    expect(typeof supabase.from).toBe('function')
  })
})
```

- [ ] **Step 5: Rodar o teste**

```bash
npm test src/lib/__tests__/supabase.test.ts
```

Expected: 2 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/__tests__/supabase.test.ts vitest.config.ts vitest.setup.ts
git commit -m "feat: add Supabase client + types"
```

---

## Task 4: Auth Anônima + Cadastro de Player

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`
- Create: `src/components/hub/AuthModal.tsx`

- [ ] **Step 1: Escrever testes para auth.ts**

Criar `src/lib/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignInAnonymously = vi.fn()
const mockFrom = vi.fn()

vi.mock('../supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously },
    from: mockFrom,
  },
}))

import { signInAnonymouslyAndRegister, getCurrentPlayer } from '../auth'

describe('signInAnonymouslyAndRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when signInAnonymously fails', async () => {
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'auth error' },
    })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toBe('auth error')
    expect(result.player).toBeNull()
  })

  it('inserts player and returns it on success', async () => {
    const fakeUser = { id: 'uuid-123' }
    const fakePlayer = { id: 'uuid-123', nickname: 'Tester', phone: '81999990000', created_at: '2026-05-08' }

    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: fakePlayer, error: null }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toBeNull()
    expect(result.player?.nickname).toBe('Tester')
  })

  it('returns error when nickname already exists', async () => {
    const fakeUser = { id: 'uuid-456' }
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toMatch(/já está em uso/)
  })
})

describe('getCurrentPlayer', () => {
  it('returns null when no session', async () => {
    const mockGetUser = vi.fn().mockResolvedValueOnce({ data: { user: null } })
    vi.mock('../supabase', () => ({
      supabase: {
        auth: { getUser: mockGetUser },
        from: mockFrom,
      },
    }))
    const result = await getCurrentPlayer()
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar falha**

```bash
npm test src/lib/__tests__/auth.test.ts
```

Expected: FAIL — `Cannot find module '../auth'`

- [ ] **Step 3: Implementar auth.ts**

Criar `src/lib/auth.ts`:

```typescript
import { supabase, Player } from './supabase'

export type AuthResult = {
  player: Player | null
  error: string | null
}

export async function signInAnonymouslyAndRegister(
  nickname: string,
  phone: string
): Promise<AuthResult> {
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously()

  if (authError || !authData.user) {
    return { player: null, error: authError?.message ?? 'Erro de autenticação' }
  }

  const { data: player, error: insertError } = await supabase
    .from('players')
    .insert({ id: authData.user.id, nickname: nickname.trim(), phone: phone.trim() })
    .select()
    .single()

  if (insertError) {
    const isDuplicate = insertError.message.includes('duplicate key')
    return {
      player: null,
      error: isDuplicate
        ? 'Nickname ou telefone já está em uso'
        : insertError.message,
    }
  }

  return { player: player as Player, error: null }
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Player | null
}
```

- [ ] **Step 4: Rodar testes novamente**

```bash
npm test src/lib/__tests__/auth.test.ts
```

Expected: todos os testes passando

- [ ] **Step 5: Implementar AuthModal.tsx**

Criar `src/components/hub/AuthModal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { signInAnonymouslyAndRegister } from '@/lib/auth'
import type { Player } from '@/lib/supabase'

type Props = {
  onSuccess: (player: Player) => void
  onClose: () => void
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || !phone.trim()) {
      setError('Preencha nickname e telefone')
      return
    }
    setLoading(true)
    setError(null)
    const { player, error: authError } = await signInAnonymouslyAndRegister(
      nickname,
      phone
    )
    setLoading(false)
    if (authError) {
      setError(authError)
      return
    }
    if (player) onSuccess(player)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border-2 border-secondary w-full max-w-sm p-6 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-secondary text-3xl text-center mb-1 tracking-wider">
          INSERIR FICHA
        </h2>
        <p className="text-center text-gray-400 text-sm mb-6">
          Cadastre-se para entrar no ranking
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="SeuNome"
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
              WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(81) 99999-0000"
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-secondary"
            />
          </div>

          {error && (
            <p className="text-primary text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-red-700 disabled:opacity-50 text-white font-display text-xl tracking-wider py-2 rounded transition-colors"
          >
            {loading ? 'AGUARDE...' : 'JOGAR'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts src/components/hub/AuthModal.tsx
git commit -m "feat: anonymous auth + player registration modal"
```

---

## Task 5: Fichas — Saldo em Tempo Real

**Files:**
- Create: `src/lib/fichas.ts`
- Create: `src/lib/__tests__/fichas.test.ts`
- Create: `src/hooks/useFichas.ts`

- [ ] **Step 1: Escrever teste de getFichaBalance**

Criar `src/lib/__tests__/fichas.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const mockFrom = vi.fn()
vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}))

import { getFichaBalance } from '../fichas'

describe('getFichaBalance', () => {
  it('returns sum of amounts for a player', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ amount: 3 }, { amount: -1 }, { amount: 5 }],
        error: null,
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(7)
  })

  it('returns 0 when no fichas exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(0)
  })

  it('returns 0 on error', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/lib/__tests__/fichas.test.ts
```

Expected: FAIL — `Cannot find module '../fichas'`

- [ ] **Step 3: Implementar fichas.ts**

Criar `src/lib/fichas.ts`:

```typescript
import { supabase } from './supabase'

export async function getFichaBalance(playerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('fichas')
    .select('amount')
    .eq('player_id', playerId)

  if (error || !data) return 0
  return data.reduce((sum, row) => sum + row.amount, 0)
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/lib/__tests__/fichas.test.ts
```

Expected: 3 tests passing

- [ ] **Step 5: Implementar useFichas.ts**

Criar `src/hooks/useFichas.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFichaBalance } from '@/lib/fichas'

export function useFichas(playerId: string | null) {
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    if (!playerId) {
      setBalance(0)
      return
    }

    getFichaBalance(playerId).then(setBalance)

    const channel = supabase
      .channel(`fichas:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fichas',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          getFichaBalance(playerId).then(setBalance)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId])

  return balance
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/fichas.ts src/lib/__tests__/fichas.test.ts src/hooks/useFichas.ts
git commit -m "feat: fichas balance + realtime hook"
```

---

## Task 6: Engine do Jogo (lógica pura)

**Files:**
- Create: `src/lib/game/engine.ts`
- Create: `src/lib/game/__tests__/engine.test.ts`

- [ ] **Step 1: Escrever testes da engine**

Criar `src/lib/game/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  createGameState,
  tickGame,
  movePlayer,
  fireBullet,
  ENEMY_ROWS,
  ENEMY_COLS,
  SCORE_BY_ROW,
  type GameState,
  type GameAction,
} from '../engine'

describe('createGameState', () => {
  it('creates grid with correct number of enemies', () => {
    const state = createGameState(800, 600)
    const aliveEnemies = state.enemies.filter((e) => e.alive)
    expect(aliveEnemies.length).toBe(ENEMY_ROWS * ENEMY_COLS)
  })

  it('starts with 3 lives', () => {
    const state = createGameState(800, 600)
    expect(state.lives).toBe(3)
  })

  it('starts with score 0', () => {
    const state = createGameState(800, 600)
    expect(state.score).toBe(0)
  })

  it('starts with gameStatus playing', () => {
    const state = createGameState(800, 600)
    expect(state.gameStatus).toBe('playing')
  })
})

describe('movePlayer', () => {
  it('moves player left', () => {
    const state = createGameState(800, 600)
    const initialX = state.player.x
    const next = movePlayer(state, 'left')
    expect(next.player.x).toBeLessThan(initialX)
  })

  it('moves player right', () => {
    const state = createGameState(800, 600)
    const initialX = state.player.x
    const next = movePlayer(state, 'right')
    expect(next.player.x).toBeGreaterThan(initialX)
  })

  it('does not move player past left edge', () => {
    const state = createGameState(800, 600)
    let s = state
    for (let i = 0; i < 200; i++) s = movePlayer(s, 'left')
    expect(s.player.x).toBeGreaterThanOrEqual(0)
  })

  it('does not move player past right edge (800px wide)', () => {
    const state = createGameState(800, 600)
    let s = state
    for (let i = 0; i < 200; i++) s = movePlayer(s, 'right')
    expect(s.player.x + s.player.width).toBeLessThanOrEqual(800)
  })
})

describe('fireBullet', () => {
  it('adds a bullet to state', () => {
    const state = createGameState(800, 600)
    const next = fireBullet(state)
    expect(next.bullets.length).toBe(1)
  })

  it('bullet starts above the player', () => {
    const state = createGameState(800, 600)
    const next = fireBullet(state)
    expect(next.bullets[0].y).toBeLessThan(state.player.y)
  })

  it('does not add a second bullet when one is already active', () => {
    const state = createGameState(800, 600)
    const s1 = fireBullet(state)
    const s2 = fireBullet(s1)
    expect(s2.bullets.length).toBe(1)
  })
})

describe('tickGame — bullet collision', () => {
  it('kills an enemy and increases score when bullet hits', () => {
    const state = createGameState(800, 600)
    // put a bullet directly on first enemy
    const firstEnemy = state.enemies[0]
    const stateWithBullet: GameState = {
      ...state,
      bullets: [
        {
          id: 'b1',
          x: firstEnemy.x,
          y: firstEnemy.y,
          width: 4,
          height: 10,
          active: true,
          owner: 'player',
          vy: -8,
        },
      ],
    }
    const next = tickGame(stateWithBullet, 16)
    const killedEnemy = next.enemies.find((e) => e.id === firstEnemy.id)
    expect(killedEnemy?.alive).toBe(false)
    expect(next.score).toBeGreaterThan(0)
  })
})

describe('SCORE_BY_ROW', () => {
  it('row 0 (aliens) = 30', () => expect(SCORE_BY_ROW[0]).toBe(30))
  it('row 1 (burgers) = 20', () => expect(SCORE_BY_ROW[1]).toBe(20))
  it('row 2 (batatas) = 10', () => expect(SCORE_BY_ROW[2]).toBe(10))
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/lib/game/__tests__/engine.test.ts
```

Expected: FAIL — `Cannot find module '../engine'`

- [ ] **Step 3: Implementar engine.ts**

Criar `src/lib/game/engine.ts`:

```typescript
export const ENEMY_ROWS = 3
export const ENEMY_COLS = 6
export const SCORE_BY_ROW: Record<number, number> = { 0: 30, 1: 20, 2: 10 }

const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const ENEMY_BULLET_SPEED = 4
const ENEMY_STEP_X = 12
const ENEMY_STEP_Y = 20
const ENEMY_W = 40
const ENEMY_H = 32
const ENEMY_GAP_X = 16
const ENEMY_GAP_Y = 12
const PLAYER_W = 48
const PLAYER_H = 36

export type GameStatus = 'playing' | 'gameover' | 'wave_clear'

export type Enemy = {
  id: string
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  alive: boolean
}

export type Bullet = {
  id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  owner: 'player' | 'enemy'
  vy: number
}

export type Player = {
  x: number
  y: number
  width: number
  height: number
}

export type GameState = {
  canvasWidth: number
  canvasHeight: number
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  lives: number
  score: number
  hiScore: number
  wave: number
  gameStatus: GameStatus
  enemyDir: 1 | -1
  enemyMoveTimer: number
  enemyMoveInterval: number
  enemyShootTimer: number
  enemyShootInterval: number
}

export type GameAction = 'left' | 'right' | 'fire' | 'none'

function buildEnemies(canvasWidth: number): Enemy[] {
  const totalW = ENEMY_COLS * (ENEMY_W + ENEMY_GAP_X) - ENEMY_GAP_X
  const startX = Math.floor((canvasWidth - totalW) / 2)
  const startY = 60
  const enemies: Enemy[] = []
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        id: `e${row}-${col}`,
        row,
        col,
        x: startX + col * (ENEMY_W + ENEMY_GAP_X),
        y: startY + row * (ENEMY_H + ENEMY_GAP_Y),
        width: ENEMY_W,
        height: ENEMY_H,
        alive: true,
      })
    }
  }
  return enemies
}

export function createGameState(canvasWidth: number, canvasHeight: number): GameState {
  return {
    canvasWidth,
    canvasHeight,
    player: {
      x: Math.floor(canvasWidth / 2 - PLAYER_W / 2),
      y: canvasHeight - PLAYER_H - 16,
      width: PLAYER_W,
      height: PLAYER_H,
    },
    enemies: buildEnemies(canvasWidth),
    bullets: [],
    lives: 3,
    score: 0,
    hiScore: 0,
    wave: 1,
    gameStatus: 'playing',
    enemyDir: 1,
    enemyMoveTimer: 0,
    enemyMoveInterval: 800,
    enemyShootTimer: 0,
    enemyShootInterval: 2000,
  }
}

export function movePlayer(state: GameState, direction: 'left' | 'right'): GameState {
  const dx = direction === 'left' ? -PLAYER_SPEED : PLAYER_SPEED
  const newX = Math.max(
    0,
    Math.min(state.canvasWidth - state.player.width, state.player.x + dx)
  )
  return { ...state, player: { ...state.player, x: newX } }
}

export function fireBullet(state: GameState): GameState {
  const playerBullets = state.bullets.filter(
    (b) => b.owner === 'player' && b.active
  )
  if (playerBullets.length > 0) return state

  const bullet: Bullet = {
    id: `pb-${Date.now()}`,
    x: state.player.x + state.player.width / 2 - 2,
    y: state.player.y - 10,
    width: 4,
    height: 10,
    active: true,
    owner: 'player',
    vy: -BULLET_SPEED,
  }
  return { ...state, bullets: [...state.bullets, bullet] }
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export function tickGame(state: GameState, deltaMs: number): GameState {
  if (state.gameStatus !== 'playing') return state

  let { bullets, enemies, lives, score, hiScore, wave,
    enemyDir, enemyMoveTimer, enemyMoveInterval,
    enemyShootTimer, enemyShootInterval, player } = state

  // move bullets
  bullets = bullets
    .map((b) => ({ ...b, y: b.y + b.vy }))
    .filter((b) => b.y + b.height > 0 && b.y < state.canvasHeight)

  // bullet × enemy collision
  let newScore = score
  const hitEnemyIds = new Set<string>()
  const remainingBullets: Bullet[] = []

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      remainingBullets.push(bullet)
      continue
    }
    let hit = false
    for (const enemy of enemies) {
      if (!enemy.alive) continue
      if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        hitEnemyIds.add(enemy.id)
        newScore += SCORE_BY_ROW[enemy.row] ?? 10
        hit = true
        break
      }
    }
    if (!hit) remainingBullets.push(bullet)
  }

  enemies = enemies.map((e) =>
    hitEnemyIds.has(e.id) ? { ...e, alive: false } : e
  )
  bullets = remainingBullets

  const newHiScore = Math.max(hiScore, newScore)

  // enemy bullet × player collision
  let newLives = lives
  const survivingEnemyBullets: Bullet[] = []
  for (const bullet of bullets) {
    if (bullet.owner !== 'enemy') {
      survivingEnemyBullets.push(bullet)
      continue
    }
    if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height, player.x, player.y, player.width, player.height)) {
      newLives -= 1
    } else {
      survivingEnemyBullets.push(bullet)
    }
  }
  bullets = survivingEnemyBullets

  // move enemies
  enemyMoveTimer += deltaMs
  let newEnemyDir = enemyDir
  if (enemyMoveTimer >= enemyMoveInterval) {
    enemyMoveTimer = 0
    const aliveEnemies = enemies.filter((e) => e.alive)
    const rightmost = Math.max(...aliveEnemies.map((e) => e.x + e.width))
    const leftmost = Math.min(...aliveEnemies.map((e) => e.x))
    let descend = false
    if (enemyDir === 1 && rightmost + ENEMY_STEP_X > state.canvasWidth) {
      newEnemyDir = -1
      descend = true
    } else if (enemyDir === -1 && leftmost - ENEMY_STEP_X < 0) {
      newEnemyDir = 1
      descend = true
    }
    enemies = enemies.map((e) =>
      e.alive
        ? { ...e, x: e.x + ENEMY_STEP_X * (descend ? 0 : enemyDir), y: e.y + (descend ? ENEMY_STEP_Y : 0) }
        : e
    )
  }

  // enemy shoots
  enemyShootTimer += deltaMs
  if (enemyShootTimer >= enemyShootInterval) {
    enemyShootTimer = 0
    const aliveEnemies = enemies.filter((e) => e.alive)
    if (aliveEnemies.length > 0) {
      const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
      bullets = [
        ...bullets,
        {
          id: `eb-${Date.now()}`,
          x: shooter.x + shooter.width / 2 - 2,
          y: shooter.y + shooter.height,
          width: 4,
          height: 10,
          active: true,
          owner: 'enemy',
          vy: ENEMY_BULLET_SPEED,
        },
      ]
    }
  }

  // check if enemies reached player row
  const lowestEnemy = enemies
    .filter((e) => e.alive)
    .reduce((max, e) => (e.y + e.height > max ? e.y + e.height : max), 0)
  if (lowestEnemy >= player.y || newLives <= 0) {
    return {
      ...state,
      bullets,
      enemies,
      lives: newLives,
      score: newScore,
      hiScore: newHiScore,
      gameStatus: 'gameover',
      enemyDir: newEnemyDir,
      enemyMoveTimer,
      enemyShootTimer,
    }
  }

  // check wave clear
  const alive = enemies.filter((e) => e.alive)
  if (alive.length === 0) {
    const newWave = wave + 1
    const newEnemies = buildEnemies(state.canvasWidth)
    return {
      ...state,
      enemies: newEnemies,
      bullets: [],
      score: newScore,
      hiScore: newHiScore,
      wave: newWave,
      enemyDir: 1,
      enemyMoveTimer: 0,
      enemyMoveInterval: Math.max(200, enemyMoveInterval - 100),
      enemyShootTimer: 0,
      enemyShootInterval: Math.max(800, enemyShootInterval - 200),
    }
  }

  return {
    ...state,
    player,
    bullets,
    enemies,
    lives: newLives,
    score: newScore,
    hiScore: newHiScore,
    enemyDir: newEnemyDir,
    enemyMoveTimer,
    enemyMoveInterval,
    enemyShootTimer,
    enemyShootInterval,
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/lib/game/__tests__/engine.test.ts
```

Expected: todos passando

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine.ts src/lib/game/__tests__/engine.test.ts
git commit -m "feat: game engine — state, movement, bullets, collision, waves"
```

---

## Task 7: Renderer do Canvas

**Files:**
- Create: `src/lib/game/renderer.ts`

Nota: renderer não tem lógica testável isolada (depende de CanvasRenderingContext2D); testamos visualmente via componente. A função simplesmente aceita estado e ctx.

- [ ] **Step 1: Implementar renderer.ts**

Criar `src/lib/game/renderer.ts`:

```typescript
import type { GameState } from './engine'

const ENEMY_EMOJIS: Record<number, string> = {
  0: '👾',
  1: '🍔',
  2: '🍟',
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { canvasWidth, canvasHeight } = state

  // background: space gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
  gradient.addColorStop(0, '#0d0020')
  gradient.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // stars (deterministic via hash of position)
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 137 + 17) % canvasWidth)
    const sy = ((i * 73 + 31) % (canvasHeight * 0.75))
    const size = i % 5 === 0 ? 2 : 1
    ctx.fillRect(sx, sy, size, size)
  }

  // city silhouette at bottom
  ctx.fillStyle = '#1a1a2e'
  const buildings = [
    { x: 0, w: 60, h: 50 },
    { x: 70, w: 40, h: 80 },
    { x: 120, w: 80, h: 60 },
    { x: 210, w: 50, h: 100 },
    { x: 270, w: 30, h: 70 },
    { x: 310, w: 90, h: 55 },
    { x: 410, w: 60, h: 90 },
    { x: 480, w: 40, h: 65 },
    { x: 530, w: 100, h: 80 },
    { x: 640, w: 50, h: 50 },
    { x: 700, w: 80, h: 75 },
    { x: 790, w: 10, h: 40 },
  ]
  for (const b of buildings) {
    ctx.fillRect(b.x, canvasHeight - b.h, b.w, b.h)
  }

  // enemies
  ctx.font = '28px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    ctx.fillText(
      ENEMY_EMOJIS[enemy.row] ?? '👾',
      enemy.x + enemy.width / 2,
      enemy.y + enemy.height / 2
    )
  }

  // player — pixel art hamburger cannon
  const px = state.player.x
  const py = state.player.y
  const pw = state.player.width
  const ph = state.player.height

  // bun (top)
  ctx.fillStyle = '#ec9837'
  ctx.beginPath()
  ctx.ellipse(px + pw / 2, py + 8, pw / 2, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // sesame seeds
  ctx.fillStyle = '#f0df5a'
  ctx.fillRect(px + pw / 2 - 8, py + 4, 4, 3)
  ctx.fillRect(px + pw / 2 + 4, py + 6, 4, 3)
  // patty
  ctx.fillStyle = '#5c3317'
  ctx.fillRect(px + 4, py + 15, pw - 8, 8)
  // cannon barrel
  ctx.fillStyle = '#b92526'
  ctx.fillRect(px + pw / 2 - 3, py + ph - 14, 6, 14)

  // player bullets
  ctx.fillStyle = '#f0df5a'
  for (const bullet of state.bullets) {
    if (bullet.owner === 'player') {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
    }
  }

  // enemy bullets
  ctx.fillStyle = '#ff4444'
  for (const bullet of state.bullets) {
    if (bullet.owner === 'enemy') {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
    }
  }

  // lives indicators
  ctx.font = '20px serif'
  ctx.textAlign = 'left'
  for (let i = 0; i < state.lives; i++) {
    ctx.fillText('🍔', 8 + i * 28, canvasHeight - 12)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/game/renderer.ts
git commit -m "feat: canvas renderer — space bg, emoji enemies, pixel art player"
```

---

## Task 8: Input Handler

**Files:**
- Create: `src/lib/game/input.ts`
- Create: `src/lib/game/__tests__/input.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `src/lib/game/__tests__/input.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { keyToAction } from '../input'
import type { GameAction } from '../engine'

describe('keyToAction', () => {
  it('ArrowLeft maps to left', () => {
    expect(keyToAction('ArrowLeft')).toBe('left')
  })
  it('ArrowRight maps to right', () => {
    expect(keyToAction('ArrowRight')).toBe('right')
  })
  it('Space maps to fire', () => {
    expect(keyToAction(' ')).toBe('fire')
  })
  it('unknown key maps to none', () => {
    expect(keyToAction('Enter')).toBe('none')
  })
  it('a maps to left', () => {
    expect(keyToAction('a')).toBe('left')
  })
  it('d maps to right', () => {
    expect(keyToAction('d')).toBe('right')
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/lib/game/__tests__/input.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar input.ts**

Criar `src/lib/game/input.ts`:

```typescript
import type { GameAction } from './engine'

const KEY_MAP: Record<string, GameAction> = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ' ': 'fire',
}

export function keyToAction(key: string): GameAction {
  return KEY_MAP[key] ?? 'none'
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/lib/game/__tests__/input.test.ts
```

Expected: 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/input.ts src/lib/game/__tests__/input.test.ts
git commit -m "feat: keyboard input mapping"
```

---

## Task 9: useGameLoop Hook

**Files:**
- Create: `src/hooks/useGameLoop.ts`

- [ ] **Step 1: Implementar useGameLoop.ts**

Criar `src/hooks/useGameLoop.ts`:

```typescript
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createGameState, tickGame, movePlayer, fireBullet, type GameState, type GameAction } from '@/lib/game/engine'
import { renderFrame } from '@/lib/game/renderer'
import { keyToAction } from '@/lib/game/input'

type Options = {
  canvasRef: React.RefObject<HTMLCanvasElement>
  onGameOver: (state: GameState) => void
}

export function useGameLoop({ canvasRef, onGameOver }: Options) {
  const stateRef = useRef<GameState | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const pressedKeys = useRef<Set<string>>(new Set())

  const start = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    stateRef.current = createGameState(canvas.width, canvas.height)
    pressedKeys.current.clear()
    lastTimeRef.current = 0

    function loop(timestamp: number) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
      lastTimeRef.current = timestamp

      let state = stateRef.current!

      // apply held keys
      if (pressedKeys.current.has('ArrowLeft') || pressedKeys.current.has('a')) {
        state = movePlayer(state, 'left')
      }
      if (pressedKeys.current.has('ArrowRight') || pressedKeys.current.has('d')) {
        state = movePlayer(state, 'right')
      }
      if (pressedKeys.current.has(' ')) {
        state = fireBullet(state)
      }

      state = tickGame(state, delta)
      stateRef.current = state

      renderFrame(ctx, state)

      if (state.gameStatus === 'gameover') {
        onGameOver(state)
        return
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [canvasRef, onGameOver])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    pressedKeys.current.add(e.key)
    if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    pressedKeys.current.delete(e.key)
  }, [])

  // touch actions (called from TouchControls)
  const touchAction = useCallback((action: GameAction) => {
    if (!stateRef.current) return
    if (action === 'left') stateRef.current = movePlayer(stateRef.current, 'left')
    if (action === 'right') stateRef.current = movePlayer(stateRef.current, 'right')
    if (action === 'fire') stateRef.current = fireBullet(stateRef.current)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(rafRef.current)
    }
  }, [handleKeyDown, handleKeyUp])

  return { start, stop, touchAction, stateRef }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGameLoop.ts
git commit -m "feat: useGameLoop — RAF loop with keyboard input integration"
```

---

## Task 10: Scores — Persistir e Consultar

**Files:**
- Create: `src/lib/scores.ts`
- Create: `src/lib/__tests__/scores.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `src/lib/__tests__/scores.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const mockFrom = vi.fn()
vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}))

import { saveScore, getPlayerBestScore } from '../scores'

describe('saveScore', () => {
  it('inserts a score row and returns it', async () => {
    const fakeScore = { id: 'sc-1', player_id: 'p-1', game_id: 'g-1', score: 500, wave: 2, season: 1 }
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: fakeScore, error: null }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await saveScore({ playerId: 'p-1', gameId: 'g-1', score: 500, wave: 2, season: 1 })
    expect(result).toEqual(fakeScore)
  })

  it('returns null on error', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await saveScore({ playerId: 'p-1', gameId: 'g-1', score: 500, wave: 2, season: 1 })
    expect(result).toBeNull()
  })
})

describe('getPlayerBestScore', () => {
  it('returns the maximum score for a player in a game', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { score: 1200 }, error: null }),
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const best = await getPlayerBestScore('p-1', 'g-1')
    expect(best).toBe(1200)
  })

  it('returns 0 when no scores exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const best = await getPlayerBestScore('p-1', 'g-1')
    expect(best).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/lib/__tests__/scores.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar scores.ts**

Criar `src/lib/scores.ts`:

```typescript
import { supabase, Score } from './supabase'

type SaveScoreParams = {
  playerId: string
  gameId: string
  score: number
  wave: number
  season: number
}

export async function saveScore(params: SaveScoreParams): Promise<Score | null> {
  const { data, error } = await supabase
    .from('scores')
    .insert({
      player_id: params.playerId,
      game_id: params.gameId,
      score: params.score,
      wave: params.wave,
      season: params.season,
    })
    .select()
    .single()

  if (error) return null
  return data as Score
}

export async function getPlayerBestScore(
  playerId: string,
  gameId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('scores')
    .select('score')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return 0
  return data.score
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/lib/__tests__/scores.test.ts
```

Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/scores.ts src/lib/__tests__/scores.test.ts
git commit -m "feat: saveScore and getPlayerBestScore"
```

---

## Task 11: useRanking Hook

**Files:**
- Create: `src/hooks/useRanking.ts`

- [ ] **Step 1: Implementar useRanking.ts**

Criar `src/hooks/useRanking.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase, RankingRow } from '@/lib/supabase'

export type RankingEntry = RankingRow & {
  players: { nickname: string }
}

export function useRanking(gameId: string | null) {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)

    supabase
      .from('ranking')
      .select('game_id, player_id, score, position, players(nickname)')
      .eq('game_id', gameId)
      .order('position', { ascending: true })
      .limit(10)
      .then(({ data }) => {
        setRanking((data as RankingEntry[]) ?? [])
        setLoading(false)
      })
  }, [gameId])

  return { ranking, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useRanking.ts
git commit -m "feat: useRanking hook"
```

---

## Task 12: Componentes UI Reutilizáveis

**Files:**
- Create: `src/components/ui/DiscountBadge.tsx`
- Create: `src/components/hub/TopBar.tsx`
- Create: `src/components/hub/GameGrid.tsx`
- Create: `src/components/hub/RankingPreview.tsx`

- [ ] **Step 1: DiscountBadge.tsx**

Criar `src/components/ui/DiscountBadge.tsx`:

```typescript
type Props = {
  pct: number
  className?: string
}

export default function DiscountBadge({ pct, className = '' }: Props) {
  return (
    <span
      className={`inline-block bg-primary text-secondary font-display text-sm px-2 py-0.5 rounded tracking-wider ${className}`}
    >
      -{pct}%
    </span>
  )
}
```

- [ ] **Step 2: TopBar.tsx**

Criar `src/components/hub/TopBar.tsx`:

```typescript
'use client'

import Image from 'next/image'

type Props = {
  fichasBalance: number
  onInsertFicha: () => void
}

export default function TopBar({ fichasBalance, onInsertFicha }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-bg sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <Image
          src="https://redirect90s.vercel.app/assets/logo1.png"
          alt="90s Burgers"
          width={48}
          height={48}
          className="rounded"
          unoptimized
        />
        <span className="font-display text-secondary text-xl tracking-widest hidden sm:block">
          90s BURGERS
        </span>
      </div>

      <button
        onClick={onInsertFicha}
        className="flex items-center gap-2 border border-secondary rounded px-3 py-1 hover:bg-secondary/10 transition-colors"
      >
        <span className="text-secondary font-display text-lg tracking-wider">
          🪙 {fichasBalance}
        </span>
        <span className="text-gray-400 text-xs uppercase tracking-wider hidden sm:block">
          fichas
        </span>
      </button>
    </header>
  )
}
```

- [ ] **Step 3: GameGrid.tsx**

Criar `src/components/hub/GameGrid.tsx`:

```typescript
import Link from 'next/link'
import type { Game } from '@/lib/supabase'

type Props = {
  games: Game[]
}

const GAME_ROUTES: Record<string, string> = {
  'burger-invaders': '/games/burger-invaders',
}

export default function GameGrid({ games }: Props) {
  // Always render a 2×2 grid (4 slots). Fill remaining with "EM BREVE"
  const slots = [
    ...games,
    ...Array(Math.max(0, 4 - games.length)).fill(null),
  ].slice(0, 4)

  return (
    <section className="grid grid-cols-2 gap-4 p-4 max-w-lg mx-auto w-full">
      {slots.map((game, i) =>
        game ? (
          <Link
            key={game.id}
            href={GAME_ROUTES[game.slug] ?? '/'}
            className="relative flex flex-col items-center justify-center aspect-square border-2 border-secondary rounded bg-black hover:border-tertiary hover:shadow-[0_0_16px_#ec9837] transition-all group"
          >
            <span className="text-5xl mb-2">👾</span>
            <span className="font-display text-secondary text-lg tracking-widest text-center px-2 leading-tight">
              {game.name.toUpperCase()}
            </span>
            <span className="absolute top-2 right-2 bg-primary text-white text-xs font-display px-1.5 py-0.5 rounded tracking-wider">
              ATIVO
            </span>
          </Link>
        ) : (
          <div
            key={`empty-${i}`}
            className="flex flex-col items-center justify-center aspect-square border-2 border-gray-700 rounded bg-black/40 opacity-50"
          >
            <span className="text-4xl mb-2 grayscale">🎮</span>
            <span className="font-display text-gray-500 text-base tracking-widest">
              EM BREVE
            </span>
          </div>
        )
      )}
    </section>
  )
}
```

- [ ] **Step 4: RankingPreview.tsx**

Criar `src/components/hub/RankingPreview.tsx`:

```typescript
import DiscountBadge from '@/components/ui/DiscountBadge'
import type { RankingEntry } from '@/hooks/useRanking'

type Props = {
  entries: RankingEntry[]
  discountPct: number
  topN: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function RankingPreview({ entries, discountPct, topN }: Props) {
  const preview = entries.slice(0, 2)

  return (
    <section className="px-4 pb-6 max-w-lg mx-auto w-full">
      <h2 className="font-display text-tertiary text-xl tracking-widest mb-3 text-center">
        RANKING
      </h2>

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
                <span className="text-xl">{MEDALS[Number(entry.position) - 1] ?? `#${entry.position}`}</span>
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

      <p className="text-center text-gray-500 text-xs mt-3">
        Top {topN} ganham desconto de {discountPct}% no delivery
      </p>
    </section>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: DiscountBadge, TopBar, GameGrid, RankingPreview components"
```

---

## Task 13: Componentes do Jogo

**Files:**
- Create: `src/components/game/StatsBar.tsx`
- Create: `src/components/game/TouchControls.tsx`
- Create: `src/components/game/BurgerInvaders.tsx`

- [ ] **Step 1: StatsBar.tsx**

Criar `src/components/game/StatsBar.tsx`:

```typescript
type Props = {
  score: number
  wave: number
  hiScore: number
  lives: number
}

export default function StatsBar({ score, wave, hiScore, lives }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black border-b border-gray-800">
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

- [ ] **Step 2: TouchControls.tsx**

Criar `src/components/game/TouchControls.tsx`:

```typescript
'use client'

import type { GameAction } from '@/lib/game/engine'

type Props = {
  onAction: (action: GameAction) => void
}

export default function TouchControls({ onAction }: Props) {
  function handleTouch(action: GameAction) {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      onAction(action)
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-black border-t border-gray-800 select-none md:hidden">
      <button
        onTouchStart={handleTouch('left')}
        onMouseDown={handleTouch('left')}
        className="w-16 h-16 rounded-full border-2 border-secondary flex items-center justify-center font-display text-secondary text-2xl active:bg-secondary/20"
      >
        ◀
      </button>

      <button
        onTouchStart={handleTouch('fire')}
        onMouseDown={handleTouch('fire')}
        className="w-20 h-16 rounded border-2 border-primary flex items-center justify-center font-display text-primary text-xl tracking-wider active:bg-primary/20"
      >
        FIRE
      </button>

      <button
        onTouchStart={handleTouch('right')}
        onMouseDown={handleTouch('right')}
        className="w-16 h-16 rounded-full border-2 border-secondary flex items-center justify-center font-display text-secondary text-2xl active:bg-secondary/20"
      >
        ▶
      </button>
    </div>
  )
}
```

- [ ] **Step 3: BurgerInvaders.tsx**

Criar `src/components/game/BurgerInvaders.tsx`:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameLoop } from '@/hooks/useGameLoop'
import StatsBar from './StatsBar'
import TouchControls from './TouchControls'
import type { GameState } from '@/lib/game/engine'
import { saveScore } from '@/lib/scores'

type Props = {
  playerId: string | null
  gameId: string
  season: number
}

const CANVAS_WIDTH = 480
const CANVAS_HEIGHT = 520

export default function BurgerInvaders({ playerId, gameId, season }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [displayState, setDisplayState] = useState({
    score: 0, wave: 1, hiScore: 0, lives: 3,
  })

  const { start, touchAction, stateRef } = useGameLoop({
    canvasRef,
    onGameOver: async (finalState: GameState) => {
      if (playerId) {
        await saveScore({
          playerId,
          gameId,
          score: finalState.score,
          wave: finalState.wave,
          season,
        })
      }
      router.push(
        `/games/burger-invaders/game-over?score=${finalState.score}&wave=${finalState.wave}`
      )
    },
  })

  // sync display every 100ms
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current
      if (s) {
        setDisplayState({
          score: s.score,
          wave: s.wave,
          hiScore: s.hiScore,
          lives: s.lives,
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [stateRef])

  useEffect(() => {
    start()
  }, [start])

  return (
    <div className="flex flex-col items-center w-full">
      <StatsBar
        score={displayState.score}
        wave={displayState.wave}
        hiScore={displayState.hiScore}
        lives={displayState.lives}
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
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/game/
git commit -m "feat: StatsBar, TouchControls, BurgerInvaders game component"
```

---

## Task 14: LeaderboardTable

**Files:**
- Create: `src/components/ranking/LeaderboardTable.tsx`

- [ ] **Step 1: Implementar LeaderboardTable.tsx**

Criar `src/components/ranking/LeaderboardTable.tsx`:

```typescript
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

const MEDALS = ['🥇', '🥈', '🥉']

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

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {currentEntry && (
        <div className="mb-4 bg-tertiary/10 border border-tertiary rounded px-4 py-2 text-center">
          <span className="font-display text-tertiary text-lg tracking-wider">
            SUA POSIÇÃO: #{currentEntry.position}
          </span>
          {Number(currentEntry.position) > topN && (
            <span className="block text-gray-400 text-xs mt-0.5">
              {Number(currentEntry.position) - topN} posições do top {topN}
            </span>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {entries.slice(0, 10).map((entry) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId
          const hasDiscount = Number(entry.position) <= topN
          const medal = MEDALS[Number(entry.position) - 1]

          return (
            <li
              key={entry.player_id}
              className={`flex items-center justify-between rounded px-3 py-2 border transition-colors ${
                isCurrentPlayer
                  ? 'border-tertiary bg-tertiary/10'
                  : 'border-gray-800 bg-black'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl w-7 text-center">
                  {medal ?? `#${entry.position}`}
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
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ranking/LeaderboardTable.tsx
git commit -m "feat: LeaderboardTable with medals, discount badges, player highlight"
```

---

## Task 15: Hub Home (`/`)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implementar page.tsx da home**

Substituir `src/app/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
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
    if (!player) {
      setShowAuthModal(true)
    }
  }

  function handleAuthSuccess(p: Player) {
    setPlayer(p)
    setShowAuthModal(false)
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <TopBar fichasBalance={fichasBalance} onInsertFicha={handleInsertFicha} />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <h1 className="font-display text-secondary text-5xl sm:text-6xl tracking-widest leading-none mb-2">
          JOGAR E GANHAR
        </h1>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Jogue, suba no ranking e ganhe desconto no delivery enquanto estiver no top 3
        </p>
        <button
          onClick={handleInsertFicha}
          className="bg-primary hover:bg-red-700 active:scale-95 transition-all font-display text-white text-2xl tracking-widest px-8 py-3 rounded shadow-[0_0_20px_#b92526]"
        >
          INSERIR FICHA
        </button>
        {player && (
          <p className="text-gray-500 text-xs mt-3">
            Bem-vindo, <span className="text-secondary">{player.nickname}</span>!
          </p>
        )}
      </section>

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

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: Hub Home page — hero, game grid, ranking preview, auth modal"
```

---

## Task 16: Página do Jogo (`/games/burger-invaders`)

**Files:**
- Create: `src/app/games/burger-invaders/page.tsx`

- [ ] **Step 1: Implementar page.tsx do jogo**

Criar `src/app/games/burger-invaders/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import BurgerInvaders from '@/components/game/BurgerInvaders'
import AuthModal from '@/components/hub/AuthModal'

export default function BurgerInvadersPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function init() {
      const [currentPlayer, { data: gameData }] = await Promise.all([
        getCurrentPlayer(),
        supabase
          .from('games')
          .select('*')
          .eq('slug', 'burger-invaders')
          .single(),
      ])
      setPlayer(currentPlayer)
      setGame(gameData as Game | null)
      setLoading(false)
      if (!currentPlayer) setShowAuth(true)
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="font-display text-secondary text-3xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center">
      <div className="w-full max-w-[480px]">
        {player && game ? (
          <BurgerInvaders
            playerId={player.id}
            gameId={game.id}
            season={game.season}
          />
        ) : (
          !showAuth && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-gray-400">Jogo não disponível</p>
              <button
                onClick={() => router.push('/')}
                className="font-display text-secondary border border-secondary px-6 py-2 rounded"
              >
                VOLTAR
              </button>
            </div>
          )
        )}
      </div>

      {showAuth && (
        <AuthModal
          onSuccess={(p) => {
            setPlayer(p)
            setShowAuth(false)
          }}
          onClose={() => router.push('/')}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/games/burger-invaders/page.tsx
git commit -m "feat: Burger Invaders game page"
```

---

## Task 17: Game Over (`/games/burger-invaders/game-over`)

**Files:**
- Create: `src/app/games/burger-invaders/game-over/page.tsx`

- [ ] **Step 1: Implementar page.tsx do game over**

Criar `src/app/games/burger-invaders/game-over/page.tsx`:

```typescript
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Game } from '@/lib/supabase'
import { useFichas } from '@/hooks/useFichas'
import { useRanking } from '@/hooks/useRanking'

function GameOverContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const score = Number(searchParams.get('score') ?? 0)
  const wave = Number(searchParams.get('wave') ?? 1)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [game, setGame] = useState<Game | null>(null)
  const fichas = useFichas(playerId)
  const { ranking } = useRanking(game?.id ?? null)

  useEffect(() => {
    async function init() {
      const [player, { data: gameData }] = await Promise.all([
        getCurrentPlayer(),
        supabase.from('games').select('*').eq('slug', 'burger-invaders').single(),
      ])
      if (player) {
        setPlayerId(player.id)
        setNickname(player.nickname)
      }
      setGame(gameData as Game | null)
    }
    init()
  }, [])

  const myEntry = ranking.find((r) => r.player_id === playerId)
  const position = myEntry ? Number(myEntry.position) : null
  const hasDiscount = position !== null && game !== null && position <= game.top_n_discount

  const shareText = `Fiz ${score.toLocaleString('pt-BR')} pts no Burger Invaders! Estou em #${position ?? '?'} 👾 Jogue também: ${typeof window !== 'undefined' ? window.location.origin : ''}`

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  function shareInstagram() {
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Texto copiado! Cole no seu Instagram Story.')
    })
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-8 gap-6">
      <h1 className="font-display text-primary text-5xl tracking-widest">GAME OVER</h1>

      {/* Score card */}
      <div className="w-full max-w-sm border-2 border-secondary rounded bg-black p-6 text-center">
        <p className="text-gray-400 text-xs tracking-widest uppercase mb-1">Pontuação final</p>
        <p className="font-display text-secondary text-6xl tracking-wider mb-2">
          {score.toLocaleString('pt-BR')}
        </p>
        <p className="text-gray-400 text-sm">Wave {wave}</p>

        {position && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="font-display text-white text-2xl tracking-wider">
              #{position} no ranking
            </p>
            {hasDiscount && (
              <p className="text-primary font-display text-lg tracking-wider mt-1">
                🎉 TOP {game!.top_n_discount} — DESCONTO DE {game!.discount_pct}%!
              </p>
            )}
          </div>
        )}

        {fichas > 0 && (
          <p className="mt-3 text-gray-400 text-xs">
            Você tem <span className="text-secondary font-semibold">{fichas} fichas</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={shareWhatsApp}
          className="w-full bg-green-700 hover:bg-green-600 font-display text-white text-xl tracking-widest py-3 rounded transition-colors"
        >
          COMPARTILHAR
        </button>

        <a
          href="https://delivery.90sburgers.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-tertiary hover:bg-orange-500 font-display text-black text-xl tracking-widest py-3 rounded text-center block transition-colors"
        >
          PEDIR AGORA 🍔
        </a>

        <Link
          href="/games/burger-invaders"
          className="w-full border-2 border-secondary hover:bg-secondary/10 font-display text-secondary text-xl tracking-widest py-3 rounded text-center block transition-colors"
        >
          JOGAR DE NOVO
        </Link>
      </div>
    </div>
  )
}

export default function GameOverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="font-display text-secondary text-3xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    }>
      <GameOverContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/games/burger-invaders/game-over/page.tsx
git commit -m "feat: Game Over page — score, ranking position, share, order CTA"
```

---

## Task 18: Leaderboard (`/ranking`)

**Files:**
- Create: `src/app/ranking/page.tsx`

- [ ] **Step 1: Implementar page.tsx do ranking**

Criar `src/app/ranking/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import { useRanking } from '@/hooks/useRanking'
import LeaderboardTable from '@/components/ranking/LeaderboardTable'
import TopBar from '@/components/hub/TopBar'
import { useFichas } from '@/hooks/useFichas'

export default function RankingPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const fichas = useFichas(player?.id ?? null)
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
      <TopBar fichasBalance={fichas} onInsertFicha={() => {}} />

      <main className="flex flex-col items-center py-6 gap-6">
        <h1 className="font-display text-secondary text-4xl tracking-widest">RANKING</h1>

        {/* Game tabs */}
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

        <Link
          href="/"
          className="font-display text-gray-500 text-sm tracking-wider hover:text-secondary transition-colors"
        >
          ← VOLTAR AO HUB
        </Link>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/ranking/page.tsx
git commit -m "feat: Leaderboard page with tabs, positions, discount badges"
```

---

## Task 19: Rodar Todos os Testes + Build Final

**Files:** nenhum arquivo novo

- [ ] **Step 1: Rodar toda a suite de testes**

```bash
npm test
```

Expected output (todos passando):
```
 ✓ src/lib/__tests__/supabase.test.ts (2)
 ✓ src/lib/__tests__/auth.test.ts (4)
 ✓ src/lib/__tests__/fichas.test.ts (3)
 ✓ src/lib/__tests__/scores.test.ts (4)
 ✓ src/lib/game/__tests__/engine.test.ts (11)
 ✓ src/lib/game/__tests__/input.test.ts (6)

Test Files  6 passed (6)
Tests      30 passed (30)
```

- [ ] **Step 2: Verificar build de produção**

```bash
npm run build
```

Expected: `✓ Compiled successfully` sem erros TypeScript.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: Plan 1 complete — Foundation + Player Hub"
```

---

## Checklist de Entrega

- [ ] Migration SQL com todas as tabelas, views e RLS
- [ ] Auth anônima com cadastro de nickname + telefone
- [ ] Hub Home com hero, grid de games, ranking preview
- [ ] Burger Invaders funcional (engine, renderer, input, loop)
- [ ] Tela Game Over com score, posição, compartilhamento e CTA delivery
- [ ] Leaderboard com tabs, badges de desconto e linha do jogador destacada
- [ ] Fichas em tempo real via Supabase Realtime
- [ ] 30 testes passando
- [ ] Build de produção sem erros
