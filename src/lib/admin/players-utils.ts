import type { AdminPlayer } from '@/types/admin'

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
