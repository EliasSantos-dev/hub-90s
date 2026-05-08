'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { AdminKpis, AdminRankingRow, WebhookLog } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const supabase = getSupabaseAdmin()
  const [playersRes, fichasRes, discountsRes, ordersRes] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }),
    supabase.from('fichas').select('amount').gt('amount', 0),
    supabase.from('active_discounts').select('player_id', { count: 'exact', head: true }),
    supabase.from('saipos_webhook_log').select('id', { count: 'exact', head: true }),
  ])
  return {
    total_players: playersRes.count ?? 0,
    total_fichas_distributed: (fichasRes.data ?? []).reduce((sum, f) => sum + f.amount, 0),
    active_discounts: discountsRes.count ?? 0,
    total_webhook_orders: ordersRes.count ?? 0,
  }
}

export async function getDashboardRanking(): Promise<AdminRankingRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ranking')
    .select('position, player_id, score, game_id, players ( nickname, phone ), games ( name )')
    .lte('position', 3)
    .order('position')
  if (error || !data) return []
  return (data as unknown as Array<{ position: number; player_id: string; score: number; game_id: string; players: { nickname: string; phone: string } | null; games: { name: string } | null }>)
    .map((row) => ({ position: row.position, player_id: row.player_id, nickname: row.players?.nickname ?? '???', phone: row.players?.phone ?? '', score: row.score, game_id: row.game_id }))
}

export async function getRecentWebhookLogs(limit = 4): Promise<WebhookLog[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('saipos_webhook_log').select('*').order('received_at', { ascending: false }).limit(limit)
  if (error || !data) return []
  return data as WebhookLog[]
}
