'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { AdminPlayer } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
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

export function buildCsvFromPlayers(players: AdminPlayer[]): string {
  const header = 'nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro'
  if (players.length === 0) return header
  const rows = players.map((p) =>
    [p.nickname, p.phone, p.best_score ?? 0, p.has_active_discount ? 'sim' : 'não', p.ficha_balance, p.created_at].join(',')
  )
  return [header, ...rows].join('\n')
}

export async function listPlayers(search?: string): Promise<AdminPlayer[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from('players').select('id, nickname, phone, created_at').order('created_at', { ascending: false })
  const parsed = search ? buildPlayerSearchQuery(search) : null
  if (parsed) query = query.or(`nickname.ilike.${parsed.term},phone.ilike.${parsed.term}`)
  const { data: rawPlayers, error } = await query
  if (error || !rawPlayers) return []

  const enriched = await Promise.all(rawPlayers.map(async (p) => {
    const [fichasRes, scoreRes, discountRes] = await Promise.all([
      supabase.from('fichas').select('amount').eq('player_id', p.id),
      supabase.from('scores').select('score').eq('player_id', p.id).order('score', { ascending: false }).limit(1),
      supabase.from('active_discounts').select('player_id').eq('player_id', p.id).limit(1),
    ])
    return {
      ...p,
      best_score: scoreRes.data?.[0]?.score ?? null,
      has_active_discount: (discountRes.data?.length ?? 0) > 0,
      ficha_balance: (fichasRes.data ?? []).reduce((sum, f) => sum + f.amount, 0),
    } satisfies AdminPlayer
  }))
  return enriched
}

export async function grantFichasToPlayer(player_id: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  if (!player_id || amount === 0 || !reason.trim()) return { success: false, error: 'Dados inválidos.' }
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('fichas').insert({ player_id, amount, reason, ref_id: null })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
