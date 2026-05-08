# Backend, API Routes & Saipos Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js API layer, Supabase schema, and Saipos integration that powers fichas (tokens) credit via manual order-code claim, plus the admin panel backend routes.

**Architecture:** Players claim fichas by typing their Saipos `order_id` into the hub after ordering; the API validates the order against Saipos' REST API and credits fichas. A deduplicated `ref_id` (`{cod_store}_{order_id}_{YYYY-MM-DD}`) with a UNIQUE constraint prevents double-claims. A webhook endpoint also exists for logging/future use but does NOT credit fichas automatically (Saipos order payloads contain no phone/player identifier).

**Tech Stack:** Next.js 14 App Router (API Routes via `route.ts`), Supabase (PostgreSQL + Auth + Realtime), TypeScript, Zod (validation), Supabase JS client v2.

---

## File Structure

```
src/
  app/
    api/
      fichas/
        claim/
          route.ts          # POST /api/fichas/claim — player claims fichas with order_id
      webhooks/
        saipos/
          route.ts          # POST /api/webhooks/saipos — receives Saipos events, logs only
      admin/
        players/
          route.ts          # GET /api/admin/players — list players with stats
          [id]/
            fichas/
              route.ts      # POST /api/admin/players/[id]/fichas — manual grant/debit
        fichas/
          route.ts          # GET /api/admin/fichas — transaction history
          rules/
            route.ts        # GET/PUT /api/admin/fichas/rules — fichas-per-order rules
        games/
          route.ts          # GET /api/admin/games — list games
          [id]/
            route.ts        # PATCH /api/admin/games/[id] — update game config
        saipos/
          route.ts          # GET /api/admin/saipos — webhook log + connection status
        scores/
          route.ts          # GET /api/admin/scores — leaderboard data for admin
  lib/
    supabase/
      server.ts             # Supabase server client (uses cookies for SSR auth)
      client.ts             # Supabase browser client
      types.ts              # Generated DB types (manually maintained until codegen set up)
    saipos/
      client.ts             # GET /order API wrapper
      types.ts              # Saipos API types
    fichas/
      rules.ts              # Fichas calculation logic (totalValue → fichas amount)
      claim.ts              # Core claim logic (dedup + insert)
    auth/
      middleware.ts         # Admin route guard helper
  middleware.ts             # Next.js middleware — protects /admin/* routes

supabase/
  migrations/
    001_initial_schema.sql  # players, games, scores, fichas tables + views
    002_fichas_refid.sql    # UNIQUE constraint on fichas.ref_id + saipos_log table
    003_fichas_rules.sql    # fichas_rules config table
```

---

## Task 1: Supabase Local Dev Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_fichas_refid.sql`
- Create: `supabase/migrations/003_fichas_rules.sql`
- Create: `.env.local` (from template)

- [ ] **Step 1: Confirm Supabase CLI is installed**

```bash
supabase --version
```

Expected output: `1.x.x` or higher. If missing: `brew install supabase/tap/supabase` (mac) or check https://supabase.com/docs/guides/cli/getting-started.

- [ ] **Step 2: Initialize Supabase project**

```bash
supabase init
```

Expected: creates `supabase/` directory with `config.toml`.

- [ ] **Step 3: Write migration 001 — core schema**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Players (one row per hub user)
CREATE TABLE players (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname   text UNIQUE NOT NULL,
  phone      text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Games catalogue
CREATE TABLE games (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  active          boolean DEFAULT false,
  top_n_discount  int DEFAULT 3,
  discount_pct    int DEFAULT 10,
  season          int DEFAULT 1,
  created_at      timestamptz DEFAULT now()
);

-- Score history
CREATE TABLE scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id    uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  score      int NOT NULL,
  wave       int,
  season     int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Fichas ledger
CREATE TABLE fichas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount     int NOT NULL,   -- positive = credit, negative = debit
  reason     text NOT NULL,  -- 'pedido_saipos' | 'bonus' | 'jogo' | 'manual'
  ref_id     text,           -- dedup key: {cod_store}_{order_id}_{YYYY-MM-DD}
  created_at timestamptz DEFAULT now()
);

-- Best score per player per game per season
CREATE VIEW ranking AS
  WITH best AS (
    SELECT s.game_id, s.player_id, MAX(s.score) AS score
    FROM scores s
    JOIN games g ON g.id = s.game_id
    WHERE s.season = g.season
    GROUP BY s.game_id, s.player_id
  )
  SELECT
    game_id, player_id, score,
    RANK() OVER (PARTITION BY game_id ORDER BY score DESC) AS position
  FROM best;

-- Players currently holding a discount
CREATE VIEW active_discounts AS
  SELECT r.player_id, r.game_id, g.discount_pct
  FROM ranking r
  JOIN games g ON g.id = r.game_id
  WHERE r.position <= g.top_n_discount AND g.active = true;

-- Seed: Burger Invaders
INSERT INTO games (name, slug, active, top_n_discount, discount_pct, season)
VALUES ('Burger Invaders', 'burger-invaders', true, 3, 10, 1);
```

- [ ] **Step 4: Write migration 002 — deduplication + webhook log**

Create `supabase/migrations/002_fichas_refid.sql`:

```sql
-- Prevent double-claim: order IDs reset daily in Saipos,
-- so the unique key includes cod_store + order_id + date.
ALTER TABLE fichas ADD CONSTRAINT fichas_ref_id_unique UNIQUE (ref_id);

-- Log table for incoming Saipos webhook events (no auto-credit, just audit trail)
CREATE TABLE saipos_webhook_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event       text NOT NULL,        -- CONFIRMED | READY_TO_DELIVER | DISPATCHED | CONCLUDED | CANCELLED
  cod_store   text NOT NULL,
  order_id    text NOT NULL,
  raw_payload jsonb NOT NULL,
  received_at timestamptz DEFAULT now()
);
```

- [ ] **Step 5: Write migration 003 — fichas rules config**

Create `supabase/migrations/003_fichas_rules.sql`:

```sql
-- Admin-configurable rules for how many fichas a given order earns
CREATE TABLE fichas_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_store     text NOT NULL DEFAULT '*',  -- '*' = applies to all stores
  min_value     numeric NOT NULL DEFAULT 0, -- order totalValue >= this
  fichas_amount int NOT NULL DEFAULT 3,     -- fichas awarded
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Default rule: any order ≥ R$0 gives 3 fichas
INSERT INTO fichas_rules (cod_store, min_value, fichas_amount, active)
VALUES ('*', 0, 3, true);

-- Bonus rule: orders ≥ R$50 give 5 fichas (insert manually via admin to activate)
-- INSERT INTO fichas_rules (cod_store, min_value, fichas_amount, active)
-- VALUES ('*', 50, 5, true);
```

- [ ] **Step 6: Start Supabase local and apply migrations**

```bash
supabase start
supabase db reset
```

Expected output: migrations applied, local Studio URL printed (e.g. `http://localhost:54323`).

- [ ] **Step 7: Create `.env.local` with Supabase local credentials**

After `supabase start`, the CLI prints `API URL` and `anon key` and `service_role key`. Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
SAIPOS_COD_STORE=123
SAIPOS_API_TOKEN=<token from Saipos dashboard>
ADMIN_SECRET=<any strong secret for admin route auth>
```

- [ ] **Step 8: Commit**

```bash
git add supabase/ .env.local.example
git commit -m "chore: supabase schema migrations and local dev setup"
```

---

## Task 2: Supabase Clients & DB Types

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected: packages added to `package.json`.

- [ ] **Step 2: Write DB types**

Create `src/lib/supabase/types.ts`:

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          nickname: string;
          phone: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };
      games: {
        Row: {
          id: string;
          name: string;
          slug: string;
          active: boolean;
          top_n_discount: number;
          discount_pct: number;
          season: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['games']['Insert']>;
      };
      scores: {
        Row: {
          id: string;
          player_id: string;
          game_id: string;
          score: number;
          wave: number | null;
          season: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scores']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['scores']['Insert']>;
      };
      fichas: {
        Row: {
          id: string;
          player_id: string;
          amount: number;
          reason: string;
          ref_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fichas']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fichas']['Insert']>;
      };
      fichas_rules: {
        Row: {
          id: string;
          cod_store: string;
          min_value: number;
          fichas_amount: number;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fichas_rules']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fichas_rules']['Insert']>;
      };
      saipos_webhook_log: {
        Row: {
          id: string;
          event: string;
          cod_store: string;
          order_id: string;
          raw_payload: Json;
          received_at: string;
        };
        Insert: Omit<Database['public']['Tables']['saipos_webhook_log']['Row'], 'id' | 'received_at'> & {
          id?: string;
          received_at?: string;
        };
        Update: never;
      };
    };
    Views: {
      ranking: {
        Row: {
          game_id: string;
          player_id: string;
          score: number;
          position: number;
        };
      };
      active_discounts: {
        Row: {
          player_id: string;
          game_id: string;
          discount_pct: number;
        };
      };
    };
  };
}
```

- [ ] **Step 3: Write server-side Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// Service-role client for admin/server-side writes that bypass RLS
export function createSupabaseAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 4: Write browser-side Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: supabase client wrappers and db types"
```

---

## Task 3: Saipos API Client

**Files:**
- Create: `src/lib/saipos/types.ts`
- Create: `src/lib/saipos/client.ts`

- [ ] **Step 1: Write Saipos types**

Create `src/lib/saipos/types.ts`:

```typescript
// Payload received on our webhook endpoint from Saipos
export interface SaiposWebhookPayload {
  event: 'CONFIRMED' | 'READY_TO_DELIVER' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED';
  cod_store: string;
  order_id: string;
}

// Response from GET https://order-api.saipos.com/order
export interface SaiposOrderResponse {
  customer: string;       // e.g. "PEDIDO DE TESTE - Jonathan Stein" — no phone
  created_at: string;     // ISO 8601
  notes: string;
  totalDiscount: number;
  totalIncrease: number;
  totalValue: number;     // used for fichas calculation
  totalItems: number;
  serviceFee: number;
  items: SaiposOrderItem[];
  paymentsAlreadyMade: SaiposPayment[];
  orderStatus: number;    // 1 = confirmed/active
}

export interface SaiposOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface SaiposPayment {
  method: string;
  value: number;
}
```

- [ ] **Step 2: Write Saipos GET /order client**

Create `src/lib/saipos/client.ts`:

```typescript
import type { SaiposOrderResponse } from './types';

const SAIPOS_BASE_URL = 'https://order-api.saipos.com';

export async function getSaiposOrder(
  codStore: string,
  orderId: string
): Promise<SaiposOrderResponse> {
  const token = process.env.SAIPOS_API_TOKEN;
  if (!token) throw new Error('SAIPOS_API_TOKEN env var not set');

  const url = `${SAIPOS_BASE_URL}/order?cod_store=${encodeURIComponent(codStore)}&order_id=${encodeURIComponent(orderId)}`;

  const res = await fetch(url, {
    headers: { Authorization: token },
    // Do not cache — always check live status
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Saipos API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<SaiposOrderResponse>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/saipos/
git commit -m "feat: saipos api client wrapper"
```

---

## Task 4: Fichas Business Logic

**Files:**
- Create: `src/lib/fichas/rules.ts`
- Create: `src/lib/fichas/claim.ts`

- [ ] **Step 1: Install Zod for runtime validation**

```bash
npm install zod
```

- [ ] **Step 2: Write fichas calculation from order value**

Create `src/lib/fichas/rules.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type FichasRule = Database['public']['Tables']['fichas_rules']['Row'];

/**
 * Calculates how many fichas a given order total earns, based on
 * the active rules in fichas_rules table (highest min_value that matches wins).
 *
 * Example: rules are [{ min_value: 0, fichas_amount: 3 }, { min_value: 50, fichas_amount: 5 }]
 * totalValue = 60 → returns 5 (highest bracket matched)
 * totalValue = 30 → returns 3
 */
export async function calculateFichas(
  db: SupabaseClient<Database>,
  codStore: string,
  totalValue: number
): Promise<number> {
  // Rules that apply to this store: exact match OR wildcard '*'
  const { data: rules, error } = await db
    .from('fichas_rules')
    .select('*')
    .eq('active', true)
    .or(`cod_store.eq.${codStore},cod_store.eq.*`)
    .order('min_value', { ascending: false });

  if (error) throw new Error(`Failed to load fichas rules: ${error.message}`);
  if (!rules || rules.length === 0) return 0;

  // Find highest bracket where totalValue qualifies
  const matched = (rules as FichasRule[]).find(
    (r) => totalValue >= r.min_value
  );

  return matched?.fichas_amount ?? 0;
}
```

- [ ] **Step 3: Write dedup key helper**

Add to `src/lib/fichas/rules.ts` (append below `calculateFichas`):

```typescript
/**
 * Builds the dedup key for a Saipos order.
 * Saipos order IDs reset daily, so we include the date.
 * Format: {cod_store}_{order_id}_{YYYY-MM-DD}
 *
 * Always uses UTC date to avoid timezone drift across midnight.
 */
export function buildRefId(codStore: string, orderId: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${codStore}_${orderId}_${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Write claim logic**

Create `src/lib/fichas/claim.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getSaiposOrder } from '@/lib/saipos/client';
import { calculateFichas, buildRefId } from './rules';

export interface ClaimResult {
  fichasAwarded: number;
  totalValue: number;
  customerName: string;
  refId: string;
}

export type ClaimError =
  | { code: 'ORDER_NOT_FOUND'; message: string }
  | { code: 'ALREADY_CLAIMED'; message: string }
  | { code: 'ZERO_FICHAS'; message: string }
  | { code: 'DB_ERROR'; message: string };

/**
 * Validates a Saipos order_id and credits fichas to a player.
 * Returns ClaimResult on success, ClaimError on failure.
 */
export async function claimFichas(
  db: SupabaseClient<Database>,
  playerId: string,
  orderId: string,
  codStore: string
): Promise<ClaimResult | ClaimError> {
  // 1. Fetch order from Saipos
  let order;
  try {
    order = await getSaiposOrder(codStore, orderId);
  } catch {
    return { code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado no Saipos.' };
  }

  // 2. Build dedup key (include today's UTC date because Saipos resets IDs daily)
  const refId = buildRefId(codStore, orderId);

  // 3. Check for double-claim
  const { data: existing } = await db
    .from('fichas')
    .select('id')
    .eq('ref_id', refId)
    .maybeSingle();

  if (existing) {
    return { code: 'ALREADY_CLAIMED', message: 'Este pedido já foi resgatado.' };
  }

  // 4. Calculate fichas
  const fichasAmount = await calculateFichas(db, codStore, order.totalValue);

  if (fichasAmount === 0) {
    return { code: 'ZERO_FICHAS', message: 'Este pedido não gerou fichas.' };
  }

  // 5. Insert into ledger (UNIQUE constraint on ref_id is the final safety net)
  const { error } = await db.from('fichas').insert({
    player_id: playerId,
    amount: fichasAmount,
    reason: 'pedido_saipos',
    ref_id: refId,
  });

  if (error) {
    if (error.code === '23505') {
      // Unique violation — race condition, someone else claimed first
      return { code: 'ALREADY_CLAIMED', message: 'Este pedido já foi resgatado.' };
    }
    return { code: 'DB_ERROR', message: error.message };
  }

  return {
    fichasAwarded: fichasAmount,
    totalValue: order.totalValue,
    customerName: order.customer,
    refId,
  };
}
```

- [ ] **Step 5: Write unit tests for `buildRefId` and `calculateFichas`**

Create `src/lib/fichas/__tests__/rules.test.ts`:

```typescript
import { buildRefId } from '../rules';

describe('buildRefId', () => {
  it('formats as {cod_store}_{order_id}_{YYYY-MM-DD}', () => {
    const date = new Date('2026-05-08T14:00:00Z');
    expect(buildRefId('123', '42', date)).toBe('123_42_2026-05-08');
  });

  it('pads month and day with leading zero', () => {
    const date = new Date('2026-01-03T00:00:00Z');
    expect(buildRefId('99', '7', date)).toBe('99_7_2026-01-03');
  });

  it('uses UTC date, not local time', () => {
    // A time that is Jan 1 UTC even if local TZ is ahead
    const date = new Date('2026-01-01T02:00:00Z');
    expect(buildRefId('1', '1', date)).toBe('1_1_2026-01-01');
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/lib/fichas/__tests__/rules.test.ts --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/fichas/
git commit -m "feat: fichas business logic — claim, dedup, rules calculation"
```

---

## Task 5: Admin Auth Middleware Helper

**Files:**
- Create: `src/lib/auth/middleware.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write admin route guard**

Admin routes are protected by a simple `ADMIN_SECRET` header check (bearer token). This avoids Supabase Auth complexity for internal admin panel in phase 1.

Create `src/lib/auth/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * Call at the top of every /api/admin/* route handler.
 * Returns null if authorized, or a 401 Response if not.
 */
export function requireAdminAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get('authorization') ?? '';
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    console.error('ADMIN_SECRET env var is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // authorized
}
```

- [ ] **Step 2: Write Next.js middleware to block /admin frontend pages**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Admin panel pages (not API routes) redirect to /admin/login if no cookie
  if (request.nextUrl.pathname.startsWith('/admin') &&
      !request.nextUrl.pathname.startsWith('/admin/login')) {
    const adminToken = request.cookies.get('admin_token')?.value;
    if (adminToken !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/ src/middleware.ts
git commit -m "feat: admin auth middleware (bearer token guard)"
```

---

## Task 6: `POST /api/fichas/claim` — Player Claims Fichas

**Files:**
- Create: `src/app/api/fichas/claim/route.ts`

This is the core endpoint. A logged-in player submits their Saipos `order_id`; the server validates and credits fichas.

- [ ] **Step 1: Write failing integration test**

Create `src/app/api/fichas/claim/__tests__/route.test.ts`:

```typescript
/**
 * Integration test — mocks Saipos API and Supabase.
 * Tests the HTTP contract of POST /api/fichas/claim.
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock claimFichas so we test the route layer only
jest.mock('@/lib/fichas/claim', () => ({
  claimFichas: jest.fn(),
}));

// Mock supabase server client — route uses it to get current player
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'player-uuid-123' } },
        error: null,
      }),
    },
  })),
}));

import { claimFichas } from '@/lib/fichas/claim';
const mockClaimFichas = claimFichas as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/fichas/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/fichas/claim', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 if order_id is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/order_id/i);
  });

  it('returns 200 with fichasAwarded on success', async () => {
    mockClaimFichas.mockResolvedValue({
      fichasAwarded: 3,
      totalValue: 35.9,
      customerName: 'Jonathan Stein',
      refId: '123_42_2026-05-08',
    });

    const res = await POST(makeRequest({ order_id: '42' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fichasAwarded).toBe(3);
    expect(body.refId).toBe('123_42_2026-05-08');
  });

  it('returns 409 on ALREADY_CLAIMED', async () => {
    mockClaimFichas.mockResolvedValue({
      code: 'ALREADY_CLAIMED',
      message: 'Este pedido já foi resgatado.',
    });

    const res = await POST(makeRequest({ order_id: '42' }));
    expect(res.status).toBe(409);
  });

  it('returns 404 on ORDER_NOT_FOUND', async () => {
    mockClaimFichas.mockResolvedValue({
      code: 'ORDER_NOT_FOUND',
      message: 'Pedido não encontrado no Saipos.',
    });

    const res = await POST(makeRequest({ order_id: '99' }));
    expect(res.status).toBe(404);
  });

  it('returns 401 if user not authenticated', async () => {
    const { createSupabaseServerClient } = require('@/lib/supabase/server');
    createSupabaseServerClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const res = await POST(makeRequest({ order_id: '42' }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/app/api/fichas/claim/__tests__/route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/fichas/claim/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { claimFichas } from '@/lib/fichas/claim';

const ClaimSchema = z.object({
  order_id: z.string().min(1, 'order_id is required'),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate player
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { order_id } = parsed.data;
  const codStore = process.env.SAIPOS_COD_STORE!;

  // 3. Claim fichas (uses admin client so it bypasses RLS for insert)
  const adminDb = createSupabaseAdminClient();
  const result = await claimFichas(adminDb, user.id, order_id, codStore);

  // 4. Map result to HTTP response
  if ('code' in result) {
    const status = result.code === 'ALREADY_CLAIMED' ? 409
                 : result.code === 'ORDER_NOT_FOUND' ? 404
                 : result.code === 'ZERO_FICHAS'     ? 422
                 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/app/api/fichas/claim/__tests__/route.test.ts --no-coverage
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/fichas/claim/
git commit -m "feat: POST /api/fichas/claim — manual saipos order redemption"
```

---

## Task 7: `POST /api/webhooks/saipos` — Webhook Log Endpoint

**Files:**
- Create: `src/app/api/webhooks/saipos/route.ts`

This endpoint receives Saipos push events and logs them. It does NOT credit fichas automatically — players must claim manually. The log is visible in `/admin/saipos`.

- [ ] **Step 1: Write failing test**

Create `src/app/api/webhooks/saipos/__tests__/route.test.ts`:

```typescript
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase admin client
const mockInsert = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({ insert: mockInsert })),
  })),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/saipos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/webhooks/saipos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 and logs the event for a valid CONFIRMED payload', async () => {
    const res = await POST(makeRequest({
      event: 'CONFIRMED',
      cod_store: '123',
      order_id: '42',
    }));

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      event: 'CONFIRMED',
      cod_store: '123',
      order_id: '42',
    }));
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest({ event: 'CONFIRMED' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for all valid event types', async () => {
    const events = ['CONFIRMED', 'READY_TO_DELIVER', 'DISPATCHED', 'CONCLUDED', 'CANCELLED'];
    for (const event of events) {
      const res = await POST(makeRequest({ event, cod_store: '123', order_id: '1' }));
      expect(res.status).toBe(200);
    }
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/app/api/webhooks/saipos/__tests__/route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/webhooks/saipos/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const SaiposWebhookSchema = z.object({
  event: z.enum(['CONFIRMED', 'READY_TO_DELIVER', 'DISPATCHED', 'CONCLUDED', 'CANCELLED']),
  cod_store: z.string().min(1),
  order_id: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SaiposWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { event, cod_store, order_id } = parsed.data;

  // Log only — no automatic fichas credit (no player identifier in payload)
  const db = createSupabaseAdminClient();
  const { error } = await db.from('saipos_webhook_log').insert({
    event,
    cod_store,
    order_id,
    raw_payload: body as Record<string, unknown>,
  });

  if (error) {
    console.error('saipos webhook log insert error:', error);
    // Still return 200 so Saipos doesn't keep retrying
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/app/api/webhooks/saipos/__tests__/route.test.ts --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/saipos/
git commit -m "feat: POST /api/webhooks/saipos — event log endpoint (no auto-credit)"
```

---

## Task 8: Admin — Players API

**Files:**
- Create: `src/app/api/admin/players/route.ts`
- Create: `src/app/api/admin/players/[id]/fichas/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/admin/players/__tests__/route.test.ts`:

```typescript
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/middleware', () => ({
  requireAdminAuth: jest.fn().mockReturnValue(null), // authorized
}));

const mockSelect = jest.fn().mockResolvedValue({
  data: [
    { id: 'p1', nickname: 'Tester', phone: '81999990000', created_at: '2026-01-01T00:00:00Z' },
  ],
  error: null,
});

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({ select: mockSelect })),
  })),
}));

describe('GET /api/admin/players', () => {
  it('returns player list', async () => {
    const req = new NextRequest('http://localhost/api/admin/players', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players).toHaveLength(1);
    expect(body.players[0].nickname).toBe('Tester');
  });

  it('returns 401 when auth fails', async () => {
    const { requireAdminAuth } = require('@/lib/auth/middleware');
    const { NextResponse } = require('next/server');
    (requireAdminAuth as jest.Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const req = new NextRequest('http://localhost/api/admin/players');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

```bash
npx jest src/app/api/admin/players/__tests__/route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement GET /api/admin/players**

Create `src/app/api/admin/players/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const db = createSupabaseAdminClient();

  // Fetch players with their total fichas balance
  const { data: players, error } = await db
    .from('players')
    .select('id, nickname, phone, created_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get fichas balances for all players in one query
  const { data: fichasSums } = await db
    .from('fichas')
    .select('player_id, amount');

  const balanceMap: Record<string, number> = {};
  if (fichasSums) {
    for (const row of fichasSums) {
      balanceMap[row.player_id] = (balanceMap[row.player_id] ?? 0) + row.amount;
    }
  }

  const enriched = (players ?? []).map((p) => ({
    ...p,
    fichas_balance: balanceMap[p.id] ?? 0,
  }));

  return NextResponse.json({ players: enriched });
}
```

- [ ] **Step 4: Implement POST /api/admin/players/[id]/fichas — manual grant/debit**

Create `src/app/api/admin/players/[id]/fichas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const GrantSchema = z.object({
  amount: z.number().int().nonzero(),
  reason: z.string().min(1).default('manual'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = GrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { amount, reason } = parsed.data;
  const db = createSupabaseAdminClient();

  const { error } = await db.from('fichas').insert({
    player_id: params.id,
    amount,
    reason,
    ref_id: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ granted: amount, player_id: params.id });
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest src/app/api/admin/players/__tests__/route.test.ts --no-coverage
```

Expected: 2 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/players/
git commit -m "feat: admin players API — list with fichas balance + manual grant"
```

---

## Task 9: Admin — Fichas History & Rules API

**Files:**
- Create: `src/app/api/admin/fichas/route.ts`
- Create: `src/app/api/admin/fichas/rules/route.ts`

- [ ] **Step 1: Implement GET /api/admin/fichas — transaction history**

Create `src/app/api/admin/fichas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const db = createSupabaseAdminClient();

  // Join with players to include nickname for display
  const { data, error } = await db
    .from('fichas')
    .select('id, player_id, amount, reason, ref_id, created_at, players(nickname)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data ?? [] });
}
```

- [ ] **Step 2: Implement GET/PUT /api/admin/fichas/rules**

Create `src/app/api/admin/fichas/rules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const RulesUpdateSchema = z.array(z.object({
  id: z.string().uuid().optional(),
  cod_store: z.string().min(1),
  min_value: z.number().min(0),
  fichas_amount: z.number().int().min(0),
  active: z.boolean(),
}));

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('fichas_rules')
    .select('*')
    .order('min_value', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rules: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RulesUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  // Upsert all rules
  const { error } = await db
    .from('fichas_rules')
    .upsert(parsed.data, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/fichas/
git commit -m "feat: admin fichas API — transaction history + rules CRUD"
```

---

## Task 10: Admin — Games API

**Files:**
- Create: `src/app/api/admin/games/route.ts`
- Create: `src/app/api/admin/games/[id]/route.ts`

- [ ] **Step 1: Implement GET /api/admin/games**

Create `src/app/api/admin/games/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('games')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ games: data ?? [] });
}
```

- [ ] **Step 2: Implement PATCH /api/admin/games/[id]**

Create `src/app/api/admin/games/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const GameUpdateSchema = z.object({
  active: z.boolean().optional(),
  top_n_discount: z.number().int().min(1).optional(),
  discount_pct: z.number().int().min(0).max(100).optional(),
  season: z.number().int().min(1).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = GameUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('games')
    .update(parsed.data)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ game: data });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/games/
git commit -m "feat: admin games API — list + update config"
```

---

## Task 11: Admin — Saipos Integration Status API

**Files:**
- Create: `src/app/api/admin/saipos/route.ts`

- [ ] **Step 1: Implement GET /api/admin/saipos**

Returns webhook log and a live ping to Saipos to confirm the API token is valid.

Create `src/app/api/admin/saipos/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSaiposOrder } from '@/lib/saipos/client';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const db = createSupabaseAdminClient();

  // Fetch last 50 webhook events
  const { data: logs, error } = await db
    .from('saipos_webhook_log')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check connectivity: attempt a probe order fetch (use a known-bogus id;
  // a 404 from Saipos still means the connection/token is working)
  let connectionStatus: 'ok' | 'error' = 'ok';
  let connectionError: string | null = null;
  try {
    await getSaiposOrder(process.env.SAIPOS_COD_STORE!, '__probe__');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A 404 means connected but order not found — that's fine
    if (!message.includes('404')) {
      connectionStatus = 'error';
      connectionError = message;
    }
  }

  return NextResponse.json({
    connection: { status: connectionStatus, error: connectionError },
    logs: logs ?? [],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/saipos/
git commit -m "feat: admin saipos API — webhook log + connection status"
```

---

## Task 12: Scores API (Player + Admin)

**Files:**
- Create: `src/app/api/scores/route.ts`
- Create: `src/app/api/admin/scores/route.ts`

- [ ] **Step 1: Implement POST /api/scores — player submits score**

Create `src/app/api/scores/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const ScoreSchema = z.object({
  game_slug: z.string().min(1),
  score: z.number().int().min(0),
  wave: z.number().int().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ScoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  // Look up game by slug
  const { data: game, error: gameError } = await db
    .from('games')
    .select('id, season')
    .eq('slug', parsed.data.game_slug)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const { error } = await db.from('scores').insert({
    player_id: user.id,
    game_id: game.id,
    score: parsed.data.score,
    wave: parsed.data.wave ?? null,
    season: game.season,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return player's current rank after submission
  const { data: rankRow } = await db
    .from('ranking')
    .select('position, score')
    .eq('player_id', user.id)
    .eq('game_id', game.id)
    .maybeSingle();

  return NextResponse.json({
    saved: true,
    position: rankRow?.position ?? null,
    best_score: rankRow?.score ?? parsed.data.score,
  });
}

// GET /api/scores?game_slug=burger-invaders — public leaderboard
export async function GET(request: NextRequest) {
  const gameSlug = request.nextUrl.searchParams.get('game_slug');
  if (!gameSlug) {
    return NextResponse.json({ error: 'game_slug required' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  const { data: game } = await db
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .single();

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const { data: rows, error } = await db
    .from('ranking')
    .select('position, score, player_id, players(nickname)')
    .eq('game_id', game.id)
    .order('position', { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leaderboard: rows ?? [] });
}
```

- [ ] **Step 2: Implement GET /api/admin/scores**

Create `src/app/api/admin/scores/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/middleware';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const gameSlug = request.nextUrl.searchParams.get('game_slug') ?? 'burger-invaders';
  const db = createSupabaseAdminClient();

  const { data: game } = await db
    .from('games')
    .select('id, name, slug, season, top_n_discount, discount_pct')
    .eq('slug', gameSlug)
    .single();

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const { data: rows, error } = await db
    .from('ranking')
    .select('position, score, player_id, players(nickname, phone)')
    .eq('game_id', game.id)
    .order('position', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ game, leaderboard: rows ?? [] });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scores/ src/app/api/admin/scores/
git commit -m "feat: scores API — submit score + public/admin leaderboard"
```

---

## Task 13: Fichas Balance API (Player-Facing)

**Files:**
- Create: `src/app/api/fichas/balance/route.ts`

- [ ] **Step 1: Implement GET /api/fichas/balance**

Returns the authenticated player's fichas balance and recent transactions.

Create `src/app/api/fichas/balance/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();

  const { data: rows, error } = await db
    .from('fichas')
    .select('amount, reason, ref_id, created_at')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const balance = (rows ?? []).reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({ balance, transactions: rows ?? [] });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/fichas/balance/
git commit -m "feat: GET /api/fichas/balance — player fichas balance endpoint"
```

---

## Task 14: End-to-End Manual Test (Local)

This task verifies the full claim flow works end-to-end with the local Supabase instance.

- [ ] **Step 1: Start local Supabase and Next.js**

```bash
supabase start
npm run dev
```

- [ ] **Step 2: Create a test player via Supabase Studio**

Open `http://localhost:54323` (Supabase local Studio).
In the `players` table, insert:
```json
{ "nickname": "TestPlayer", "phone": "81999990000" }
```
Copy the generated `id` UUID.

- [ ] **Step 3: Get a Supabase JWT for the test player**

In Supabase local Studio → Authentication → Users — create a user with email `test@90s.test` and any password. Then in SQL editor:

```sql
-- Link this auth user to the test player
-- (In production, registration flow does this)
UPDATE players SET id = '<auth-user-uuid>' WHERE nickname = 'TestPlayer';
```

Then sign in via the browser or `curl` to get a JWT:

```bash
curl -X POST http://localhost:54321/auth/v1/token?grant_type=password \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@90s.test","password":"yourpassword"}'
```

Copy `access_token` from the response.

- [ ] **Step 4: Hit the claim endpoint**

Use an `order_id` that exists in your Saipos sandbox account:

```bash
curl -X POST http://localhost:3000/api/fichas/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"order_id": "42"}'
```

Expected response:
```json
{
  "fichasAwarded": 3,
  "totalValue": 14.30,
  "customerName": "PEDIDO DE TESTE - Jonathan Stein",
  "refId": "123_42_2026-05-08"
}
```

- [ ] **Step 5: Verify double-claim is blocked**

Run the same `curl` again immediately:

```bash
curl -X POST http://localhost:3000/api/fichas/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"order_id": "42"}'
```

Expected: `HTTP 409` with `{ "error": "Este pedido já foi resgatado." }`

- [ ] **Step 6: Verify fichas balance updated**

```bash
curl http://localhost:3000/api/fichas/balance \
  -H "Authorization: Bearer <access_token>"
```

Expected: `{ "balance": 3, "transactions": [...] }`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "test: manual e2e validation of fichas claim flow"
```

---

## Summary of API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/fichas/claim` | Player JWT | Claim fichas with Saipos order_id |
| GET | `/api/fichas/balance` | Player JWT | Player fichas balance |
| POST | `/api/webhooks/saipos` | None | Log Saipos events (no auto-credit) |
| POST | `/api/scores` | Player JWT | Submit game score |
| GET | `/api/scores?game_slug=` | None | Public leaderboard |
| GET | `/api/admin/players` | Admin | List players + fichas balance |
| POST | `/api/admin/players/[id]/fichas` | Admin | Manual grant/debit fichas |
| GET | `/api/admin/fichas` | Admin | Transaction history (includes ref_id) |
| GET | `/api/admin/fichas/rules` | Admin | Get fichas-per-order rules |
| PUT | `/api/admin/fichas/rules` | Admin | Update fichas-per-order rules |
| GET | `/api/admin/games` | Admin | List games |
| PATCH | `/api/admin/games/[id]` | Admin | Update game config |
| GET | `/api/admin/scores?game_slug=` | Admin | Admin leaderboard (with phones) |
| GET | `/api/admin/saipos` | Admin | Webhook log + connection status |

## Coordination Note for Plan 1 (Frontend)

The game-over screen (Plan 1, Tela de Game Over) needs:
- A text input "Informe o código do pedido" that posts to `POST /api/fichas/claim`
- Display the returned `fichasAwarded` on success
- Show error messages for `ALREADY_CLAIMED` (409) and `ORDER_NOT_FOUND` (404)
- The `ref_id` column in Admin > Fichas transactions is now available from `GET /api/admin/fichas`
