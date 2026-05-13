# Game Loop Fechamento — Fichas/Continuar, Recharge, Game Over Share, OG Image

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o loop de negócio: fichas como "continuar" arcade (wave atual, 1 vida), recharge diário passivo (máx 3, +1/24h), redirecionamento para `/game-over` com share WhatsApp real, e OG image dinâmica.

**Architecture:** Engine ganha `continueGameState` que retoma na wave atual; `useGameLoop` exporta `continueGame(prevState)`; `useFichas` chama RPC `recharge_fichas` com cache sessionStorage e retorna `{ balance, invalidate }`; `BurgerInvaders` ganha fase `'continue'` com countdown 5s; ao desistir navega para `/game-over?score=X&wave=Y`; a página `/game-over` vira Server Component com `generateMetadata`; Edge Function `/api/og` gera a imagem para WhatsApp/Instagram.

**Tech Stack:** TypeScript, React, Next.js 14 App Router, Canvas 2D, Supabase (PostgreSQL RPC + SECURITY DEFINER, RLS), `next/og` ImageResponse (Edge Runtime), Vitest, @testing-library/react, Tailwind CSS

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/004_recharge.sql` | Criar | `fichas_recharged_at`, policy `fichas_self_insert`, RPCs `recharge_fichas` e `debit_ficha` |
| `src/lib/game/engine.ts` | Modificar | +`continueGameState(prev: GameState): GameState` |
| `src/lib/game/__tests__/engine.test.ts` | Modificar | +5 testes para `continueGameState` |
| `src/hooks/useGameLoop.ts` | Modificar | `start(override?)` aceita estado inicial; +`continueGame(prevState)` |
| `src/hooks/useFichas.ts` | Modificar | sessionStorage cache + RPC recharge; retorna `{ balance, invalidate }` |
| `src/hooks/__tests__/useFichas.test.ts` | Criar | 4 testes: null, RPC + cache, hit cache, invalidate |
| `src/lib/auth.ts` | Modificar | +INSERT 3 fichas welcome após criar player |
| `src/lib/__tests__/auth.test.ts` | Modificar | +teste fichas welcome chamadas |
| `src/app/api/fichas/debit/route.ts` | Criar | POST: chama RPC `debit_ficha`, retorna `{ new_balance }` |
| `src/components/game/ContinueCountdown.tsx` | Criar | Countdown 5s com barra de progresso e botão CONTINUAR |
| `src/components/game/BurgerInvaders.tsx` | Modificar | +fase `'continue'`, -overlay `'gameover'` inline, navega para `/game-over` |
| `src/app/api/og/route.tsx` | Criar | Edge Function: ImageResponse branding 90s Burgers + score + wave |
| `src/app/games/burger-invaders/game-over/GameOverContent.tsx` | Criar | Client Component extraído da page atual |
| `src/app/games/burger-invaders/game-over/page.tsx` | Modificar | Server Component + `generateMetadata` com OG tags |
| `src/app/page.tsx` | Modificar | Destructure `{ balance }` do novo retorno de `useFichas` |

---

## Task 1: Supabase migration 004

**Files:**
- Criar: `supabase/migrations/004_recharge.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- supabase/migrations/004_recharge.sql

-- 1. Coluna de recharge em players
--    DEFAULT now() - interval '24 hours' para que players existentes possam recarregar na primeira abertura
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS fichas_recharged_at timestamptz
  DEFAULT (now() - interval '24 hours');

-- 2. RLS: players podem inserir suas próprias fichas (necessário para fichas welcome no cadastro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fichas' AND policyname = 'fichas_self_insert'
  ) THEN
    CREATE POLICY "fichas_self_insert" ON fichas
      FOR INSERT WITH CHECK (player_id = auth.uid());
  END IF;
END $$;

-- 3. RPC: recarrega fichas passivas (máx 3, +1 a cada 24h)
CREATE OR REPLACE FUNCTION recharge_fichas(p_player_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance    int;
  v_recharged  timestamptz;
  v_hours      float;
  v_to_add     int;
BEGIN
  IF p_player_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM fichas WHERE player_id = p_player_id;

  IF v_balance >= 3 THEN
    RETURN v_balance;
  END IF;

  SELECT fichas_recharged_at INTO v_recharged
  FROM players WHERE id = p_player_id;

  v_hours  := EXTRACT(EPOCH FROM (now() - v_recharged)) / 3600;
  v_to_add := LEAST(3 - v_balance, FLOOR(v_hours / 24)::int);

  IF v_to_add > 0 THEN
    INSERT INTO fichas (player_id, amount, reason)
    SELECT p_player_id, 1, 'recharge_diario'
    FROM generate_series(1, v_to_add);

    UPDATE players SET fichas_recharged_at = now()
    WHERE id = p_player_id;
  END IF;

  RETURN v_balance + v_to_add;
END;
$$;

-- 4. RPC: debita fichas atomicamente (verifica saldo + insere em uma transação)
CREATE OR REPLACE FUNCTION debit_ficha(p_player_id uuid, p_amount int, p_reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance int;
BEGIN
  IF p_player_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM fichas WHERE player_id = p_player_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_fichas';
  END IF;

  INSERT INTO fichas (player_id, amount, reason)
  VALUES (p_player_id, -p_amount, p_reason);

  RETURN v_balance - p_amount;
END;
$$;
```

- [ ] **Step 2: Aplicar no Supabase**

Abra o painel do Supabase → SQL Editor → cole e execute o conteúdo do arquivo acima.

Esperado: sem erros. Verifique em Table Editor que `players` tem a coluna `fichas_recharged_at`.

---

## Task 2: engine.ts — continueGameState

**Files:**
- Modificar: `src/lib/game/engine.ts`
- Modificar: `src/lib/game/__tests__/engine.test.ts`

- [ ] **Step 1: Escrever os testes primeiro**

Adicionar ao final de `src/lib/game/__tests__/engine.test.ts`:

```ts
import {
  createGameState,
  continueGameState,
  tickGame,
  movePlayer,
  fireBullet,
  ENEMY_ROWS,
  ENEMY_COLS,
  SCORE_BY_ROW,
  type GameState,
} from '../engine'

// ... (imports existentes no topo já cobrem createGameState e ENEMY_ROWS/COLS)
// Adicionar apenas continueGameState ao import existente no topo do arquivo

describe('continueGameState', () => {
  it('mantém wave, score e hiScore do estado anterior', () => {
    const base = createGameState(480, 520)
    const prev = { ...base, wave: 5, score: 12000, hiScore: 15000 }
    const next = continueGameState(prev)
    expect(next.wave).toBe(5)
    expect(next.score).toBe(12000)
    expect(next.hiScore).toBe(15000)
  })

  it('reseta lives para 1', () => {
    const base = createGameState(480, 520)
    const next = continueGameState({ ...base, lives: 0 })
    expect(next.lives).toBe(1)
  })

  it('reconstrói a grade de inimigos completa', () => {
    const base = createGameState(480, 520)
    const noEnemies = { ...base, enemies: base.enemies.map(e => ({ ...e, alive: false })) }
    const next = continueGameState(noEnemies)
    expect(next.enemies.filter(e => e.alive).length).toBe(ENEMY_ROWS * ENEMY_COLS)
  })

  it('escala formationVX com a wave', () => {
    const base = createGameState(480, 520)
    const w1 = continueGameState({ ...base, wave: 1 })
    const w5 = continueGameState({ ...base, wave: 5 })
    expect(Math.abs(w5.formationVX)).toBeGreaterThan(Math.abs(w1.formationVX))
  })

  it('define gameStatus como playing', () => {
    const base = createGameState(480, 520)
    const next = continueGameState({ ...base, gameStatus: 'gameover' })
    expect(next.gameStatus).toBe('playing')
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npm test 2>&1 | grep "continueGameState"
```

Esperado: `continueGameState is not a function` ou similar.

- [ ] **Step 3: Implementar continueGameState em engine.ts**

Adicionar após a função `createGameState` (que já usa `buildEnemies`):

```ts
export function continueGameState(prev: GameState): GameState {
  const wave = prev.wave
  return {
    ...createGameState(prev.canvasWidth, prev.canvasHeight),
    wave,
    score: prev.score,
    hiScore: prev.hiScore,
    enemies: buildEnemies(prev.canvasWidth),
    lives: 1,
    formationVX: FORM_SPEED * (1 + (wave - 1) * 0.12),
    enemyShootInterval: Math.max(800, 2000 - (wave - 1) * 150),
    diveTimer: Math.max(2000, DIVE_INTERVAL_MIN - (wave - 1) * 200),
  }
}
```

> Nota: `buildEnemies` é privada mas está no mesmo arquivo, então o acesso é direto.

- [ ] **Step 4: Rodar testes**

```bash
npm test 2>&1 | tail -8
```

Esperado: `70 passed` (65 anteriores + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine.ts src/lib/game/__tests__/engine.test.ts
git commit -m "feat(engine): continueGameState — retoma wave atual com 1 vida"
```

---

## Task 3: useGameLoop — start override + continueGame

**Files:**
- Modificar: `src/hooks/useGameLoop.ts`

- [ ] **Step 1: Modificar start para aceitar estado inicial opcional**

Em `src/hooks/useGameLoop.ts`, substituir a assinatura de `start`:

```ts
import { createGameState, continueGameState, tickGame, movePlayer, fireBullet, type GameState, type GameAction } from '@/lib/game/engine'

// ...

  const start = useCallback((override?: GameState) => {
    cancelAnimationFrame(rafRef.current)
    const canvas = canvasRef.current
    if (!canvas) return
    stateRef.current = override ?? createGameState(canvas.width, canvas.height)
    pressedKeys.current.clear()
    touchPressed.current.clear()
    dragXRef.current = null
    lastTimeRef.current = 0

    // loop interno permanece igual...
```

> Apenas a linha `stateRef.current = createGameState(...)` muda para `stateRef.current = override ?? createGameState(...)`. Adicionar `continueGameState` ao import. O restante de `start` não muda.

- [ ] **Step 2: Adicionar continueGame e exportar**

Após o `useCallback` de `stop`, adicionar:

```ts
  const continueGame = useCallback((prevState: GameState) => {
    start(continueGameState(prevState))
  }, [start])
```

Na linha de retorno, adicionar `continueGame`:

```ts
  return { start, stop, touchStart, touchEnd, setPaused, setDragX, continueGame, stateRef }
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1
```

Esperado: sem output.

- [ ] **Step 4: Rodar testes**

```bash
npm test 2>&1 | tail -6
```

Esperado: `70 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGameLoop.ts
git commit -m "feat(loop): start aceita override; +continueGame(prevState)"
```

---

## Task 4: useFichas — sessionStorage cache + recharge RPC

**Files:**
- Modificar: `src/hooks/useFichas.ts`
- Criar: `src/hooks/__tests__/useFichas.test.ts`
- Modificar: `src/app/page.tsx` (destructure do novo retorno)

- [ ] **Step 1: Criar o arquivo de teste**

```ts
// src/hooks/__tests__/useFichas.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockRpc = vi.fn()
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}
const mockRemoveChannel = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

import { useFichas } from '../useFichas'

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('useFichas', () => {
  it('retorna balance 0 quando playerId é null', () => {
    const { result } = renderHook(() => useFichas(null))
    expect(result.current.balance).toBe(0)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('chama RPC recharge_fichas e armazena resultado no sessionStorage', async () => {
    mockRpc.mockResolvedValueOnce({ data: 2, error: null })
    const { result } = renderHook(() => useFichas('player-uuid'))
    await waitFor(() => expect(result.current.balance).toBe(2))
    expect(sessionStorage.getItem('fichas_player-uuid')).toBe('2')
    expect(mockRpc).toHaveBeenCalledWith('recharge_fichas', { p_player_id: 'player-uuid' })
  })

  it('usa sessionStorage sem chamar RPC quando cache existe', () => {
    sessionStorage.setItem('fichas_player-uuid', '3')
    const { result } = renderHook(() => useFichas('player-uuid'))
    expect(result.current.balance).toBe(3)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('invalidate limpa cache e refaz o fetch', async () => {
    sessionStorage.setItem('fichas_player-uuid', '3')
    mockRpc.mockResolvedValueOnce({ data: 1, error: null })
    const { result } = renderHook(() => useFichas('player-uuid'))
    expect(result.current.balance).toBe(3)
    act(() => { result.current.invalidate() })
    await waitFor(() => expect(result.current.balance).toBe(1))
    expect(sessionStorage.getItem('fichas_player-uuid')).toBe('1')
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/hooks/__tests__/useFichas.test.ts 2>&1 | tail -10
```

Esperado: falhas de importação ou execução.

- [ ] **Step 3: Reescrever src/hooks/useFichas.ts**

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FichasResult = { balance: number; invalidate: () => void }

export function useFichas(playerId: string | null): FichasResult {
  const [balance, setBalance] = useState(0)

  const fetchAndCache = useCallback(async (pid: string) => {
    const { data } = await supabase.rpc('recharge_fichas', { p_player_id: pid })
    const b = (data as number) ?? 0
    setBalance(b)
    sessionStorage.setItem(`fichas_${pid}`, String(b))
  }, [])

  const invalidate = useCallback(() => {
    if (!playerId) return
    sessionStorage.removeItem(`fichas_${playerId}`)
    fetchAndCache(playerId)
  }, [playerId, fetchAndCache])

  useEffect(() => {
    if (!playerId) { setBalance(0); return }

    const cached = sessionStorage.getItem(`fichas_${playerId}`)
    if (cached) {
      setBalance(Number(cached))
    } else {
      fetchAndCache(playerId)
    }

    const channel = supabase
      .channel(`fichas:${playerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fichas', filter: `player_id=eq.${playerId}` },
        () => {
          sessionStorage.removeItem(`fichas_${playerId}`)
          fetchAndCache(playerId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [playerId, fetchAndCache])

  return { balance, invalidate }
}
```

- [ ] **Step 4: Rodar testes do hook**

```bash
npm test src/hooks/__tests__/useFichas.test.ts 2>&1 | tail -10
```

Esperado: `4 passed`.

- [ ] **Step 5: Corrigir caller em src/app/page.tsx**

Linha atual:
```ts
const fichasBalance = useFichas(player?.id ?? null)
```

Substituir por:
```ts
const { balance: fichasBalance } = useFichas(player?.id ?? null)
```

- [ ] **Step 6: Type check + testes completos**

```bash
npx tsc --noEmit 2>&1 && npm test 2>&1 | tail -8
```

Esperado: sem erros de tipo, `74 passed`.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useFichas.ts src/hooks/__tests__/useFichas.test.ts src/app/page.tsx
git commit -m "feat(fichas): sessionStorage cache + recharge RPC; retorna { balance, invalidate }"
```

---

## Task 5: auth.ts — fichas welcome no cadastro

**Files:**
- Modificar: `src/lib/auth.ts`
- Modificar: `src/lib/__tests__/auth.test.ts`

- [ ] **Step 1: Adicionar teste de fichas welcome**

No `src/lib/__tests__/auth.test.ts`, dentro de `describe('signInAnonymouslyAndRegister')`, adicionar:

```ts
  it('insere 3 fichas welcome após criar player com sucesso', async () => {
    const fakeUser = { id: 'uuid-welcome' }
    const fakePlayer = { id: 'uuid-welcome', nickname: 'NewPlayer', phone: '87900000000', created_at: '2026-05-12' }
    mockSignInAnonymously.mockResolvedValueOnce({ data: { user: fakeUser }, error: null })

    const mockFichasInsert = vi.fn().mockResolvedValue({ error: null })
    const mockPlayersInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: fakePlayer, error: null }),
      }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'players') return { insert: mockPlayersInsert }
      if (table === 'fichas') return { insert: mockFichasInsert }
      return { insert: vi.fn() }
    })

    await signInAnonymouslyAndRegister('NewPlayer', '87900000000')

    expect(mockFichasInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ player_id: 'uuid-welcome', amount: 1, reason: 'welcome' }),
      ])
    )
  })
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm test src/lib/__tests__/auth.test.ts 2>&1 | grep "fichas welcome"
```

Esperado: FAIL.

- [ ] **Step 3: Adicionar INSERT de fichas em auth.ts**

Em `src/lib/auth.ts`, após o bloco que insere o player (depois do `if (insertError)`) e antes do `return`:

```ts
  // Inserir 3 fichas welcome (não bloqueia o cadastro se falhar)
  await supabase.from('fichas').insert([
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
  ])

  return { player: player as Player, error: null }
```

- [ ] **Step 4: Rodar testes**

```bash
npm test src/lib/__tests__/auth.test.ts 2>&1 | tail -6
```

Esperado: `4 passed` (3 existentes + 1 novo).

- [ ] **Step 5: Testes completos**

```bash
npm test 2>&1 | tail -6
```

Esperado: `75 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat(auth): inserir 3 fichas welcome no cadastro"
```

---

## Task 6: POST /api/fichas/debit

**Files:**
- Criar: `src/app/api/fichas/debit/route.ts`

- [ ] **Step 1: Criar a rota**

```ts
// src/app/api/fichas/debit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount ?? 1)
  const reason = String(body?.reason ?? 'jogo')

  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: 'amount deve ser inteiro positivo' }, { status: 400 })
  }

  const { data: newBalance, error } = await supabase.rpc('debit_ficha', {
    p_player_id: user.id,
    p_amount: amount,
    p_reason: reason,
  })

  if (error) {
    if (error.message.includes('insufficient_fichas')) {
      return NextResponse.json({ error: 'Fichas insuficientes' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro ao debitar fichas' }, { status: 500 })
  }

  return NextResponse.json({ new_balance: newBalance })
}
```

- [ ] **Step 2: Type check + build**

```bash
npx tsc --noEmit 2>&1 && npm run build 2>&1 | tail -8
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fichas/debit/route.ts
git commit -m "feat(api): POST /api/fichas/debit — debita fichas via RPC atômico"
```

---

## Task 7: ContinueCountdown component

**Files:**
- Criar: `src/components/game/ContinueCountdown.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/game/ContinueCountdown.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  seconds: number
  onContinue: () => void
  onExpire: () => void
}

export default function ContinueCountdown({ seconds, onContinue, onExpire }: Props) {
  const [remaining, setRemaining] = useState(seconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (remaining <= 0) { onExpireRef.current(); return }
    const t = setTimeout(() => setRemaining(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const pct = (remaining / seconds) * 100

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-secondary transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        onClick={onContinue}
        className="font-display text-black bg-secondary text-xl tracking-widest px-8 py-3 rounded w-full active:scale-95 transition-transform"
      >
        CONTINUAR ({remaining}s)
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1
```

Esperado: sem output.

- [ ] **Step 3: Commit**

```bash
git add src/components/game/ContinueCountdown.tsx
git commit -m "feat(ui): ContinueCountdown — countdown 5s com barra de progresso"
```

---

## Task 8: BurgerInvaders.tsx — fase 'continue'

**Files:**
- Modificar: `src/components/game/BurgerInvaders.tsx`

- [ ] **Step 1: Atualizar imports e extrair continueGame do hook**

No topo do arquivo, adicionar:
```ts
import { useFichas } from '@/hooks/useFichas'
import ContinueCountdown from './ContinueCountdown'
```

Na desestruturação de `useGameLoop`:
```ts
const { start, touchStart: rawTouchStart, touchEnd, setPaused, setDragX, continueGame, stateRef } = useGameLoop({
```

- [ ] **Step 2: Adicionar estados e fichas balance**

Após o bloco de estados existentes, adicionar:
```ts
const [finalScore, setFinalScore] = useState(0)
const [finalWave, setFinalWave] = useState(1)
const { balance: fichasBalance, invalidate: invalidateFichas } = useFichas(playerId)
```

- [ ] **Step 3: Atualizar o tipo Phase e onGameOver**

Substituir:
```ts
type Phase = 'title' | 'ready' | 'playing' | 'gameover'
```
Por:
```ts
type Phase = 'title' | 'ready' | 'playing' | 'continue' | 'gameover'
```

No `onGameOver` callback do `useGameLoop`, substituir `setPhase('gameover')` por:
```ts
    onGameOver: async (finalState: GameState) => {
      playDie()
      const stored = parseInt(localStorage.getItem(HISCORE_KEY) ?? '0', 10)
      if (finalState.score > stored) localStorage.setItem(HISCORE_KEY, String(finalState.score))
      if (playerId) {
        await saveScore({ playerId, gameId, score: finalState.score, wave: finalState.wave, season })
      }
      setFinalScore(finalState.score)
      setFinalWave(finalState.wave)
      setPhase('continue')
    },
```

- [ ] **Step 4: Adicionar handlers de continue e game over**

Após o bloco `skipTutorial`, adicionar:

```ts
  const handleContinue = useCallback(async () => {
    if (!playerId || !stateRef.current) return
    const res = await fetch('/api/fichas/debit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1, reason: 'continue_jogo' }),
    })
    if (!res.ok) return
    invalidateFichas()
    continueGame(stateRef.current)
    prevLivesRef.current = 1
    prevScoreRef.current = stateRef.current.score
    setPaused(true)
    setPhase('ready')
    setReadyCount(3)
  }, [playerId, stateRef, invalidateFichas, continueGame, setPaused])

  const handleGameOver = useCallback(() => {
    router.push(`/games/burger-invaders/game-over?score=${finalScore}&wave=${finalWave}`)
  }, [router, finalScore, finalWave])
```

- [ ] **Step 5: Atualizar o useEffect de phase para incluir 'continue'**

Substituir a linha:
```ts
} else if (phase === 'title' || phase === 'gameover' || phase === 'ready') {
```
Por:
```ts
} else if (phase === 'title' || phase === 'gameover' || phase === 'ready' || phase === 'continue') {
```

- [ ] **Step 6: Substituir o overlay de gameover pelo de continue no JSX**

Remover o bloco:
```tsx
{/* Game Over */}
{phase === 'gameover' && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-5 px-6">
    ...
  </div>
)}
```

Adicionar no lugar:
```tsx
{/* Continue — usa ficha para retomar na wave atual */}
{phase === 'continue' && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-5 px-6">
    <span className="font-display text-primary text-4xl tracking-widest">GAME OVER</span>
    <div className="flex flex-col items-center gap-1">
      <span className="font-display text-secondary text-2xl">
        {finalScore.toLocaleString('pt-BR')} PTS
      </span>
      <span className="font-display text-gray-500 text-xs tracking-wider">
        WAVE {finalWave}
      </span>
    </div>

    {fichasBalance > 0 ? (
      <div className="flex flex-col items-center gap-2 w-full">
        <span className="font-display text-white text-sm tracking-wider">
          {fichasBalance} FICHA{fichasBalance > 1 ? 'S' : ''} DISPONÍVE{fichasBalance > 1 ? 'IS' : 'L'}
        </span>
        <ContinueCountdown
          seconds={5}
          onContinue={handleContinue}
          onExpire={handleGameOver}
        />
      </div>
    ) : (
      <span className="text-gray-500 text-xs text-center max-w-xs">
        Sem fichas — faça um pedido para ganhar mais
      </span>
    )}

    <button
      onClick={handleGameOver}
      className="font-display text-gray-400 border border-gray-700 text-base tracking-widest px-6 py-2 rounded"
    >
      VER RESULTADO
    </button>
  </div>
)}
```

- [ ] **Step 7: Type check + build**

```bash
npx tsc --noEmit 2>&1 && npm run build 2>&1 | tail -12
```

Esperado: zero erros.

- [ ] **Step 8: Rodar testes**

```bash
npm test 2>&1 | tail -6
```

Esperado: `75 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/components/game/BurgerInvaders.tsx
git commit -m "feat(game): fase continue — ficha para retomar wave, navega para /game-over"
```

---

## Task 9: GET /api/og — Edge Function

**Files:**
- Criar: `src/app/api/og/route.tsx`

- [ ] **Step 1: Criar a Edge Function**

```tsx
// src/app/api/og/route.tsx
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const score    = Number(searchParams.get('score') ?? 0)
  const wave     = Number(searchParams.get('wave') ?? 1)
  const player   = searchParams.get('player') ?? ''
  const position = searchParams.get('position') ?? ''

  let bangersFont: ArrayBuffer | null = null
  try {
    bangersFont = await fetch(
      'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28wYQ.woff2'
    ).then(r => r.arrayBuffer())
  } catch {
    // fallback sem fonte customizada
  }

  const fonts = bangersFont
    ? [{ name: 'Bangers', data: bangersFont, weight: 400 as const }]
    : []

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: bangersFont ? 'Bangers' : 'serif',
          gap: 16,
          padding: 40,
        }}
      >
        <div style={{ color: '#b92526', fontSize: 24, letterSpacing: 8, display: 'flex' }}>
          90&apos;S BURGERS N&apos;FRIES
        </div>
        <div style={{ color: '#f0df5a', fontSize: 68, letterSpacing: 10, display: 'flex' }}>
          BURGER INVADERS
        </div>
        <div style={{ color: '#ffffff', fontSize: 56, letterSpacing: 4, display: 'flex' }}>
          {score.toLocaleString('pt-BR')} PTS
        </div>
        <div style={{ color: '#ec9837', fontSize: 28, letterSpacing: 6, display: 'flex' }}>
          WAVE {wave}{position ? ` • #${position} NO RANKING` : ''}
        </div>
        {player ? (
          <div style={{ color: '#666666', fontSize: 22, letterSpacing: 4, display: 'flex' }}>
            {player}
          </div>
        ) : null}
        <div style={{ color: '#444444', fontSize: 18, marginTop: 8, letterSpacing: 3, display: 'flex' }}>
          Jogue e ganhe desconto no delivery
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    }
  )
}
```

> Nota: todos os elementos dentro de `ImageResponse` precisam de `display: 'flex'` para renderizar corretamente no Edge runtime.

- [ ] **Step 2: Type check + build**

```bash
npx tsc --noEmit 2>&1 && npm run build 2>&1 | tail -12
```

Esperado: zero erros. A rota `/api/og` deve aparecer na tabela de build como Edge Function.

- [ ] **Step 3: Testar manualmente**

```bash
npm run dev &
curl "http://localhost:3000/api/og?score=12450&wave=7" -o /tmp/test-og.png && file /tmp/test-og.png
```

Esperado: `PNG image data, 1200 x 630`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/og/route.tsx
git commit -m "feat(og): Edge Function /api/og — ImageResponse branding + score + wave"
```

---

## Task 10: /game-over — Server Component + generateMetadata

**Files:**
- Criar: `src/app/games/burger-invaders/game-over/GameOverContent.tsx`
- Modificar: `src/app/games/burger-invaders/game-over/page.tsx`

- [ ] **Step 1: Criar GameOverContent.tsx com o conteúdo atual do GameOverContent**

Mover TODO o conteúdo da função `GameOverContent` do `page.tsx` atual para um arquivo separado. O novo arquivo começa com `'use client'` e usa `useFichas` com destructuring:

```tsx
// src/app/games/burger-invaders/game-over/GameOverContent.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Game } from '@/lib/supabase'
import { useFichas } from '@/hooks/useFichas'
import { useRanking } from '@/hooks/useRanking'

function GameOverContent() {
  const searchParams = useSearchParams()
  const score = Number(searchParams.get('score') ?? 0)
  const wave = Number(searchParams.get('wave') ?? 1)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [game, setGame] = useState<Game | null>(null)
  const { balance: fichas } = useFichas(playerId)
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

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-8 gap-6">
      <h1 className="font-display text-primary text-5xl tracking-widest">GAME OVER</h1>

      <div className="w-full max-w-sm border-2 border-secondary rounded bg-black p-6 text-center">
        <p className="text-gray-400 text-xs tracking-widest uppercase mb-1">Pontuação final</p>
        <p className="font-display text-secondary text-6xl tracking-wider mb-2">
          {score.toLocaleString('pt-BR')}
        </p>
        <p className="text-gray-400 text-sm">Wave {wave}</p>
        {nickname && (
          <p className="text-gray-600 text-xs mt-1">{nickname}</p>
        )}

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

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={shareWhatsApp}
          className="w-full bg-green-700 hover:bg-green-600 font-display text-white text-xl tracking-widest py-3 rounded transition-colors"
        >
          COMPARTILHAR
        </button>

        <a
          href="https://90s.saipos.com"
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

export default function GameOverContentWrapper() {
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

- [ ] **Step 2: Reescrever page.tsx como Server Component**

```tsx
// src/app/games/burger-invaders/game-over/page.tsx
import type { Metadata } from 'next'
import GameOverContentWrapper from './GameOverContent'

type Props = {
  searchParams: { score?: string; wave?: string; player?: string; position?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const score = Number(searchParams.score ?? 0)
  const wave  = Number(searchParams.wave ?? 1)
  const ogUrl = `/api/og?score=${score}&wave=${wave}${searchParams.player ? `&player=${encodeURIComponent(searchParams.player)}` : ''}${searchParams.position ? `&position=${searchParams.position}` : ''}`

  const title = `Fiz ${score.toLocaleString('pt-BR')} pts no Burger Invaders! 👾`

  return {
    title,
    openGraph: {
      title,
      description: 'Jogue Burger Invaders e ganhe desconto no delivery da 90s Burgers!',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [ogUrl],
    },
  }
}

export default function GameOverPage() {
  return <GameOverContentWrapper />
}
```

- [ ] **Step 3: Type check + build**

```bash
npx tsc --noEmit 2>&1 && npm run build 2>&1 | tail -12
```

Esperado: zero erros.

- [ ] **Step 4: Rodar testes completos**

```bash
npm test 2>&1 | tail -6
```

Esperado: `75 passed`.

- [ ] **Step 5: Commit final**

```bash
git add src/app/games/burger-invaders/game-over/GameOverContent.tsx \
        src/app/games/burger-invaders/game-over/page.tsx
git commit -m "feat(game-over): Server Component + generateMetadata OG; extrai GameOverContent"
```

---

## Self-Review

**Spec coverage:**

| Requisito | Task |
|---|---|
| continueGameState — wave atual, lives=1 | Task 2 |
| continueGame no useGameLoop | Task 3 |
| Recharge passivo máx 3 +1/24h | Task 1 (RPC) + Task 4 (hook) |
| Cache sessionStorage (performance) | Task 4 |
| Welcome fichas no cadastro | Task 1 (policy) + Task 5 |
| POST /api/fichas/debit | Task 6 |
| ContinueCountdown 5s | Task 7 |
| Fase 'continue' em BurgerInvaders | Task 8 |
| Navega para /game-over ao desistir | Task 8 |
| OG Image Edge Function | Task 9 |
| generateMetadata com OG tags | Task 10 |
| Cache-Control na OG image | Task 9 |
| Caller page.tsx atualizado | Task 4 |

**Sem placeholders:** todos os steps têm código completo.

**Consistência de tipos:**
- `continueGameState` exportado em Task 2, importado em Task 3 ✓
- `continueGame` exportado em Task 3, usado em Task 8 ✓
- `useFichas` retorna `{ balance, invalidate }` em Task 4, usado em Task 8 e Task 10 ✓
- `debit_ficha` RPC criado em Task 1, chamado em Task 6 ✓
- `recharge_fichas` RPC criado em Task 1, chamado em Task 4 ✓
