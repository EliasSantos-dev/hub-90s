import { describe, it, expect } from 'vitest'
import { applyFichaRule, validateFichaRule } from '@/lib/admin/fichas-admin'
import type { FichaRule } from '@/types/admin'

describe('applyFichaRule', () => {
  const rules: FichaRule[] = [
    { id: '1', cod_store: '*', min_value: 0, fichas_amount: 3, active: true, created_at: '' },
    { id: '2', cod_store: '*', min_value: 50, fichas_amount: 5, active: true, created_at: '' },
    { id: '3', cod_store: '*', min_value: 100, fichas_amount: 8, active: true, created_at: '' },
    { id: '4', cod_store: '*', min_value: 30, fichas_amount: 4, active: false, created_at: '' },
  ]
  it('applies highest threshold rule for order of 120', () => { expect(applyFichaRule(rules, 120)).toBe(8) })
  it('applies R$50 rule for order of 75', () => { expect(applyFichaRule(rules, 75)).toBe(5) })
  it('applies base rule for order of 20', () => { expect(applyFichaRule(rules, 20)).toBe(3) })
  it('ignores inactive rules', () => { expect(applyFichaRule(rules, 35)).toBe(3) })
  it('returns 0 when no active rules', () => { expect(applyFichaRule([], 50)).toBe(0) })
})

describe('validateFichaRule', () => {
  it('valid with correct values', () => { expect(validateFichaRule(0, 3)).toBeNull() })
  it('invalid when fichas_amount is zero', () => { expect(validateFichaRule(10, 0)).toBe('Quantidade de fichas deve ser maior que zero.') })
  it('invalid when min_value is negative', () => { expect(validateFichaRule(-1, 3)).toBe('Valor mínimo do pedido não pode ser negativo.') })
})
