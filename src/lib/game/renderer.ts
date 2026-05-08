import type { GameState } from './engine'

const ENEMY_EMOJIS: Record<number, string> = {
  0: '👾',
  1: '🍔',
  2: '🍟',
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { canvasWidth, canvasHeight } = state

  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight)
  gradient.addColorStop(0, '#0d0020')
  gradient.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 137 + 17) % canvasWidth)
    const sy = ((i * 73 + 31) % (canvasHeight * 0.75))
    const size = i % 5 === 0 ? 2 : 1
    ctx.fillRect(sx, sy, size, size)
  }

  ctx.fillStyle = '#1a1a2e'
  const buildings = [
    { x: 0, w: 60, h: 50 }, { x: 70, w: 40, h: 80 },
    { x: 120, w: 80, h: 60 }, { x: 210, w: 50, h: 100 },
    { x: 270, w: 30, h: 70 }, { x: 310, w: 90, h: 55 },
    { x: 410, w: 60, h: 90 }, { x: 480, w: 40, h: 65 },
    { x: 530, w: 100, h: 80 }, { x: 640, w: 50, h: 50 },
    { x: 700, w: 80, h: 75 }, { x: 790, w: 10, h: 40 },
  ]
  for (const b of buildings) {
    ctx.fillRect(b.x, canvasHeight - b.h, b.w, b.h)
  }

  ctx.font = '28px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    ctx.fillText(
      ENEMY_EMOJIS[enemy.row] ?? '👾',
      enemy.x + enemy.width / 2,
      enemy.y + enemy.height / 2
    )
  }

  const px = state.player.x
  const py = state.player.y
  const pw = state.player.width

  ctx.fillStyle = '#ec9837'
  ctx.beginPath()
  ctx.ellipse(px + pw / 2, py + 8, pw / 2, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0df5a'
  ctx.fillRect(px + pw / 2 - 8, py + 4, 4, 3)
  ctx.fillRect(px + pw / 2 + 4, py + 6, 4, 3)
  ctx.fillStyle = '#5c3317'
  ctx.fillRect(px + 4, py + 15, pw - 8, 8)
  ctx.fillStyle = '#b92526'
  ctx.fillRect(px + pw / 2 - 3, py + state.player.height - 14, 6, 14)

  ctx.fillStyle = '#f0df5a'
  for (const bullet of state.bullets) {
    if (bullet.owner === 'player') {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
    }
  }

  ctx.fillStyle = '#ff4444'
  for (const bullet of state.bullets) {
    if (bullet.owner === 'enemy') {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
    }
  }

  ctx.font = '20px serif'
  ctx.textAlign = 'left'
  for (let i = 0; i < state.lives; i++) {
    ctx.fillText('🍔', 8 + i * 28, canvasHeight - 12)
  }
}
