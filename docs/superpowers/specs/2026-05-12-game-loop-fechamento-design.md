# Game Loop — Fechamento: Fichas/Continuar, Game Over Share, OG Image

**Data:** 2026-05-12
**Status:** Aprovado
**Repo:** /home/elias-santos/repos/game-90s

---

## Contexto

O Burger Invaders está completo (engine Galaga, sprites, áudio, tutorial). Este spec fecha o loop de negócio:

1. **Fichas como "continuar"** — jogador usa 1 ficha para retomar na wave atual com 1 vida (arcade clássico)
2. **Fichas recharge diário** — saldo máximo 3, recarrega +1 a cada 24h passivamente (jogador sempre tem acesso)
3. **Redirect game over** — ao desistir/sem fichas, navega para `/game-over?score=X&wave=Y` com share WhatsApp real
4. **OG Image dinâmica** — `/api/og` gera imagem compartilhável com score, posição e branding 90s Burgers

---

## Fluxo Principal

```
playing
  └─ engine: gameStatus = 'gameover'
       └─ fase 'continue' (BurgerInvaders.tsx)
            ├─ [tem fichas] → overlay countdown 5s
            │     ├─ clica "CONTINUAR (1 ficha)" → debit ficha → lives=1 → fase 'ready'
            │     └─ countdown expira / "DESISTIR" → router.push(/game-over?score=X&wave=Y)
            └─ [sem fichas] → router.push(/game-over?score=X&wave=Y) imediato
```

---

## Seção 1 — Fichas: Continuar após Game Over

### BurgerInvaders.tsx

Nova fase: `type Phase = 'title' | 'ready' | 'playing' | 'continue' | 'gameover'`

A fase `'gameover'` do overlay inline é **removida** — substituída por `'continue'`.

**`onGameOver` callback no `useGameLoop`:**

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
  setPhase('continue')  // ← era 'gameover'
},
```

**Overlay `'continue'`:**

```tsx
{phase === 'continue' && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-5 px-6">
    <span className="font-display text-primary text-4xl tracking-widest">GAME OVER</span>
    <span className="font-display text-secondary text-2xl">
      {finalScore.toLocaleString('pt-BR')} PTS
    </span>

    {fichasBalance > 0 ? (
      <>
        <span className="font-display text-white text-sm tracking-wider text-center">
          CONTINUAR? {fichasBalance} FICHA{fichasBalance > 1 ? 'S' : ''}
        </span>
        <ContinueCountdown
          seconds={5}
          onContinue={handleContinue}
          onExpire={handleGameOver}
        />
      </>
    ) : (
      <span className="text-gray-500 text-xs">Sem fichas — faça um pedido para ganhar mais</span>
    )}

    <button
      onClick={handleGameOver}
      className="font-display text-gray-400 border border-gray-700 text-base tracking-widest px-6 py-2 rounded"
    >
      DESISTIR
    </button>
  </div>
)}
```

**`handleContinue`:** debita 1 ficha via `POST /api/fichas/debit` → chama `continueGame(stateRef.current!)` do hook → `setPhase('ready')`.

`continueGame` é uma nova função exportada pelo `useGameLoop` que recebe o `GameState` atual, chama `continueGameState(prev)` para criar o novo estado (wave mantida, lives=1) e reinicia o loop sem resetar para wave 1.

**`handleGameOver`:** `router.push(\`/games/burger-invaders/game-over?score=${finalScore}&wave=${finalWave}\`)`.

**`ContinueCountdown`:** componente simples com `useEffect` + `setInterval(1s)`. Ao chegar em 0 chama `onExpire`.

### Engine: continuar na wave atual

`createGameState` atual sempre começa na wave 1. Precisamos de uma variante que retoma:

```ts
export function continueGameState(prev: GameState): GameState {
  return {
    ...createGameState(prev.canvasWidth, prev.canvasHeight),
    wave: prev.wave,
    score: prev.score,
    hiScore: prev.hiScore,
    enemies: buildEnemies(prev.canvasWidth),   // nova formação, mesma wave
    formationVX: FORM_SPEED * (1 + (prev.wave - 1) * 0.12),
    enemyShootInterval: Math.max(800, 2000 - (prev.wave - 1) * 150),
    lives: 1,
  }
}
```

### API: POST /api/fichas/debit

Novo endpoint (ou adaptar `/api/fichas/claim`):

```ts
// POST /api/fichas/debit
// Body: { player_id: string, amount: number, reason: string }
// Verifica que balance >= amount antes de debitar
// INSERT fichas(player_id, amount: -amount, reason)
```

---

## Seção 2 — Fichas: Recharge Diário

### Schema

```sql
ALTER TABLE players ADD COLUMN fichas_recharged_at timestamptz DEFAULT now();
```

### RPC Supabase: `recharge_fichas(p_player_id uuid)`

```sql
CREATE OR REPLACE FUNCTION recharge_fichas(p_player_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_balance    int;
  v_recharged  timestamptz;
  v_hours      float;
  v_to_add     int;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM fichas WHERE player_id = p_player_id;

  SELECT fichas_recharged_at INTO v_recharged
  FROM players WHERE id = p_player_id;

  IF v_balance >= 3 THEN
    RETURN v_balance;
  END IF;

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
```

### useFichas hook (performance)

Chamar a RPC apenas 1× por sessão. Usar `sessionStorage` como cache:

```ts
export function useFichas(playerId: string | null): number {
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    if (!playerId) return

    const cacheKey = `fichas_${playerId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setBalance(Number(cached)); return }

    supabase.rpc('recharge_fichas', { p_player_id: playerId })
      .then(({ data }) => {
        const b = data ?? 0
        setBalance(b)
        sessionStorage.setItem(cacheKey, String(b))
      })
  }, [playerId])

  return balance
}
```

**Invalidar cache** após debit: chamar `sessionStorage.removeItem(\`fichas_${playerId}\`)` em `handleContinue`.

### Fichas de boas-vindas

No `POST /api/auth/register` (ou onde o player é criado): inserir 3 fichas com `reason: 'welcome'`.

---

## Seção 3 — Redirect Game Over + Página /game-over

### BurgerInvaders.tsx

Remover o bloco `{phase === 'gameover' && ...}` existente.
Adicionar `finalScore` e `finalWave` como state.
`handleGameOver` navega para `/games/burger-invaders/game-over?score=${finalScore}&wave=${finalWave}`.

### Página /game-over — tornar Server Component

Converter `GameOverPage` para Server Component com `generateMetadata` para as OG tags:

```ts
// app/games/burger-invaders/game-over/page.tsx
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const score = searchParams.score ?? '0'
  const wave  = searchParams.wave ?? '1'
  const ogUrl = `/api/og?score=${score}&wave=${wave}`
  return {
    title: `Fiz ${Number(score).toLocaleString('pt-BR')} pts no Burger Invaders!`,
    openGraph: {
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: [ogUrl] },
  }
}
```

O conteúdo interativo já está isolado em `GameOverContent` (Client Component dentro de `Suspense`) — sem mudança estrutural.

---

## Seção 4 — OG Image Dinâmica

### Rota: /api/og

**Edge Function** (não serverless) para zero cold start e cache na CDN:

```ts
// app/api/og/route.tsx
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const score    = Number(searchParams.get('score') ?? 0)
  const wave     = Number(searchParams.get('wave') ?? 1)
  const player   = searchParams.get('player') ?? ''
  const position = searchParams.get('position') ?? ''

  const bangersFont = await fetch(
    'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28wYQ.woff2'
  ).then(r => r.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Bangers',
          gap: 16,
        }}
      >
        <div style={{ color: '#b92526', fontSize: 28, letterSpacing: 8 }}>
          90&apos;S BURGERS N&apos;FRIES
        </div>
        <div style={{ color: '#f0df5a', fontSize: 72, letterSpacing: 12 }}>
          BURGER INVADERS
        </div>
        <div style={{ color: '#ffffff', fontSize: 56, letterSpacing: 4 }}>
          {score.toLocaleString('pt-BR')} PTS
        </div>
        <div style={{ color: '#ec9837', fontSize: 32, letterSpacing: 6 }}>
          WAVE {wave}{position ? ` • #${position} NO RANKING` : ''}
        </div>
        {player && (
          <div style={{ color: '#888888', fontSize: 24, letterSpacing: 4 }}>
            {player}
          </div>
        )}
        <div style={{ color: '#555555', fontSize: 20, marginTop: 8, letterSpacing: 3 }}>
          Jogue e ganhe desconto no delivery 🍔
        </div>
      </div>
    ),
    {
      width: 1200, height: 630,
      fonts: [{ name: 'Bangers', data: bangersFont, weight: 400 }],
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
    }
  )
}
```

**URL de share** na página `/game-over` passa `position` quando disponível:

```ts
const ogUrl = `/api/og?score=${score}&wave=${wave}&player=${nickname}&position=${position ?? ''}`
```

---

## Performance no Free Tier

| Componente | Carga | Solução |
|---|---|---|
| OG Image | Alta se viral (crawlers WhatsApp) | Edge + `s-maxage=86400` — CDN Vercel serve do cache por URL |
| recharge_fichas RPC | 1× por sessão por usuário | sessionStorage evita re-chamadas; sem polling |
| Realtime fichas | 200 conexões simultâneas | Não usar Realtime para fichas — pull-on-demand é suficiente |
| Canvas gameplay | Zero servidor | Tudo client-side durante o jogo |
| Supabase pausa | 7 dias sem acesso | Admin acessa semanalmente; migra para Pro quando crescer |

**Capacidade estimada no free tier:** 50–100 usuários simultâneos sem problema. Gargalo real seria Supabase pool (60 conexões) — mitigado pelo pooler URL e ausência de polling.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/game/engine.ts` | +`continueGameState()` |
| `src/hooks/useGameLoop.ts` | +`continueGame(prevState: GameState)` — reinicia loop a partir de estado existente |
| `src/hooks/useFichas.ts` | sessionStorage cache + chamar RPC recharge |
| `src/components/game/BurgerInvaders.tsx` | +fase 'continue', +ContinueCountdown, -overlay gameover inline |
| `src/components/game/ContinueCountdown.tsx` | Novo componente |
| `src/app/api/fichas/debit/route.ts` | Novo endpoint |
| `src/app/api/og/route.tsx` | Novo — Edge Function ImageResponse |
| `src/app/games/burger-invaders/game-over/page.tsx` | +generateMetadata, +OG tags |
| Supabase | +`fichas_recharged_at` em players, +RPC `recharge_fichas`, +3 fichas welcome no cadastro |

---

## Fora de Escopo

- App mobile nativo
- Múltiplos jogos ativos
- Push notifications de fichas
- Compartilhar no Instagram nativo (API fechada — clipboard já resolve)
