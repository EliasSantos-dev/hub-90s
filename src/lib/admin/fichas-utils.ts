import type { FichaRule } from '@/types/admin'

export function applyFichaRule(rules: FichaRule[], orderValue: number): number {
  const eligible = rules.filter((r) => r.active && r.min_value <= orderValue).sort((a, b) => b.min_value - a.min_value)
  return eligible[0]?.fichas_amount ?? 0
}

export function validateFichaRule(min_value: number, fichas_amount: number): string | null {
  if (min_value < 0) return 'Valor mínimo do pedido não pode ser negativo.'
  if (fichas_amount <= 0) return 'Quantidade de fichas deve ser maior que zero.'
  return null
}
