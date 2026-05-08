import type { FichaRule } from '@/types/admin'

export function buildRefId(codStore: string, orderId: string, date?: string): string {
  const d = date ?? new Date().toISOString().slice(0, 10)
  return `${codStore}_${orderId}_${d}`
}

export function calculateFichas(totalValue: number, rules: FichaRule[]): number {
  const eligible = rules
    .filter((r) => r.active && totalValue >= r.min_value)
    .sort((a, b) => b.min_value - a.min_value)
  return eligible[0]?.fichas_amount ?? 0
}
