import type { GameAction } from './engine'

const KEY_MAP: Record<string, GameAction> = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ' ': 'fire',
}

export function keyToAction(key: string): GameAction {
  return KEY_MAP[key] ?? 'none'
}
