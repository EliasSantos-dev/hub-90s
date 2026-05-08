export interface AdminPlayer {
  id: string
  nickname: string
  phone: string
  created_at: string
  best_score: number | null
  has_active_discount: boolean
  ficha_balance: number
}

export interface AdminGame {
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
  cod_store: string
  min_value: number
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
  event: string
  cod_store: string
  order_id: string
  raw_payload: Record<string, unknown>
  received_at: string
}

export interface AdminKpis {
  total_players: number
  total_fichas_distributed: number
  active_discounts: number
  total_webhook_orders: number
}

export interface AdminRankingRow {
  position: number
  player_id: string
  nickname: string
  phone: string
  score: number
  game_id: string
}
