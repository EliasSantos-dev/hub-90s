export const ENEMY_ROWS = 3
export const ENEMY_COLS = 6
export const SCORE_BY_ROW: Record<number, number> = { 0: 30, 1: 20, 2: 10 }

const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const ENEMY_BULLET_SPEED = 4
const ENEMY_STEP_X = 12
const ENEMY_STEP_Y = 20
const ENEMY_W = 40
const ENEMY_H = 32
const ENEMY_GAP_X = 16
const ENEMY_GAP_Y = 12
const PLAYER_W = 48
const PLAYER_H = 36

export type GameStatus = 'playing' | 'gameover' | 'wave_clear'

export type Enemy = {
  id: string
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  alive: boolean
}

export type Bullet = {
  id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  owner: 'player' | 'enemy'
  vy: number
}

export type Player = {
  x: number
  y: number
  width: number
  height: number
}

export type GameState = {
  canvasWidth: number
  canvasHeight: number
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  lives: number
  score: number
  hiScore: number
  wave: number
  gameStatus: GameStatus
  enemyDir: 1 | -1
  enemyMoveTimer: number
  enemyMoveInterval: number
  enemyShootTimer: number
  enemyShootInterval: number
}

export type GameAction = 'left' | 'right' | 'fire' | 'none'

function buildEnemies(canvasWidth: number): Enemy[] {
  const totalW = ENEMY_COLS * (ENEMY_W + ENEMY_GAP_X) - ENEMY_GAP_X
  const startX = Math.floor((canvasWidth - totalW) / 2)
  const startY = 60
  const enemies: Enemy[] = []
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        id: `e${row}-${col}`,
        row,
        col,
        x: startX + col * (ENEMY_W + ENEMY_GAP_X),
        y: startY + row * (ENEMY_H + ENEMY_GAP_Y),
        width: ENEMY_W,
        height: ENEMY_H,
        alive: true,
      })
    }
  }
  return enemies
}

export function createGameState(canvasWidth: number, canvasHeight: number): GameState {
  return {
    canvasWidth,
    canvasHeight,
    player: {
      x: Math.floor(canvasWidth / 2 - PLAYER_W / 2),
      y: canvasHeight - PLAYER_H - 16,
      width: PLAYER_W,
      height: PLAYER_H,
    },
    enemies: buildEnemies(canvasWidth),
    bullets: [],
    lives: 3,
    score: 0,
    hiScore: 0,
    wave: 1,
    gameStatus: 'playing',
    enemyDir: 1,
    enemyMoveTimer: 0,
    enemyMoveInterval: 800,
    enemyShootTimer: 0,
    enemyShootInterval: 2000,
  }
}

export function movePlayer(state: GameState, direction: 'left' | 'right'): GameState {
  const dx = direction === 'left' ? -PLAYER_SPEED : PLAYER_SPEED
  const newX = Math.max(
    0,
    Math.min(state.canvasWidth - state.player.width, state.player.x + dx)
  )
  return { ...state, player: { ...state.player, x: newX } }
}

export function fireBullet(state: GameState): GameState {
  const playerBullets = state.bullets.filter(
    (b) => b.owner === 'player' && b.active
  )
  if (playerBullets.length > 0) return state

  const bullet: Bullet = {
    id: `pb-${Date.now()}`,
    x: state.player.x + state.player.width / 2 - 2,
    y: state.player.y - 10,
    width: 4,
    height: 10,
    active: true,
    owner: 'player',
    vy: -BULLET_SPEED,
  }
  return { ...state, bullets: [...state.bullets, bullet] }
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export function tickGame(state: GameState, deltaMs: number): GameState {
  if (state.gameStatus !== 'playing') return state

  let { bullets, enemies, enemyMoveTimer, enemyShootTimer } = state
  const { lives, score, hiScore, wave,
    enemyDir, enemyMoveInterval,
    enemyShootInterval, player } = state

  bullets = bullets
    .map((b) => ({ ...b, y: b.y + b.vy }))
    .filter((b) => b.y + b.height > 0 && b.y < state.canvasHeight)

  let newScore = score
  const hitEnemyIds = new Set<string>()
  const remainingBullets: Bullet[] = []

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') {
      remainingBullets.push(bullet)
      continue
    }
    let hit = false
    for (const enemy of enemies) {
      if (!enemy.alive) continue
      if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        hitEnemyIds.add(enemy.id)
        newScore += SCORE_BY_ROW[enemy.row] ?? 10
        hit = true
        break
      }
    }
    if (!hit) remainingBullets.push(bullet)
  }

  enemies = enemies.map((e) =>
    hitEnemyIds.has(e.id) ? { ...e, alive: false } : e
  )
  bullets = remainingBullets

  const newHiScore = Math.max(hiScore, newScore)

  let newLives = lives
  const survivingEnemyBullets: Bullet[] = []
  for (const bullet of bullets) {
    if (bullet.owner !== 'enemy') {
      survivingEnemyBullets.push(bullet)
      continue
    }
    if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height, player.x, player.y, player.width, player.height)) {
      newLives -= 1
    } else {
      survivingEnemyBullets.push(bullet)
    }
  }
  bullets = survivingEnemyBullets

  enemyMoveTimer += deltaMs
  let newEnemyDir = enemyDir
  if (enemyMoveTimer >= enemyMoveInterval) {
    enemyMoveTimer = 0
    const aliveEnemies = enemies.filter((e) => e.alive)
    const rightmost = Math.max(...aliveEnemies.map((e) => e.x + e.width))
    const leftmost = Math.min(...aliveEnemies.map((e) => e.x))
    let descend = false
    if (enemyDir === 1 && rightmost + ENEMY_STEP_X > state.canvasWidth) {
      newEnemyDir = -1
      descend = true
    } else if (enemyDir === -1 && leftmost - ENEMY_STEP_X < 0) {
      newEnemyDir = 1
      descend = true
    }
    enemies = enemies.map((e) =>
      e.alive
        ? { ...e, x: e.x + ENEMY_STEP_X * (descend ? 0 : enemyDir), y: e.y + (descend ? ENEMY_STEP_Y : 0) }
        : e
    )
  }

  enemyShootTimer += deltaMs
  if (enemyShootTimer >= enemyShootInterval) {
    enemyShootTimer = 0
    const aliveEnemies = enemies.filter((e) => e.alive)
    if (aliveEnemies.length > 0) {
      const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]
      bullets = [
        ...bullets,
        {
          id: `eb-${Date.now()}`,
          x: shooter.x + shooter.width / 2 - 2,
          y: shooter.y + shooter.height,
          width: 4,
          height: 10,
          active: true,
          owner: 'enemy',
          vy: ENEMY_BULLET_SPEED,
        },
      ]
    }
  }

  const lowestEnemy = enemies
    .filter((e) => e.alive)
    .reduce((max, e) => (e.y + e.height > max ? e.y + e.height : max), 0)
  if (lowestEnemy >= player.y || newLives <= 0) {
    return {
      ...state, bullets, enemies, lives: newLives, score: newScore,
      hiScore: newHiScore, gameStatus: 'gameover',
      enemyDir: newEnemyDir, enemyMoveTimer, enemyShootTimer,
    }
  }

  const alive = enemies.filter((e) => e.alive)
  if (alive.length === 0) {
    return {
      ...state,
      enemies: buildEnemies(state.canvasWidth),
      bullets: [],
      score: newScore,
      hiScore: newHiScore,
      wave: wave + 1,
      enemyDir: 1,
      enemyMoveTimer: 0,
      enemyMoveInterval: Math.max(200, enemyMoveInterval - 100),
      enemyShootTimer: 0,
      enemyShootInterval: Math.max(800, enemyShootInterval - 200),
    }
  }

  return {
    ...state, player, bullets, enemies, lives: newLives, score: newScore,
    hiScore: newHiScore, enemyDir: newEnemyDir, enemyMoveTimer,
    enemyMoveInterval, enemyShootTimer, enemyShootInterval,
  }
}
