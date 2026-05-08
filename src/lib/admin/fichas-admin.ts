'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { FichaRule, FichaTransaction } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
}

export function applyFichaRule(rules: FichaRule[], orderValue: number): number {
  const eligible = rules.filter((r) => r.active && r.min_value <= orderValue).sort((a, b) => b.min_value - a.min_value)
  return eligible[0]?.fichas_amount ?? 0
}

export function validateFichaRule(min_value: number, fichas_amount: number): string | null {
  if (min_value < 0) return 'Valor mínimo do pedido não pode ser negativo.'
  if (fichas_amount <= 0) return 'Quantidade de fichas deve ser maior que zero.'
  return null
}

export async function listFichaRules(): Promise<FichaRule[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('fichas_rules').select('*').order('min_value')
  if (error || !data) return []
  return data as FichaRule[]
}

export async function addFichaRule(min_value: number, fichas_amount: number): Promise<{ success: boolean; error?: string }> {
  const validationError = validateFichaRule(min_value, fichas_amount)
  if (validationError) return { success: false, error: validationError }
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('fichas_rules').insert({ min_value, fichas_amount, active: true, cod_store: '*' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function removeFichaRule(rule_id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('fichas_rules').delete().eq('id', rule_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listFichaHistory(player_id?: string): Promise<FichaTransaction[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from('fichas').select('id, player_id, amount, reason, ref_id, created_at, players ( nickname )').order('created_at', { ascending: false }).limit(100)
  if (player_id) query = query.eq('player_id', player_id)
  const { data, error } = await query
  if (error || !data) return []
  return (data as Array<{ id: string; player_id: string; amount: number; reason: string; ref_id: string | null; created_at: string; players: { nickname: string } | null }>).map((row) => ({
    id: row.id, player_id: row.player_id, player_nickname: row.players?.nickname ?? 'Desconhecido',
    amount: row.amount, reason: row.reason, ref_id: row.ref_id, created_at: row.created_at,
  }))
}

export async function grantFichasAdmin(player_id: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  if (!player_id || amount === 0 || !reason.trim()) return { success: false, error: 'Dados inválidos.' }
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('fichas').insert({ player_id, amount, reason, ref_id: null })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
