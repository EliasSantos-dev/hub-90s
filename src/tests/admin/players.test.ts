import { describe, it, expect } from 'vitest'
import { buildPlayerSearchQuery, buildCsvFromPlayers } from '@/lib/admin/players-utils'
import type { AdminPlayer } from '@/types/admin'

describe('buildPlayerSearchQuery', () => {
  it('returns object with term when search has value', () => {
    const result = buildPlayerSearchQuery('joao')
    expect(result).toEqual({ term: '%joao%' })
  })
  it('returns null when search is empty', () => {
    expect(buildPlayerSearchQuery('')).toBeNull()
  })
  it('returns null when search is only spaces', () => {
    expect(buildPlayerSearchQuery('   ')).toBeNull()
  })
})

describe('buildCsvFromPlayers', () => {
  const players: AdminPlayer[] = [
    {
      id: '1', nickname: 'Teste', phone: '11999999999',
      created_at: '2026-01-01T00:00:00Z', best_score: 1500,
      has_active_discount: true, ficha_balance: 5,
    },
  ]
  it('generates CSV with correct header', () => {
    const csv = buildCsvFromPlayers(players)
    expect(csv.split('\n')[0]).toBe('nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro')
  })
  it('generates data row correctly', () => {
    const csv = buildCsvFromPlayers(players)
    expect(csv.split('\n')[1]).toBe('Teste,11999999999,1500,sim,5,2026-01-01T00:00:00Z')
  })
  it('returns only header when empty', () => {
    expect(buildCsvFromPlayers([])).toBe('nickname,telefone,melhor_score,desconto_ativo,saldo_fichas,cadastro')
  })
})
