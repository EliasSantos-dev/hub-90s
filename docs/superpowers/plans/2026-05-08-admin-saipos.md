# 90s Burgers — Plano 2: Admin Panel + Saipos Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel admin completo em `/admin` com autenticação por email/senha, dashboard de KPIs, gerenciamento de players/games/fichas e integração via webhook com o Saipos para crédito automático de fichas.

**Architecture:** O admin é um conjunto de rotas Next.js App Router protegidas por middleware que valida a session Supabase com `user_metadata.role === 'admin'`. A lógica de negócio fica em Server Actions dentro de `src/lib/admin/`, mantendo o banco de dados como única fonte de verdade. O webhook Saipos é um Route Handler em `src/app/api/webhooks/saipos/route.ts` que valida HMAC, resolve o player pelo telefone e insere fichas via regras configuráveis na tabela `ficha_rules`.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + Auth), Tailwind CSS, Bangers (Google Fonts), TypeScript, Vitest

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/middleware.ts` | Protege `/admin/*`, redireciona para `/admin/login` se não autenticado ou sem role admin |
| `src/app/admin/layout.tsx` | Layout compartilhado com `AdminSidebar` |
| `src/app/admin/login/page.tsx` | Formulário email + senha |
| `src/app/admin/page.tsx` | Dashboard com KPIs, ranking top 3, painel Saipos |
| `src/app/admin/players/page.tsx` | Tabela de players, busca, exportar CSV, grant manual |
| `src/app/admin/games/page.tsx` | Lista de games, toggles, configs, nova temporada |
| `src/app/admin/fichas/page.tsx` | Regras de fichas, histórico, grant manual |
| `src/app/admin/saipos/page.tsx` | Status integração, log webhooks, botão testar |
| `src/app/api/webhooks/saipos/route.ts` | Handler do webhook Saipos |
| `src/components/admin/AdminSidebar.tsx` | Navegação lateral do admin |
| `src/components/admin/KpiCard.tsx` | Card de KPI reutilizável |
| `src/components/admin/PlayersTable.tsx` | Tabela de players com busca e ações |
| `src/components/admin/GamesTable.tsx` | Tabela de games com toggles e config |
| `src/components/admin/FichaRulesTable.tsx` | CRUD de regras de fichas |
| `src/components/admin/FichasHistoryTable.tsx` | Histórico de transações de fichas |
| `src/components/admin/SaiposLog.tsx` | Log de webhooks recebidos |
| `src/lib/admin/players.ts` | Server Actions: listar, buscar, grant fichas, exportar CSV |
| `src/lib/admin/games.ts` | Server Actions: toggle ativo, atualizar config, nova temporada |
| `src/lib/admin/fichas-admin.ts` | Server Actions: CRUD ficha_rules, grant manual, histórico |
| `src/lib/webhooks/saipos.ts` | Lógica pura de processamento do webhook (validação, regras, insert) |
| `src/lib/supabase/server.ts` | Cliente Supabase server-side (já existe do Plano 1) |
| `supabase/migrations/002_ficha_rules.sql` | Migration para tabela `ficha_rules` e `webhook_logs` |
| `src/types/admin.ts` | Tipos TypeScript compartilhados do admin |
| `src/tests/webhooks/saipos.test.ts` | Testes unitários do processamento webhook |
| `src/tests/admin/fichas-admin.test.ts` | Testes unitários das regras de fichas |
| `src/tests/admin/players.test.ts` | Testes unitários das actions de players |

---

## Task 1: Migration — tabelas `ficha_rules` e `webhook_logs`

**Files:**
- Create: `supabase/migrations/002_ficha_rules.sql`

- [ ] **Step 1: Escrever a migration SQL**

```sql
-- supabase/migrations/002_ficha_rules.sql

CREATE TABLE IF NOT EXISTS ficha_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_order_value  numeric NOT NULL DEFAULT 0,
  fichas_amount    int NOT NULL DEFAULT 3,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- Regra padrão: qualquer pedido = 3 fichas
INSERT INTO ficha_rules (min_order_value, fichas_amount, active)
VALUES (0, 3, true);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     timestamptz DEFAULT now(),
  phone           text,
  order_id        text,
  order_value     numeric,
  fichas_credited int,
  player_found    boolean DEFAULT false,
  status          text NOT NULL DEFAULT 'ok', -- 'ok' | 'player_not_found' | 'error' | 'invalid_signature'
  raw_payload     jsonb
);

-- RLS: só admin pode ler/escrever ficha_rules e webhook_logs
ALTER TABLE ficha_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_ficha_rules" ON ficha_rules
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_all_webhook_logs" ON webhook_logs
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Service role pode inserir em webhook_logs (para o webhook endpoint)
CREATE POLICY "service_insert_webhook_logs" ON webhook_logs
  FOR INSERT WITH CHECK (true);

-- Service role pode inserir em fichas (já deve existir do Plano 1, mas garantir)
```

- [ ] **Step 2: Aplicar a migration**

```bash
npx supabase db push
```

Expected output:
```
Applying migration 002_ficha_rules.sql...
Migration applied successfully.
```

- [ ] **Step 3: Verificar tabelas criadas**

```bash
npx supabase db diff
```

Expected: sem diff pendente (migration aplicada).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_ficha_rules.sql
git commit -m "feat: migration ficha_rules e webhook_logs"
```

---

## Task 2: Tipos TypeScript compartilhados do admin

**Files:**
- Create: `src/types/admin.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```typescript
// src/types/admin.ts

export interface Player {
  id: string
  nickname: string
  phone: string
  created_at: string
  best_score: number | null
  has_active_discount: boolean
  ficha_balance: number
}

export interface Game {
  id: string
  name: string
  slug: string
  active: boolean
  top_n_discount: number
  discount_pct: number
  season: number
}

export interface FichaRule {
  id: string
  min_order_value: number
  fichas_amount: number
  active: boolean
  created_at: string
}

export interface FichaTransaction {
  id: string
  player_id: string
  player_nickname: string
  amount: number
  reason: string
  ref_id: string | null
  created_at: string
}

export interface WebhookLog {
  id: string
  received_at: string
  phone: string | null
  order_id: string | null
  order_value: number | null
  fichas_credited: number | null
  player_found: boolean
  status: 'ok' | 'player_not_found' | 'error' | 'invalid_signature'
  raw_payload: Record<string, unknown> | null
}

export interface AdminKpis {
  total_players: number
  total_fichas_distributed: number
  active_discounts: number
  total_webhook_orders: number
}

export interface RankingRow {
  position: number
  player_id: string
  nickname: string
  phone: string
  score: number
  game_id: string
  game_name: string
}

export interface SaiposPayload {
  event: string
  order_id: string
  customer: {
    phone: string
    name: string
  }
  total: number
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/admin.ts
git commit -m "feat: tipos TypeScript do admin panel"
```

---

## Task 3: Middleware de autenticação admin

**Files:**
- Create or Modify: `src/middleware.ts`

- [ ] **Step 1: Escrever o teste do middleware (lógica de redirecionamento)**

```typescript
// src/tests/middleware.test.ts
import { describe, it, expect, vi } from 'vitest'

// Testa a função auxiliar que extrai a role do JWT, não o middleware inteiro
// (Next.js middleware não é testável com Vitest diretamente)
import { extractAdminRole } from '@/lib/admin/auth'

describe('extractAdminRole', () => {
  it('retorna true quando user_metadata.role é admin', () => {
    const user = {
      user_metadata: { role: 'admin' },
      app_metadata: {},
    }
    expect(extractAdminRole(user)).toBe(true)
  })

  it('retorna false quando role está ausente', () => {
    const user = {
      user_metadata: {},
      app_metadata: {},
    }
    expect(extractAdminRole(user)).toBe(false)
  })

  it('retorna false quando user é null', () => {
    expect(extractAdminRole(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run src/tests/middleware.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin/auth'`

- [ ] **Step 3: Criar `src/lib/admin/auth.ts` com a função auxiliar**

```typescript
// src/lib/admin/auth.ts

export function extractAdminRole(user: { user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false
  return user.user_metadata?.role === 'admin'
}
```

- [ ] **Step 4: Criar/atualizar `src/middleware.ts`**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Só aplica proteção nas rotas /admin (exceto /admin/login)
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAdmin = user?.user_metadata?.role === 'admin'

  if (!isAdmin) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/tests/middleware.test.ts
```

Expected: PASS — 3 tests passed

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/lib/admin/auth.ts src/tests/middleware.test.ts
git commit -m "feat: middleware de proteção das rotas admin"
```

---

## Task 4: Login admin (`/admin/login`)

**Files:**
- Create: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Criar a página de login**

```typescript
// src/app/admin/login/page.tsx
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    if (data.user.user_metadata?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Acesso negado. Usuário não é admin.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://redirect90s.vercel.app/assets/logo1.png"
            alt="90s Burgers"
            className="h-16 mx-auto mb-4"
          />
          <h1
            className="text-4xl text-[#f0df5a]"
            style={{ fontFamily: 'Bangers, cursive' }}
          >
            ADMIN PANEL
          </h1>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-[#1a1a1a] border border-[#b92526] rounded-lg p-8 space-y-4"
        >
          <div>
            <label className="block text-[#f0df5a] text-sm font-bold mb-1">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              placeholder="admin@90sburgers.com"
            />
          </div>

          <div>
            <label className="block text-[#f0df5a] text-sm font-bold mb-1">
              SENHA
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#b92526] hover:bg-[#d42828] disabled:opacity-50 text-white font-bold py-3 rounded transition-colors"
            style={{ fontFamily: 'Bangers, cursive', fontSize: '1.25rem', letterSpacing: '0.05em' }}
          >
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Testar manualmente no browser**

Acesse `http://localhost:3000/admin/login`.
Expected: Formulário renderiza sem erros de compilação.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx
git commit -m "feat: página de login do admin"
```

---

## Task 5: Layout do admin com `AdminSidebar`

**Files:**
- Create: `src/components/admin/AdminSidebar.tsx`
- Create: `src/app/admin/layout.tsx`

- [ ] **Step 1: Criar `AdminSidebar`**

```typescript
// src/components/admin/AdminSidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { href: '/admin', label: 'DASHBOARD', icon: '📊' },
  { href: '/admin/players', label: 'PLAYERS', icon: '👥' },
  { href: '/admin/games', label: 'GAMES', icon: '🎮' },
  { href: '/admin/fichas', label: 'FICHAS', icon: '🪙' },
  { href: '/admin/saipos', label: 'SAIPOS', icon: '🔗' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-[#0a0a0a] border-r border-[#222] flex flex-col">
      <div className="p-4 border-b border-[#222]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://redirect90s.vercel.app/assets/logo1.png"
          alt="90s Burgers"
          className="h-10"
        />
        <p
          className="text-[#f0df5a] text-xs mt-1"
          style={{ fontFamily: 'Bangers, cursive' }}
        >
          ADMIN PANEL
        </p>
      </div>

      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive =
            href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-[#b92526] text-white'
                  : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
              }`}
              style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-[#222]">
        <button
          onClick={handleLogout}
          className="w-full text-left text-[#888] hover:text-[#b92526] text-sm font-bold transition-colors"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          ⬛ SAIR
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Criar `src/app/admin/layout.tsx`**

```typescript
// src/app/admin/layout.tsx
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Testar navegação manual**

Logue como admin e navegue entre as rotas. A sidebar deve destacar a rota ativa.
Expected: link ativo tem fundo `#b92526`, demais têm cor `#888`.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx src/app/admin/layout.tsx
git commit -m "feat: layout admin com sidebar de navegação"
```

---

## Task 6: `KpiCard` — componente reutilizável de KPI

**Files:**
- Create: `src/components/admin/KpiCard.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
// src/components/admin/KpiCard.tsx

interface KpiCardProps {
  label: string
  value: string | number
  description?: string
  accent?: 'red' | 'yellow' | 'orange'
}

const ACCENT_COLORS = {
  red: 'border-[#b92526] text-[#b92526]',
  yellow: 'border-[#f0df5a] text-[#f0df5a]',
  orange: 'border-[#ec9837] text-[#ec9837]',
}

export function KpiCard({ label, value, description, accent = 'yellow' }: KpiCardProps) {
  return (
    <div
      className={`bg-[#1a1a1a] border-l-4 rounded-lg p-5 ${ACCENT_COLORS[accent]}`}
    >
      <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-1">
        {label}
      </p>
      <p
        className="text-4xl font-bold"
        style={{ fontFamily: 'Bangers, cursive' }}
      >
        {value}
      </p>
      {description && (
        <p className="text-[#555] text-xs mt-1">{description}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/KpiCard.tsx
git commit -m "feat: componente KpiCard para dashboard admin"
```

---

## Task 7: Server Actions — `src/lib/admin/players.ts`

**Files:**
- Create: `src/lib/admin/players.ts`
- Create: `src/tests/admin/players.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/tests/admin/players.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildPlayerSearchQuery,
  buildCsvFromPlayers,
} from '@/lib/admin/players'
import type { Player } from '@/types/admin'

describe('buildPlayerSearchQuery', () => {
  it('retorna objeto com ilike quando há termo de busca', () => {
    const result = buildPlayerSearchQuery('joao')
    expect(result).toEqual({ term: '%joao%' })
  })

  it('retorna null quando busca está vazia', () => {
    const result = buildPlayerSearchQuery('')
    expect(result).toBeNull()
  })

  it('retorna null quando busca é apenas espaços', () => {
    const result = buildPlayerSearchQuery('   ')
    expect(result).toBeNull()
  })
})

describe('buildCsvFromPlayers', () => {
  const players: Player[] = [
    {
      id: '1',
      nickname: 'Teste',
      phone: '11999999999',
      created_at: '2026-01-01T00:00:00Z',
      best_score: 1500,
      has_active_discount: true,
      ficha_balance: 5,
    },
  ]

  it('gera CSV com cabeçalho correto', () => {
    const csv = buildCsvFromPlayers(players)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro'
    )
  })

  it('gera linha de dados corretamente', () => {
    const csv = buildCsvFromPlayers(players)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('Teste,11999999999,1500,sim,5,2026-01-01T00:00:00Z')
  })

  it('retorna só cabeçalho quando lista está vazia', () => {
    const csv = buildCsvFromPlayers([])
    expect(csv).toBe(
      'nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro'
    )
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npx vitest run src/tests/admin/players.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin/players'`

- [ ] **Step 3: Implementar `src/lib/admin/players.ts`**

```typescript
// src/lib/admin/players.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Player, FichaTransaction } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export function buildPlayerSearchQuery(term: string): { term: string } | null {
  const trimmed = term.trim()
  if (!trimmed) return null
  return { term: `%${trimmed}%` }
}

export function buildCsvFromPlayers(players: Player[]): string {
  const header = 'nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro'
  if (players.length === 0) return header

  const rows = players.map((p) =>
    [
      p.nickname,
      p.phone,
      p.best_score ?? 0,
      p.has_active_discount ? 'sim' : 'não',
      p.ficha_balance,
      p.created_at,
    ].join(',')
  )

  return [header, ...rows].join('\n')
}

export async function listPlayers(search?: string): Promise<Player[]> {
  const supabase = getSupabaseAdmin()

  // Busca base: players com saldo de fichas (soma) e melhor score
  let query = supabase
    .from('players')
    .select(`
      id,
      nickname,
      phone,
      created_at
    `)
    .order('created_at', { ascending: false })

  const parsed = search ? buildPlayerSearchQuery(search) : null
  if (parsed) {
    query = query.or(`nickname.ilike.${parsed.term},phone.ilike.${parsed.term}`)
  }

  const { data: rawPlayers, error } = await query

  if (error || !rawPlayers) return []

  // Enriquecer com fichas, melhor score e desconto ativo
  const enriched = await Promise.all(
    rawPlayers.map(async (p) => {
      const [fichasRes, scoreRes, discountRes] = await Promise.all([
        supabase
          .from('fichas')
          .select('amount')
          .eq('player_id', p.id),
        supabase
          .from('scores')
          .select('score')
          .eq('player_id', p.id)
          .order('score', { ascending: false })
          .limit(1),
        supabase
          .from('active_discounts')
          .select('player_id')
          .eq('player_id', p.id)
          .limit(1),
      ])

      const ficha_balance = (fichasRes.data ?? []).reduce(
        (sum, f) => sum + (f.amount ?? 0),
        0
      )
      const best_score = scoreRes.data?.[0]?.score ?? null
      const has_active_discount = (discountRes.data?.length ?? 0) > 0

      return {
        ...p,
        best_score,
        has_active_discount,
        ficha_balance,
      } satisfies Player
    })
  )

  return enriched
}

export async function grantFichasToPlayer(
  player_id: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!player_id || amount === 0 || !reason.trim()) {
    return { success: false, error: 'Dados inválidos.' }
  }

  const supabase = getSupabaseAdmin()

  const { error } = await supabase.from('fichas').insert({
    player_id,
    amount,
    reason,
    ref_id: null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/tests/admin/players.test.ts
```

Expected: PASS — 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/players.ts src/tests/admin/players.test.ts
git commit -m "feat: server actions de players admin com testes"
```

---

## Task 8: Server Actions — `src/lib/admin/games.ts`

**Files:**
- Create: `src/lib/admin/games.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// src/lib/admin/games.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Game } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function listGames(): Promise<Game[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('name')

  if (error || !data) return []
  return data as Game[]
}

export async function toggleGameActive(
  game_id: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('games')
    .update({ active })
    .eq('id', game_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateGameConfig(
  game_id: string,
  top_n_discount: number,
  discount_pct: number
): Promise<{ success: boolean; error?: string }> {
  if (top_n_discount < 1 || discount_pct < 1 || discount_pct > 100) {
    return { success: false, error: 'Configuração inválida.' }
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('games')
    .update({ top_n_discount, discount_pct })
    .eq('id', game_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function startNewSeason(
  game_id: string
): Promise<{ success: boolean; new_season?: number; error?: string }> {
  const supabase = getSupabaseAdmin()

  // Busca season atual
  const { data: game, error: fetchError } = await supabase
    .from('games')
    .select('season')
    .eq('id', game_id)
    .single()

  if (fetchError || !game) {
    return { success: false, error: 'Game não encontrado.' }
  }

  const new_season = game.season + 1

  const { error } = await supabase
    .from('games')
    .update({ season: new_season })
    .eq('id', game_id)

  if (error) return { success: false, error: error.message }
  return { success: true, new_season }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/games.ts
git commit -m "feat: server actions de games admin"
```

---

## Task 9: Server Actions — `src/lib/admin/fichas-admin.ts`

**Files:**
- Create: `src/lib/admin/fichas-admin.ts`
- Create: `src/tests/admin/fichas-admin.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/tests/admin/fichas-admin.test.ts
import { describe, it, expect } from 'vitest'
import { applyFichaRule, validateFichaRule } from '@/lib/admin/fichas-admin'
import type { FichaRule } from '@/types/admin'

describe('applyFichaRule', () => {
  const rules: FichaRule[] = [
    { id: '1', min_order_value: 0, fichas_amount: 3, active: true, created_at: '' },
    { id: '2', min_order_value: 50, fichas_amount: 5, active: true, created_at: '' },
    { id: '3', min_order_value: 100, fichas_amount: 8, active: true, created_at: '' },
    { id: '4', min_order_value: 30, fichas_amount: 4, active: false, created_at: '' },
  ]

  it('aplica a regra de maior valor que o pedido satisfaz', () => {
    expect(applyFichaRule(rules, 120)).toBe(8)
  })

  it('aplica a regra de R$50 para pedido de R$75', () => {
    expect(applyFichaRule(rules, 75)).toBe(5)
  })

  it('aplica a regra base (R$0) para pedido de R$20', () => {
    expect(applyFichaRule(rules, 20)).toBe(3)
  })

  it('ignora regras inativas', () => {
    // R$35 satisfaria a regra id=4 (R$30), mas está inativa; cai na base (R$0 = 3)
    expect(applyFichaRule(rules, 35)).toBe(3)
  })

  it('retorna 0 quando não há regras ativas', () => {
    expect(applyFichaRule([], 50)).toBe(0)
  })
})

describe('validateFichaRule', () => {
  it('válido com valores corretos', () => {
    expect(validateFichaRule(0, 3)).toBeNull()
  })

  it('inválido quando fichas_amount é zero', () => {
    expect(validateFichaRule(10, 0)).toBe('Quantidade de fichas deve ser maior que zero.')
  })

  it('inválido quando min_order_value é negativo', () => {
    expect(validateFichaRule(-1, 3)).toBe('Valor mínimo do pedido não pode ser negativo.')
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npx vitest run src/tests/admin/fichas-admin.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin/fichas-admin'`

- [ ] **Step 3: Implementar `src/lib/admin/fichas-admin.ts`**

```typescript
// src/lib/admin/fichas-admin.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { FichaRule, FichaTransaction } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// Funções puras exportadas para teste
export function applyFichaRule(rules: FichaRule[], orderValue: number): number {
  const activeRules = rules
    .filter((r) => r.active && r.min_order_value <= orderValue)
    .sort((a, b) => b.min_order_value - a.min_order_value)

  if (activeRules.length === 0) return 0
  return activeRules[0].fichas_amount
}

export function validateFichaRule(
  min_order_value: number,
  fichas_amount: number
): string | null {
  if (min_order_value < 0)
    return 'Valor mínimo do pedido não pode ser negativo.'
  if (fichas_amount <= 0)
    return 'Quantidade de fichas deve ser maior que zero.'
  return null
}

export async function listFichaRules(): Promise<FichaRule[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ficha_rules')
    .select('*')
    .order('min_order_value')

  if (error || !data) return []
  return data as FichaRule[]
}

export async function addFichaRule(
  min_order_value: number,
  fichas_amount: number
): Promise<{ success: boolean; error?: string }> {
  const validationError = validateFichaRule(min_order_value, fichas_amount)
  if (validationError) return { success: false, error: validationError }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('ficha_rules').insert({
    min_order_value,
    fichas_amount,
    active: true,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function removeFichaRule(
  rule_id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('ficha_rules')
    .delete()
    .eq('id', rule_id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listFichaHistory(
  player_id?: string
): Promise<FichaTransaction[]> {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('fichas')
    .select(`
      id,
      player_id,
      amount,
      reason,
      ref_id,
      created_at,
      players ( nickname )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (player_id) {
    query = query.eq('player_id', player_id)
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map((row: {
    id: string
    player_id: string
    amount: number
    reason: string
    ref_id: string | null
    created_at: string
    players: { nickname: string } | null
  }) => ({
    id: row.id,
    player_id: row.player_id,
    player_nickname: row.players?.nickname ?? 'Desconhecido',
    amount: row.amount,
    reason: row.reason,
    ref_id: row.ref_id,
    created_at: row.created_at,
  })) satisfies FichaTransaction[]
}

export async function grantFichasAdmin(
  player_id: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!player_id || amount === 0 || !reason.trim()) {
    return { success: false, error: 'Dados inválidos.' }
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('fichas').insert({
    player_id,
    amount,
    reason,
    ref_id: null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/tests/admin/fichas-admin.test.ts
```

Expected: PASS — 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/fichas-admin.ts src/tests/admin/fichas-admin.test.ts
git commit -m "feat: server actions de fichas admin com testes"
```

---

## Task 10: Lógica do webhook Saipos — `src/lib/webhooks/saipos.ts`

**Files:**
- Create: `src/lib/webhooks/saipos.ts`
- Create: `src/tests/webhooks/saipos.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/tests/webhooks/saipos.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateSaiposSignature,
  extractOrderData,
  normalizePhone,
} from '@/lib/webhooks/saipos'
import type { SaiposPayload } from '@/types/admin'

describe('normalizePhone', () => {
  it('remove todos os caracteres não numéricos', () => {
    expect(normalizePhone('+55 (87) 9 9999-9999')).toBe('558799999999')
  })

  it('mantém número já normalizado', () => {
    expect(normalizePhone('87999999999')).toBe('87999999999')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizePhone('')).toBe('')
  })
})

describe('extractOrderData', () => {
  const payload: SaiposPayload = {
    event: 'order.confirmed',
    order_id: 'ORD-001',
    customer: {
      phone: '+55 (87) 9 9999-9999',
      name: 'João',
    },
    total: 75.5,
    created_at: '2026-01-01T12:00:00Z',
  }

  it('extrai telefone normalizado e valor total', () => {
    const result = extractOrderData(payload)
    expect(result.phone).toBe('558799999999')
    expect(result.order_id).toBe('ORD-001')
    expect(result.total).toBe(75.5)
  })
})

describe('validateSaiposSignature', () => {
  it('retorna true quando o token bate com o secret', () => {
    // Simulação simples: o header é o próprio secret (bearer token)
    expect(
      validateSaiposSignature('meu-secret-123', 'Bearer meu-secret-123')
    ).toBe(true)
  })

  it('retorna false quando o token não bate', () => {
    expect(
      validateSaiposSignature('meu-secret-123', 'Bearer errado')
    ).toBe(false)
  })

  it('retorna false quando header está ausente', () => {
    expect(validateSaiposSignature('meu-secret-123', '')).toBe(false)
  })

  it('retorna false quando secret está ausente (env não configurado)', () => {
    expect(validateSaiposSignature('', 'Bearer qualquer')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npx vitest run src/tests/webhooks/saipos.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/webhooks/saipos'`

- [ ] **Step 3: Implementar `src/lib/webhooks/saipos.ts`**

```typescript
// src/lib/webhooks/saipos.ts

import type { SaiposPayload } from '@/types/admin'

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function extractOrderData(payload: SaiposPayload): {
  phone: string
  order_id: string
  total: number
} {
  return {
    phone: normalizePhone(payload.customer.phone),
    order_id: payload.order_id,
    total: payload.total,
  }
}

export function validateSaiposSignature(
  secret: string,
  authorizationHeader: string
): boolean {
  if (!secret || !authorizationHeader) return false
  const expected = `Bearer ${secret}`
  return authorizationHeader === expected
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/tests/webhooks/saipos.test.ts
```

Expected: PASS — 7 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhooks/saipos.ts src/tests/webhooks/saipos.test.ts
git commit -m "feat: lógica pura do webhook Saipos com testes"
```

---

## Task 11: Route Handler do webhook — `POST /api/webhooks/saipos`

**Files:**
- Create: `src/app/api/webhooks/saipos/route.ts`

- [ ] **Step 1: Criar o Route Handler**

```typescript
// src/app/api/webhooks/saipos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  validateSaiposSignature,
  extractOrderData,
} from '@/lib/webhooks/saipos'
import { applyFichaRule } from '@/lib/admin/fichas-admin'
import type { SaiposPayload, FichaRule } from '@/types/admin'

function getSupabaseServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const secret = process.env.SAIPOS_WEBHOOK_SECRET ?? ''
  const authHeader = request.headers.get('authorization') ?? ''

  // 1. Validar assinatura
  if (!validateSaiposSignature(secret, authHeader)) {
    await logWebhookAttempt(null, 'invalid_signature', request)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: SaiposPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Só processa pedidos confirmados
  if (payload.event !== 'order.confirmed') {
    return NextResponse.json({ ok: true, message: 'Event ignored' })
  }

  const { phone, order_id, total } = extractOrderData(payload)
  const supabase = getSupabaseServiceRole()

  // 2. Buscar player pelo telefone (normalizado)
  const { data: players } = await supabase
    .from('players')
    .select('id, phone')
    .or(`phone.eq.${phone},phone.eq.55${phone}`)
    .limit(1)

  const player = players?.[0] ?? null

  if (!player) {
    await supabase.from('webhook_logs').insert({
      phone,
      order_id,
      order_value: total,
      fichas_credited: 0,
      player_found: false,
      status: 'player_not_found',
      raw_payload: payload,
    })
    return NextResponse.json({ ok: true, message: 'Player not found, logged' })
  }

  // 3. Buscar regras de fichas ativas
  const { data: rulesData } = await supabase
    .from('ficha_rules')
    .select('*')
    .eq('active', true)
    .order('min_order_value')

  const rules: FichaRule[] = rulesData ?? []
  const fichasAmount = applyFichaRule(rules, total)

  // 4. Verificar idempotência (order_id já processado?)
  const { data: existingLog } = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('order_id', order_id)
    .eq('status', 'ok')
    .limit(1)

  if (existingLog && existingLog.length > 0) {
    return NextResponse.json({ ok: true, message: 'Order already processed' })
  }

  // 5. Creditar fichas
  if (fichasAmount > 0) {
    await supabase.from('fichas').insert({
      player_id: player.id,
      amount: fichasAmount,
      reason: 'pedido_saipos',
      ref_id: order_id,
    })
  }

  // 6. Registrar log
  await supabase.from('webhook_logs').insert({
    phone,
    order_id,
    order_value: total,
    fichas_credited: fichasAmount,
    player_found: true,
    status: 'ok',
    raw_payload: payload,
  })

  return NextResponse.json({ ok: true, fichas_credited: fichasAmount })
}

async function logWebhookAttempt(
  payload: unknown,
  status: string,
  request: NextRequest
) {
  try {
    const supabase = getSupabaseServiceRole()
    let rawPayload: Record<string, unknown> | null = null
    try {
      rawPayload = await request.json()
    } catch {
      // payload inválido, segue
    }
    await supabase.from('webhook_logs').insert({
      phone: null,
      order_id: null,
      order_value: null,
      fichas_credited: 0,
      player_found: false,
      status,
      raw_payload: rawPayload,
    })
  } catch {
    // Falha silenciosa no log
  }
}
```

- [ ] **Step 2: Adicionar `SAIPOS_WEBHOOK_SECRET` ao `.env.local`**

```bash
# Adicionar ao .env.local
echo "SAIPOS_WEBHOOK_SECRET=seu-secret-aqui" >> .env.local
```

- [ ] **Step 3: Testar o endpoint manualmente**

```bash
curl -X POST http://localhost:3000/api/webhooks/saipos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-secret-aqui" \
  -d '{
    "event": "order.confirmed",
    "order_id": "TEST-001",
    "customer": {"phone": "87999999999", "name": "Teste"},
    "total": 60,
    "created_at": "2026-01-01T12:00:00Z"
  }'
```

Expected:
```json
{"ok":true,"fichas_credited":5}
```
(ou `player_not_found` se o telefone não existir no banco)

- [ ] **Step 4: Testar com assinatura inválida**

```bash
curl -X POST http://localhost:3000/api/webhooks/saipos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer errado" \
  -d '{"event":"order.confirmed"}'
```

Expected: `{"error":"Unauthorized"}` com status 401

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/saipos/route.ts .env.local
git commit -m "feat: route handler POST /api/webhooks/saipos com idempotência"
```

---

## Task 12: KPIs do dashboard — `src/lib/admin/dashboard.ts`

**Files:**
- Create: `src/lib/admin/dashboard.ts`

- [ ] **Step 1: Criar o arquivo de queries do dashboard**

```typescript
// src/lib/admin/dashboard.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { AdminKpis, RankingRow, WebhookLog } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const supabase = getSupabaseAdmin()

  const [
    playersRes,
    fichasRes,
    discountsRes,
    ordersRes,
  ] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }),
    supabase.from('fichas').select('amount').gt('amount', 0),
    supabase.from('active_discounts').select('player_id', { count: 'exact', head: true }),
    supabase
      .from('webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ok'),
  ])

  const total_fichas_distributed = (fichasRes.data ?? []).reduce(
    (sum, f) => sum + f.amount,
    0
  )

  return {
    total_players: playersRes.count ?? 0,
    total_fichas_distributed,
    active_discounts: discountsRes.count ?? 0,
    total_webhook_orders: ordersRes.count ?? 0,
  }
}

export async function getDashboardRanking(): Promise<RankingRow[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('ranking')
    .select(`
      position,
      player_id,
      score,
      game_id,
      players ( nickname, phone ),
      games ( name )
    `)
    .lte('position', 3)
    .order('position')

  if (error || !data) return []

  return data.map((row: {
    position: number
    player_id: string
    score: number
    game_id: string
    players: { nickname: string; phone: string } | null
    games: { name: string } | null
  }) => ({
    position: row.position,
    player_id: row.player_id,
    nickname: row.players?.nickname ?? '???',
    phone: row.players?.phone ?? '',
    score: row.score,
    game_id: row.game_id,
    game_name: row.games?.name ?? '???',
  })) satisfies RankingRow[]
}

export async function getRecentWebhookLogs(limit = 4): Promise<WebhookLog[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as WebhookLog[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/dashboard.ts
git commit -m "feat: queries de KPIs e ranking para o dashboard admin"
```

---

## Task 13: Dashboard page — `/admin`

**Files:**
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Criar a página**

```typescript
// src/app/admin/page.tsx
import { KpiCard } from '@/components/admin/KpiCard'
import { getAdminKpis, getDashboardRanking, getRecentWebhookLogs } from '@/lib/admin/dashboard'
import { listFichaRules } from '@/lib/admin/fichas-admin'

export default async function AdminDashboardPage() {
  const [kpis, ranking, recentLogs, fichaRules] = await Promise.all([
    getAdminKpis(),
    getDashboardRanking(),
    getRecentWebhookLogs(4),
    listFichaRules(),
  ])

  const activeRule = fichaRules.find((r) => r.active && r.min_order_value === 0)
  const webhookUrl =
    typeof window === 'undefined'
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://seusite.com'}/api/webhooks/saipos`
      : `${window.location.origin}/api/webhooks/saipos`

  const POSITION_BADGES = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6">
      <h1
        className="text-4xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        DASHBOARD
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Players"
          value={kpis.total_players}
          accent="yellow"
        />
        <KpiCard
          label="Fichas Distribuídas"
          value={kpis.total_fichas_distributed}
          accent="orange"
        />
        <KpiCard
          label="Descontos Ativos"
          value={kpis.active_discounts}
          accent="red"
        />
        <KpiCard
          label="Pedidos via Saipos"
          value={kpis.total_webhook_orders}
          accent="yellow"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ranking Top 3 */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2
            className="text-xl text-[#f0df5a] mb-4"
            style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
          >
            RANKING ATUAL — TOP 3
          </h2>
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
                    <span className="text-xl">{POSITION_BADGES[row.position - 1] ?? `#${row.position}`}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{row.nickname}</p>
                      <p className="text-[#555] text-xs">{row.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#f0df5a] font-bold">{row.score.toLocaleString()}</p>
                    <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">
                      -10%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel Saipos */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2
            className="text-xl text-[#f0df5a] mb-4"
            style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
          >
            SAIPOS
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="text-[#888] text-sm">Webhook configurado</span>
            </div>

            <div className="bg-[#0f0f0f] rounded px-3 py-2">
              <p className="text-[#555] text-xs mb-1">Regra atual</p>
              <p className="text-white text-sm">
                {activeRule
                  ? `Qualquer pedido → ${activeRule.fichas_amount} fichas`
                  : 'Nenhuma regra configurada'}
              </p>
            </div>

            <div>
              <p className="text-[#555] text-xs mb-2">Últimos pedidos recebidos</p>
              <div className="space-y-1">
                {recentLogs.length === 0 ? (
                  <p className="text-[#444] text-xs">Nenhum pedido recebido ainda.</p>
                ) : (
                  recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs bg-[#0f0f0f] rounded px-3 py-2"
                    >
                      <span className="text-[#888]">
                        {new Date(log.received_at).toLocaleString('pt-BR')}
                      </span>
                      <span className="text-white">{log.phone ?? '—'}</span>
                      <span className="text-[#ec9837]">
                        R${log.order_value?.toFixed(2) ?? '0'}
                      </span>
                      <span
                        className={`font-bold ${
                          log.status === 'ok' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {log.status === 'ok'
                          ? `+${log.fichas_credited} fichas`
                          : log.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que a página carrega sem erros**

```bash
npm run dev
```

Acesse `http://localhost:3000/admin` (logado como admin).
Expected: Dashboard renderiza com KPIs zerados (banco vazio), sem erros no console.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx src/lib/admin/dashboard.ts
git commit -m "feat: dashboard admin com KPIs, ranking e log Saipos"
```

---

## Task 14: `PlayersTable` e página `/admin/players`

**Files:**
- Create: `src/components/admin/PlayersTable.tsx`
- Create: `src/app/admin/players/page.tsx`

- [ ] **Step 1: Criar `PlayersTable`**

```typescript
// src/components/admin/PlayersTable.tsx
'use client'

import { useState } from 'react'
import type { Player } from '@/types/admin'
import { grantFichasToPlayer } from '@/lib/admin/players'

interface PlayersTableProps {
  players: Player[]
  onSearch: (term: string) => void
  onExportCsv: () => void
}

export function PlayersTable({ players, onSearch, onExportCsv }: PlayersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [grantPlayerId, setGrantPlayerId] = useState<string | null>(null)
  const [grantAmount, setGrantAmount] = useState(1)
  const [grantReason, setGrantReason] = useState('')
  const [grantFeedback, setGrantFeedback] = useState<string | null>(null)

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(e.target.value)
    onSearch(e.target.value)
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!grantPlayerId) return

    const result = await grantFichasToPlayer(grantPlayerId, grantAmount, grantReason)
    if (result.success) {
      setGrantFeedback('Fichas creditadas com sucesso!')
      setGrantPlayerId(null)
      setGrantAmount(1)
      setGrantReason('')
    } else {
      setGrantFeedback(result.error ?? 'Erro ao creditar fichas.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de busca + exportar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Buscar por nickname ou telefone..."
          className="flex-1 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#b92526]"
        />
        <button
          onClick={onExportCsv}
          className="bg-[#ec9837] hover:bg-[#d4872f] text-black font-bold px-4 py-2 rounded text-sm transition-colors"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          EXPORTAR CSV
        </button>
      </div>

      {/* Feedback grant */}
      {grantFeedback && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm text-green-400">
          {grantFeedback}
          <button
            className="ml-3 text-[#555] hover:text-white"
            onClick={() => setGrantFeedback(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['NICKNAME', 'TELEFONE', 'MELHOR SCORE', 'DESCONTO', 'FICHAS', 'CADASTRO', 'AÇÕES'].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left text-[#f0df5a] px-4 py-3 text-xs"
                    style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-[#555] py-8 text-sm">
                  Nenhum player encontrado.
                </td>
              </tr>
            ) : (
              players.map((player) => (
                <tr
                  key={player.id}
                  className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-bold">{player.nickname}</td>
                  <td className="px-4 py-3 text-[#888]">{player.phone}</td>
                  <td className="px-4 py-3 text-[#f0df5a]">
                    {player.best_score?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {player.has_active_discount ? (
                      <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">
                        -10%
                      </span>
                    ) : (
                      <span className="text-[#555]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#ec9837]">{player.ficha_balance}</td>
                  <td className="px-4 py-3 text-[#555] text-xs">
                    {new Date(player.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setGrantPlayerId(player.id)}
                      className="text-[#888] hover:text-[#ec9837] text-xs font-bold transition-colors"
                    >
                      + FICHAS
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal grant fichas */}
      {grantPlayerId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form
            onSubmit={handleGrant}
            className="bg-[#1a1a1a] border border-[#b92526] rounded-lg p-6 w-full max-w-sm space-y-4"
          >
            <h3
              className="text-xl text-[#f0df5a]"
              style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
            >
              GRANT DE FICHAS
            </h3>
            <div>
              <label className="block text-[#888] text-xs mb-1">QUANTIDADE</label>
              <input
                type="number"
                min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              />
            </div>
            <div>
              <label className="block text-[#888] text-xs mb-1">MOTIVO</label>
              <input
                type="text"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                required
                placeholder="ex: promoção especial"
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-[#b92526] hover:bg-[#d42828] text-white font-bold py-2 rounded transition-colors"
                style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
              >
                CONFIRMAR
              </button>
              <button
                type="button"
                onClick={() => setGrantPlayerId(null)}
                className="flex-1 bg-[#333] hover:bg-[#444] text-white font-bold py-2 rounded transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar a página `/admin/players`**

```typescript
// src/app/admin/players/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlayersTable } from '@/components/admin/PlayersTable'
import { listPlayers, buildCsvFromPlayers } from '@/lib/admin/players'
import type { Player } from '@/types/admin'

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchPlayers = useCallback(async (term?: string) => {
    setLoading(true)
    const data = await listPlayers(term)
    setPlayers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  function handleSearch(term: string) {
    setSearchTerm(term)
    fetchPlayers(term)
  }

  function handleExportCsv() {
    const csv = buildCsvFromPlayers(players)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `players-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="text-4xl text-[#f0df5a]"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          PLAYERS / LEADS
        </h1>
        <span className="text-[#555] text-sm">
          {loading ? 'Carregando...' : `${players.length} players`}
        </span>
      </div>

      {loading ? (
        <div className="text-[#555] text-sm py-8 text-center">Carregando players...</div>
      ) : (
        <PlayersTable
          players={players}
          onSearch={handleSearch}
          onExportCsv={handleExportCsv}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que a página carrega**

Acesse `http://localhost:3000/admin/players`.
Expected: Tabela renderiza (vazia ou com dados), botão EXPORTAR CSV visível, sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PlayersTable.tsx src/app/admin/players/page.tsx
git commit -m "feat: página Players/Leads com tabela, busca e exportar CSV"
```

---

## Task 15: `GamesTable` e página `/admin/games`

**Files:**
- Create: `src/components/admin/GamesTable.tsx`
- Create: `src/app/admin/games/page.tsx`

- [ ] **Step 1: Criar `GamesTable`**

```typescript
// src/components/admin/GamesTable.tsx
'use client'

import { useState } from 'react'
import type { Game } from '@/types/admin'
import { toggleGameActive, updateGameConfig, startNewSeason } from '@/lib/admin/games'

interface GamesTableProps {
  initialGames: Game[]
}

export function GamesTable({ initialGames }: GamesTableProps) {
  const [games, setGames] = useState<Game[]>(initialGames)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTopN, setEditTopN] = useState(3)
  const [editDiscountPct, setEditDiscountPct] = useState(10)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleToggle(game: Game) {
    const result = await toggleGameActive(game.id, !game.active)
    if (result.success) {
      setGames((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, active: !g.active } : g))
      )
    } else {
      setFeedback(result.error ?? 'Erro ao atualizar.')
    }
  }

  function openEdit(game: Game) {
    setEditingId(game.id)
    setEditTopN(game.top_n_discount)
    setEditDiscountPct(game.discount_pct)
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return

    const result = await updateGameConfig(editingId, editTopN, editDiscountPct)
    if (result.success) {
      setGames((prev) =>
        prev.map((g) =>
          g.id === editingId
            ? { ...g, top_n_discount: editTopN, discount_pct: editDiscountPct }
            : g
        )
      )
      setFeedback('Configuração salva!')
      setEditingId(null)
    } else {
      setFeedback(result.error ?? 'Erro ao salvar.')
    }
  }

  async function handleNewSeason(game: Game) {
    if (
      !confirm(
        `Iniciar nova temporada para "${game.name}"? O ranking atual será invalidado.`
      )
    )
      return

    const result = await startNewSeason(game.id)
    if (result.success) {
      setGames((prev) =>
        prev.map((g) =>
          g.id === game.id ? { ...g, season: result.new_season ?? g.season + 1 } : g
        )
      )
      setFeedback(`Temporada ${result.new_season} iniciada!`)
    } else {
      setFeedback(result.error ?? 'Erro ao iniciar temporada.')
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm text-green-400 flex items-center justify-between">
          {feedback}
          <button className="text-[#555] hover:text-white" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['GAME', 'STATUS', 'TOP N', 'DESCONTO', 'TEMPORADA', 'AÇÕES'].map((col) => (
                <th
                  key={col}
                  className="text-left text-[#f0df5a] px-4 py-3 text-xs"
                  style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                <td className="px-4 py-3 text-white font-bold">{game.name}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(game)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      game.active
                        ? 'bg-green-700 hover:bg-green-800 text-white'
                        : 'bg-[#333] hover:bg-[#444] text-[#888]'
                    }`}
                  >
                    {game.active ? 'ATIVO' : 'INATIVO'}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#888]">Top {game.top_n_discount}</td>
                <td className="px-4 py-3 text-[#ec9837]">{game.discount_pct}%</td>
                <td className="px-4 py-3 text-[#555]">S{game.season}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(game)}
                      className="text-[#888] hover:text-[#f0df5a] text-xs font-bold transition-colors"
                    >
                      EDITAR
                    </button>
                    <button
                      onClick={() => handleNewSeason(game)}
                      className="text-[#888] hover:text-[#b92526] text-xs font-bold transition-colors"
                    >
                      NOVA TEMPORADA
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal editar config */}
      {editingId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form
            onSubmit={handleSaveConfig}
            className="bg-[#1a1a1a] border border-[#b92526] rounded-lg p-6 w-full max-w-sm space-y-4"
          >
            <h3
              className="text-xl text-[#f0df5a]"
              style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
            >
              CONFIGURAR GAME
            </h3>
            <div>
              <label className="block text-[#888] text-xs mb-1">TOP N (jogadores com desconto)</label>
              <input
                type="number"
                min={1}
                value={editTopN}
                onChange={(e) => setEditTopN(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              />
            </div>
            <div>
              <label className="block text-[#888] text-xs mb-1">DESCONTO % (1-100)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={editDiscountPct}
                onChange={(e) => setEditDiscountPct(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-[#b92526] hover:bg-[#d42828] text-white font-bold py-2 rounded transition-colors"
                style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
              >
                SALVAR
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex-1 bg-[#333] hover:bg-[#444] text-white font-bold py-2 rounded transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar a página `/admin/games`**

```typescript
// src/app/admin/games/page.tsx
import { GamesTable } from '@/components/admin/GamesTable'
import { listGames } from '@/lib/admin/games'

export default async function AdminGamesPage() {
  const games = await listGames()

  return (
    <div className="space-y-6">
      <h1
        className="text-4xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        GAMES
      </h1>
      <GamesTable initialGames={games} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar no browser**

Acesse `http://localhost:3000/admin/games`.
Expected: Tabela com os games cadastrados. Toggle de ativo/inativo funcional. Botão NOVA TEMPORADA exibe confirm antes de executar.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/GamesTable.tsx src/app/admin/games/page.tsx
git commit -m "feat: página Games com toggle, config e nova temporada"
```

---

## Task 16: `FichaRulesTable`, `FichasHistoryTable` e página `/admin/fichas`

**Files:**
- Create: `src/components/admin/FichaRulesTable.tsx`
- Create: `src/components/admin/FichasHistoryTable.tsx`
- Create: `src/app/admin/fichas/page.tsx`

- [ ] **Step 1: Criar `FichaRulesTable`**

```typescript
// src/components/admin/FichaRulesTable.tsx
'use client'

import { useState } from 'react'
import type { FichaRule } from '@/types/admin'
import { addFichaRule, removeFichaRule } from '@/lib/admin/fichas-admin'

interface FichaRulesTableProps {
  initialRules: FichaRule[]
}

export function FichaRulesTable({ initialRules }: FichaRulesTableProps) {
  const [rules, setRules] = useState<FichaRule[]>(initialRules)
  const [newMinValue, setNewMinValue] = useState(0)
  const [newFichasAmount, setNewFichasAmount] = useState(3)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const result = await addFichaRule(newMinValue, newFichasAmount)
    if (result.success) {
      // Recarregar regras buscando da source of truth
      setFeedback('Regra adicionada! Recarregue para ver atualizado.')
      setNewMinValue(0)
      setNewFichasAmount(3)
    } else {
      setFeedback(result.error ?? 'Erro ao adicionar regra.')
    }
  }

  async function handleRemove(rule_id: string) {
    const result = await removeFichaRule(rule_id)
    if (result.success) {
      setRules((prev) => prev.filter((r) => r.id !== rule_id))
    } else {
      setFeedback(result.error ?? 'Erro ao remover regra.')
    }
  }

  return (
    <div className="space-y-4">
      <h2
        className="text-xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        REGRAS DE FICHAS
      </h2>

      {feedback && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm text-green-400 flex items-center justify-between">
          {feedback}
          <button className="text-[#555] hover:text-white" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['VALOR MÍNIMO DO PEDIDO', 'FICHAS CREDITADAS', 'STATUS', 'AÇÃO'].map((col) => (
                <th
                  key={col}
                  className="text-left text-[#f0df5a] px-4 py-3 text-xs"
                  style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-3 text-white">
                  {rule.min_order_value === 0 ? 'Qualquer valor' : `R$ ${rule.min_order_value.toFixed(2)}+`}
                </td>
                <td className="px-4 py-3 text-[#ec9837] font-bold">{rule.fichas_amount} fichas</td>
                <td className="px-4 py-3">
                  <span className={rule.active ? 'text-green-400' : 'text-[#555]'}>
                    {rule.active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleRemove(rule.id)}
                    className="text-[#555] hover:text-[#b92526] text-xs font-bold transition-colors"
                  >
                    REMOVER
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulário nova regra */}
      <form onSubmit={handleAdd} className="flex items-end gap-3 bg-[#1a1a1a] border border-[#222] rounded-lg p-4">
        <div>
          <label className="block text-[#888] text-xs mb-1">VALOR MÍNIMO (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={newMinValue}
            onChange={(e) => setNewMinValue(Number(e.target.value))}
            className="w-32 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
          />
        </div>
        <div>
          <label className="block text-[#888] text-xs mb-1">FICHAS</label>
          <input
            type="number"
            min={1}
            value={newFichasAmount}
            onChange={(e) => setNewFichasAmount(Number(e.target.value))}
            className="w-24 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
          />
        </div>
        <button
          type="submit"
          className="bg-[#b92526] hover:bg-[#d42828] text-white font-bold px-4 py-2 rounded transition-colors"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          + ADICIONAR REGRA
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Criar `FichasHistoryTable`**

```typescript
// src/components/admin/FichasHistoryTable.tsx
'use client'

import type { FichaTransaction } from '@/types/admin'

interface FichasHistoryTableProps {
  transactions: FichaTransaction[]
}

const REASON_LABELS: Record<string, string> = {
  pedido_saipos: '📦 Pedido Saipos',
  bonus: '🎁 Bônus',
  jogo: '🎮 Jogo',
  manual: '✏️ Manual',
}

export function FichasHistoryTable({ transactions }: FichasHistoryTableProps) {
  return (
    <div className="space-y-3">
      <h2
        className="text-xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        HISTÓRICO DE TRANSAÇÕES
      </h2>

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['DATA', 'PLAYER', 'QUANTIDADE', 'MOTIVO', 'REF'].map((col) => (
                <th
                  key={col}
                  className="text-left text-[#f0df5a] px-4 py-3 text-xs"
                  style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-[#555] py-8 text-sm">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="px-4 py-3 text-[#555] text-xs">
                    {new Date(tx.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-white font-bold">{tx.player_nickname}</td>
                  <td className={`px-4 py-3 font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </td>
                  <td className="px-4 py-3 text-[#888]">
                    {REASON_LABELS[tx.reason] ?? tx.reason}
                  </td>
                  <td className="px-4 py-3 text-[#555] text-xs">
                    {tx.ref_id ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar a página `/admin/fichas`**

```typescript
// src/app/admin/fichas/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { FichaRulesTable } from '@/components/admin/FichaRulesTable'
import { FichasHistoryTable } from '@/components/admin/FichasHistoryTable'
import { listFichaRules, listFichaHistory, grantFichasAdmin } from '@/lib/admin/fichas-admin'
import { listPlayers } from '@/lib/admin/players'
import type { FichaRule, FichaTransaction, Player } from '@/types/admin'

export default function AdminFichasPage() {
  const [rules, setRules] = useState<FichaRule[]>([])
  const [transactions, setTransactions] = useState<FichaTransaction[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [grantPlayerId, setGrantPlayerId] = useState('')
  const [grantAmount, setGrantAmount] = useState(1)
  const [grantReason, setGrantReason] = useState('')
  const [grantFeedback, setGrantFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [r, t, p] = await Promise.all([
        listFichaRules(),
        listFichaHistory(),
        listPlayers(),
      ])
      setRules(r)
      setTransactions(t)
      setPlayers(p)
      setLoading(false)
    }
    load()
  }, [])

  async function handleManualGrant(e: React.FormEvent) {
    e.preventDefault()
    const result = await grantFichasAdmin(grantPlayerId, grantAmount, grantReason)
    if (result.success) {
      setGrantFeedback('Fichas creditadas com sucesso!')
      setGrantPlayerId('')
      setGrantAmount(1)
      setGrantReason('')
      const updated = await listFichaHistory()
      setTransactions(updated)
    } else {
      setGrantFeedback(result.error ?? 'Erro ao creditar fichas.')
    }
  }

  if (loading) {
    return (
      <div className="text-[#555] text-sm py-8 text-center">Carregando...</div>
    )
  }

  return (
    <div className="space-y-8">
      <h1
        className="text-4xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        FICHAS
      </h1>

      <FichaRulesTable initialRules={rules} />

      {/* Grant manual */}
      <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
        <h2
          className="text-xl text-[#f0df5a] mb-4"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          GRANT MANUAL
        </h2>
        {grantFeedback && (
          <div className="mb-3 text-sm text-green-400">{grantFeedback}</div>
        )}
        <form onSubmit={handleManualGrant} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[#888] text-xs mb-1">PLAYER</label>
            <select
              value={grantPlayerId}
              onChange={(e) => setGrantPlayerId(e.target.value)}
              required
              className="bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
            >
              <option value="">Selecionar player...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname} ({p.phone})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[#888] text-xs mb-1">QUANTIDADE</label>
            <input
              type="number"
              min={1}
              value={grantAmount}
              onChange={(e) => setGrantAmount(Number(e.target.value))}
              className="w-24 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
            />
          </div>
          <div>
            <label className="block text-[#888] text-xs mb-1">MOTIVO</label>
            <input
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              required
              placeholder="ex: promoção especial"
              className="w-48 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]"
            />
          </div>
          <button
            type="submit"
            className="bg-[#b92526] hover:bg-[#d42828] text-white font-bold px-4 py-2 rounded transition-colors"
            style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
          >
            CREDITAR
          </button>
        </form>
      </div>

      <FichasHistoryTable transactions={transactions} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar no browser**

Acesse `http://localhost:3000/admin/fichas`.
Expected: Tabela de regras renderiza com a regra padrão (R$0 → 3 fichas). Formulário de nova regra visível. Histórico mostra transações (vazio se banco novo). Grant manual popula select com players.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/FichaRulesTable.tsx src/components/admin/FichasHistoryTable.tsx src/app/admin/fichas/page.tsx
git commit -m "feat: página Fichas com regras, histórico e grant manual"
```

---

## Task 17: `SaiposLog` e página `/admin/saipos`

**Files:**
- Create: `src/components/admin/SaiposLog.tsx`
- Create: `src/app/admin/saipos/page.tsx`

- [ ] **Step 1: Criar `SaiposLog`**

```typescript
// src/components/admin/SaiposLog.tsx

import type { WebhookLog } from '@/types/admin'

interface SaiposLogProps {
  logs: WebhookLog[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'text-green-400' },
  player_not_found: { label: 'Player não encontrado', color: 'text-yellow-400' },
  error: { label: 'Erro', color: 'text-red-400' },
  invalid_signature: { label: 'Assinatura inválida', color: 'text-red-500' },
}

export function SaiposLog({ logs }: SaiposLogProps) {
  return (
    <div className="space-y-3">
      <h2
        className="text-xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        LOG DE WEBHOOKS (últimos 20)
      </h2>

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['DATA/HORA', 'TELEFONE', 'PEDIDO', 'VALOR', 'FICHAS', 'STATUS'].map((col) => (
                <th
                  key={col}
                  className="text-left text-[#f0df5a] px-4 py-3 text-xs"
                  style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-[#555] py-8 text-sm">
                  Nenhum webhook recebido ainda.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const statusInfo = STATUS_LABELS[log.status] ?? {
                  label: log.status,
                  color: 'text-[#888]',
                }
                return (
                  <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="px-4 py-3 text-[#555] text-xs">
                      {new Date(log.received_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white">{log.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-[#888] text-xs">{log.order_id ?? '—'}</td>
                    <td className="px-4 py-3 text-[#ec9837]">
                      {log.order_value != null ? `R$ ${log.order_value.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#f0df5a] font-bold">
                      {log.fichas_credited != null ? `+${log.fichas_credited}` : '—'}
                    </td>
                    <td className={`px-4 py-3 font-bold text-xs ${statusInfo.color}`}>
                      {statusInfo.label}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar a página `/admin/saipos`**

```typescript
// src/app/admin/saipos/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { SaiposLog } from '@/components/admin/SaiposLog'
import type { WebhookLog } from '@/types/admin'
import { createBrowserClient } from '@supabase/ssr'

export default function AdminSaiposPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/saipos`)
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(20)

    setLogs((data as WebhookLog[]) ?? [])
    setLoading(false)
  }

  async function handleTestWebhook() {
    setTestResult('Enviando payload de teste...')

    const secret = prompt('Digite o SAIPOS_WEBHOOK_SECRET para o teste:')
    if (!secret) {
      setTestResult('Teste cancelado.')
      return
    }

    const fakePayload = {
      event: 'order.confirmed',
      order_id: `TEST-${Date.now()}`,
      customer: {
        phone: '87999990000',
        name: 'Player Teste',
      },
      total: 75.5,
      created_at: new Date().toISOString(),
    }

    try {
      const res = await fetch('/api/webhooks/saipos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(fakePayload),
      })

      const json = await res.json()
      setTestResult(
        res.ok
          ? `Sucesso! Resposta: ${JSON.stringify(json)}`
          : `Erro ${res.status}: ${JSON.stringify(json)}`
      )
      await loadLogs()
    } catch (err) {
      setTestResult(`Erro de rede: ${String(err)}`)
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(webhookUrl)
  }

  return (
    <div className="space-y-8">
      <h1
        className="text-4xl text-[#f0df5a]"
        style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
      >
        INTEGRAÇÃO SAIPOS
      </h1>

      {/* Status + URL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2
            className="text-lg text-[#f0df5a] mb-3"
            style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
          >
            STATUS
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-white text-sm">Endpoint ativo</span>
          </div>
          <p className="text-[#555] text-xs mt-2">
            Configure o webhook abaixo no painel do Saipos.
          </p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2
            className="text-lg text-[#f0df5a] mb-3"
            style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
          >
            URL DO WEBHOOK
          </h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[#0f0f0f] text-[#ec9837] text-xs px-3 py-2 rounded break-all">
              {webhookUrl}
            </code>
            <button
              onClick={handleCopyUrl}
              className="text-[#888] hover:text-[#f0df5a] text-xs font-bold px-2 py-2 transition-colors"
              title="Copiar URL"
            >
              📋
            </button>
          </div>
          <p className="text-[#555] text-xs mt-2">
            Header: <code className="text-[#888]">Authorization: Bearer &lt;SAIPOS_WEBHOOK_SECRET&gt;</code>
          </p>
        </div>
      </div>

      {/* Botão testar */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleTestWebhook}
          className="bg-[#ec9837] hover:bg-[#d4872f] text-black font-bold px-5 py-2 rounded transition-colors"
          style={{ fontFamily: 'Bangers, cursive', letterSpacing: '0.05em' }}
        >
          TESTAR WEBHOOK
        </button>
        {testResult && (
          <p className="text-sm text-[#888]">{testResult}</p>
        )}
      </div>

      {/* Log */}
      {loading ? (
        <div className="text-[#555] text-sm py-4">Carregando logs...</div>
      ) : (
        <SaiposLog logs={logs} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar no browser**

Acesse `http://localhost:3000/admin/saipos`.
Expected: URL do webhook exibida. Botão TESTAR WEBHOOK presente. Log vazio se nenhum webhook recebido.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/SaiposLog.tsx src/app/admin/saipos/page.tsx
git commit -m "feat: página Saipos com log, URL do webhook e botão de teste"
```

---

## Task 18: Rodar todos os testes e verificar build

**Files:** nenhum novo arquivo

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Expected:
```
 ✓ src/tests/middleware.test.ts (3 tests)
 ✓ src/tests/admin/players.test.ts (6 tests)
 ✓ src/tests/admin/fichas-admin.test.ts (8 tests)
 ✓ src/tests/webhooks/saipos.test.ts (7 tests)

Test Files  4 passed (4)
Tests      24 passed (24)
```

- [ ] **Step 2: Verificar build de produção**

```bash
npm run build
```

Expected: build sem erros de TypeScript nem de compilação.

- [ ] **Step 3: Verificar types**

```bash
npx tsc --noEmit
```

Expected: nenhum erro de tipagem.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: plano 2 completo — admin panel + saipos integration"
```

---

## Checklist de Cobertura do Spec

| Feature do Spec | Task |
|---|---|
| Migration `ficha_rules` + `webhook_logs` | Task 1 |
| Tipos TypeScript | Task 2 |
| Middleware auth admin | Task 3 |
| Login `/admin/login` | Task 4 |
| Layout + AdminSidebar | Task 5 |
| KpiCard reutilizável | Task 6 |
| Server Actions players | Task 7 |
| Server Actions games | Task 8 |
| Server Actions fichas admin | Task 9 |
| Lógica pura webhook Saipos | Task 10 |
| Route Handler `POST /api/webhooks/saipos` | Task 11 |
| Queries KPIs dashboard | Task 12 |
| Dashboard page `/admin` | Task 13 |
| Players page `/admin/players` + CSV | Task 14 |
| Games page `/admin/games` | Task 15 |
| Fichas page `/admin/fichas` | Task 16 |
| Saipos page `/admin/saipos` | Task 17 |
| Build + testes finais | Task 18 |

## Env Vars Necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SAIPOS_WEBHOOK_SECRET=seu-secret-aqui
NEXT_PUBLIC_APP_URL=https://seusite.com
```
