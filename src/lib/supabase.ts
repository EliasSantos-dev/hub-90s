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
