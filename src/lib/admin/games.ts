'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { AdminGame } from '@/types/admin'

function getSupabaseAdmin() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
}

export async function listGames(): Promise<AdminGame[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('games').select('*').order('name')
  if (error || !data) return []
  return data as AdminGame[]
}

export async function toggleGameActive(game_id: string, active: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('games').update({ active }).eq('id', game_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateGameConfig(game_id: string, top_n_discount: number, discount_pct: number): Promise<{ success: boolean; error?: string }> {
  if (top_n_discount < 1 || discount_pct < 1 || discount_pct > 100) return { success: false, error: 'Configuração inválida.' }
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('games').update({ top_n_discount, discount_pct }).eq('id', game_id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function startNewSeason(game_id: string): Promise<{ success: boolean; new_season?: number; error?: string }> {
  const supabase = getSupabaseAdmin()
  const { data: game, error: fetchError } = await supabase.from('games').select('season').eq('id', game_id).single()
  if (fetchError || !game) return { success: false, error: 'Game não encontrado.' }
  const new_season = game.season + 1
  const { error } = await supabase.from('games').update({ season: new_season }).eq('id', game_id)
  if (error) return { success: false, error: error.message }
  return { success: true, new_season }
}
