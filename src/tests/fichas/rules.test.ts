import { describe, it, expect } from 'vitest'
import { buildRefId, calculateFichas } from '@/lib/fichas/rules'
import type { FichaRule } from '@/types/admin'

describe('buildRefId', () => {
  it('builds compound key with cod_store + order_id + date', () => {
    const result = buildRefId('123', '42', '2026-05-08')
    expect(result).toBe('123_42_2026-05-08')
  })

  it('uses today when date not provided', () => {
    const result = buildRefId('123', '99')
    expect(result).toMatch(/^123_99_\d{4}-\d{2}-\d{2}$/)
  })
})

describe('calculateFichas', () => {
  const rules: FichaRule[] = [
    { id: '1', cod_store: '*', min_value: 0, fichas_amount: 3, active: true, created_at: '' },
    { id: '2', cod_store: '*', min_value: 50, fichas_amount: 5, active: true, created_at: '' },
  ]

  it('returns 3 for order below 50', () => {
    expect(calculateFichas(30, rules)).toBe(3)
  })

  it('returns 5 for order of exactly 50', () => {
    expect(calculateFichas(50, rules)).toBe(5)
  })

  it('returns 5 for order above 50', () => {
    expect(calculateFichas(75, rules)).toBe(5)
  })

  it('returns 0 when no rules match', () => {
    expect(calculateFichas(10, [])).toBe(0)
  })

  it('ignores inactive rules', () => {
    const inactiveRules: FichaRule[] = [
      { id: '3', cod_store: '*', min_value: 0, fichas_amount: 3, active: false, created_at: '' },
    ]
    expect(calculateFichas(10, inactiveRules)).toBe(0)
  })
})
