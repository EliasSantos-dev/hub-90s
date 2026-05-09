export const ENEMY_ROWS = 3
export const ENEMY_COLS = 6
export const SCORE_BY_ROW: Record<number, number> = { 0: 30, 1: 20, 2: 10 }

const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const ENEMY_BULLET_SPEED = 4
const ENEMY_W = 40
const ENEMY_H = 32
const ENEMY_GAP_X = 16
const ENEMY_GAP_Y = 12
const PLAYER_W = 48
const PLAYER_H = 36

const FORM_SPEED = 48          // px/s formação oscilação
const DIVE_SPEED = 0.22        // t/s ao longo do bezier (4.5s para completar)
const DIVE_INTERVAL_MIN = 2800 // ms
const DIVE_INTERVAL_MAX = 4500 // ms
const ANIM_INTERVAL = 180      // ms entre frames de animação
const SHAKE_INTENSITY = 6
const SHAKE_DURATION = 320     // ms
const STAR_SPEEDS = [22, 52, 92]
const STAR_COUNTS = [40, 25, 10]

export type Point = { x: number; y: number }

export type Enemy = {
  id: string; row: number; col: number
  x: number; y: number
  width: number; height: number
  alive: boolean
  diving: boolean
}

export type DivingEnemy = {
  id: string; enemyId: string; row: number
  x: number; y: number; width: number; height: number
  alive: boolean
  p0: Point; p1: Point; p2: Point; p3: Point
  t: number; speed: number
  shotFired: boolean
}

export type Particle = {
  id: string; x: number; y: number
  vx: number; vy: number
  color: string; size: number
  life: number; decay: number
}

export type Star = {
  x: number; y: number
  layer: 0 | 1 | 2
  size: number; twinklePhase: number
}

export type Bullet = {
  id: string; x: number; y: number
  width: number; height: number
  active: boolean; owner: 'player' | 'enemy'; vy: number
}

export type Player = { x: number; y: number; width: number; height: number }
export type GameStatus = 'playing' | 'gameover' | 'wave_clear'
export type GameAction = 'left' | 'right' | 'fire' | 'none'

export type GameState = {
  canvasWidth: number; canvasHeight: number
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  divingEnemies: DivingEnemy[]
  particles: Particle[]
  stars: Star[]
  lives: number; score: number; hiScore: number; wave: number
  gameStatus: GameStatus
  // Legacy fields (kept for test compat)
  enemyDir: 1 | -1
  enemyMoveTimer: number
  enemyMoveInterval: number
  enemyShootTimer: number
  enemyShootInterval: number
  // New fields
  formationVX: number
  diveTimer: number
  shakeTimer: number
  shakeIntensity: number
  animFrame: 0 | 1
  animTimer: number
}

function buildEnemies(canvasWidth: number): Enemy[] {
  const totalW = ENEMY_COLS * (ENEMY_W + ENEMY_GAP_X) - ENEMY_GAP_X
  const startX = Math.floor((canvasWidth - totalW) / 2)
  const startY = 60
  const enemies: Enemy[] = []
  for (let row = 0; row < ENEMY_ROWS; row++) {
    for (let col = 0; col < ENEMY_COLS; col++) {
      enemies.push({
        id: `e${row}-${col}`, row, col,
        x: startX + col * (ENEMY_W + ENEMY_GAP_X),
        y: startY + row * (ENEMY_H + ENEMY_GAP_Y),
        width: ENEMY_W, height: ENEMY_H,
        alive: true, diving: false,
      })
    }
  }
  return enemies
}

function buildStars(canvasWidth: number, canvasHeight: number): Star[] {
  const stars: Star[] = []
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < STAR_COUNTS[layer]; i++) {
      stars.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        layer: layer as 0 | 1 | 2,
        size: layer === 2 ? 2 : 1,
        twinklePhase: Math.random() * Math.PI * 2,
      })
    }
  }
  return stars
}

function bezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  }
}

function makeParticles(cx: number, cy: number, color: string, count: number, size: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const speed = 60 + Math.random() * 80
    return {
      id: `p-${Date.now()}-${Math.random()}`,
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      color, size, life: 1, decay: 1.8 + Math.random() * 1.2,
    }
  })
}

export function createGameState(canvasWidth: number, canvasHeight: number): GameState {
  return {
    canvasWidth, canvasHeight,
    player: {
      x: Math.floor(canvasWidth / 2 - PLAYER_W / 2),
      y: canvasHeight - PLAYER_H - 16,
      width: PLAYER_W, height: PLAYER_H,
    },
    enemies: buildEnemies(canvasWidth),
    bullets: [], divingEnemies: [], particles: [],
    stars: buildStars(canvasWidth, canvasHeight),
    lives: 3, score: 0, hiScore: 0, wave: 1,
    gameStatus: 'playing',
    enemyDir: 1, enemyMoveTimer: 0, enemyMoveInterval: 800,
    enemyShootTimer: 0, enemyShootInterval: 2000,
    formationVX: FORM_SPEED,
    diveTimer: DIVE_INTERVAL_MIN + Math.random() * (DIVE_INTERVAL_MAX - DIVE_INTERVAL_MIN),
    shakeTimer: 0, shakeIntensity: 0,
    animFrame: 0, animTimer: 0,
  }
}

export function movePlayer(state: GameState, direction: 'left' | 'right'): GameState {
  const dx = direction === 'left' ? -PLAYER_SPEED : PLAYER_SPEED
  const newX = Math.max(0, Math.min(state.canvasWidth - state.player.width, state.player.x + dx))
  return { ...state, player: { ...state.player, x: newX } }
}

export function fireBullet(state: GameState): GameState {
  if (state.bullets.filter(b => b.owner === 'player' && b.active).length > 0) return state
  return {
    ...state,
    bullets: [...state.bullets, {
      id: `pb-${Date.now()}`,
      x: state.player.x + state.player.width / 2 - 2,
      y: state.player.y - 10,
      width: 4, height: 10, active: true, owner: 'player', vy: -BULLET_SPEED,
    }],
  }
}

function rectsOverlap(ax: number, ay: number, aw: number, ah: number,
                      bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by
}

export function tickGame(state: GameState, deltaMs: number): GameState {
  if (state.gameStatus !== 'playing') return state
  const dt = deltaMs / 1000

  // Stars
  const stars = state.stars.map(s => {
    let ny = s.y + STAR_SPEEDS[s.layer] * dt
    if (ny > state.canvasHeight) ny = -s.size
    return { ...s, y: ny }
  })

  // Animation frame
  let animTimer = state.animTimer + deltaMs
  let animFrame = state.animFrame
  if (animTimer >= ANIM_INTERVAL) { animTimer = 0; animFrame = animFrame === 0 ? 1 : 0 }

  // Screen shake decay
  const shakeTimer = Math.max(0, state.shakeTimer - deltaMs)
  const shakeIntensity = shakeTimer > 0 ? SHAKE_INTENSITY * (shakeTimer / SHAKE_DURATION) : 0

  // Formation smooth oscillation
  let formationVX = state.formationVX
  let enemies = state.enemies
  const aliveFormation = enemies.filter(e => e.alive && !e.diving)
  if (aliveFormation.length > 0) {
    const right = Math.max(...aliveFormation.map(e => e.x + e.width))
    const left  = Math.min(...aliveFormation.map(e => e.x))
    if (formationVX > 0 && right + formationVX * dt > state.canvasWidth - 4) formationVX = -Math.abs(formationVX)
    else if (formationVX < 0 && left + formationVX * dt < 4) formationVX = Math.abs(formationVX)
    const dx = formationVX * dt
    enemies = enemies.map(e => e.alive && !e.diving ? { ...e, x: e.x + dx } : e)
  }

  // Bullets move
  let bullets = state.bullets
    .map(b => ({ ...b, y: b.y + b.vy }))
    .filter(b => b.y + b.height > 0 && b.y < state.canvasHeight)

  // Player bullets hit formation enemies
  let newScore = state.score
  let particles = [...state.particles]
  const hitIds = new Set<string>()
  let survivingBullets: Bullet[] = []

  for (const b of bullets) {
    if (b.owner !== 'player') { survivingBullets.push(b); continue }
    let hit = false
    for (const e of enemies) {
      if (!e.alive || e.diving) continue
      if (rectsOverlap(b.x, b.y, b.width, b.height, e.x, e.y, e.width, e.height)) {
        hitIds.add(e.id)
        newScore += SCORE_BY_ROW[e.row] ?? 10
        particles = [...particles, ...makeParticles(e.x+e.width/2, e.y+e.height/2,
          e.row === 0 ? '#FF2244' : '#FFD700', 8, 2)]
        hit = true; break
      }
    }
    if (!hit) survivingBullets.push(b)
  }
  bullets = survivingBullets
  enemies = enemies.map(e => hitIds.has(e.id) ? { ...e, alive: false } : e)

  // Player bullets hit diving enemies
  let divingEnemies = state.divingEnemies
  survivingBullets = []
  for (const b of bullets) {
    if (b.owner !== 'player') { survivingBullets.push(b); continue }
    let hit = false
    for (const de of divingEnemies) {
      if (!de.alive) continue
      if (rectsOverlap(b.x, b.y, b.width, b.height, de.x, de.y, de.width, de.height)) {
        divingEnemies = divingEnemies.map(d => d.id === de.id ? { ...d, alive: false } : d)
        enemies = enemies.map(e => e.id === de.enemyId ? { ...e, alive: false, diving: false } : e)
        newScore += (SCORE_BY_ROW[de.row] ?? 10) * 2
        particles = [...particles, ...makeParticles(de.x+de.width/2, de.y+de.height/2,
          de.row === 0 ? '#FF2244' : '#FFD700', 10, 3)]
        hit = true; break
      }
    }
    if (!hit) survivingBullets.push(b)
  }
  bullets = survivingBullets

  // Enemy bullets hit player
  let lives = state.lives
  let newShakeTimer = shakeTimer
  survivingBullets = []
  for (const b of bullets) {
    if (b.owner !== 'enemy') { survivingBullets.push(b); continue }
    const p = state.player
    if (rectsOverlap(b.x, b.y, b.width, b.height, p.x+3, p.y+3, p.width-6, p.height-6)) {
      lives -= 1
      particles = [...particles, ...makeParticles(p.x+p.width/2, p.y+p.height/2, '#D4A574', 20, 3)]
      newShakeTimer = SHAKE_DURATION
    } else { survivingBullets.push(b) }
  }
  bullets = survivingBullets

  // Formation enemy shoot
  let enemyShootTimer = state.enemyShootTimer + deltaMs
  if (enemyShootTimer >= state.enemyShootInterval) {
    enemyShootTimer = 0
    const alive = enemies.filter(e => e.alive && !e.diving)
    if (alive.length > 0) {
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      bullets = [...bullets, {
        id: `eb-${Date.now()}`, x: shooter.x+shooter.width/2-2, y: shooter.y+shooter.height,
        width: 4, height: 10, active: true, owner: 'enemy', vy: ENEMY_BULLET_SPEED,
      }]
    }
  }

  // Dive scheduling
  let diveTimer = state.diveTimer - deltaMs
  if (diveTimer <= 0) {
    diveTimer = DIVE_INTERVAL_MIN + Math.random() * (DIVE_INTERVAL_MAX - DIVE_INTERVAL_MIN)
    const candidates = enemies.filter(e => e.alive && !e.diving)
    if (candidates.length > 1) {
      const count = Math.min(2, candidates.length, Math.ceil(state.wave / 2))
      const chosen = [...candidates].sort(() => Math.random() - 0.5).slice(0, count)
      for (const enemy of chosen) {
        const ex = enemy.x + enemy.width / 2
        const ey = enemy.y + enemy.height / 2
        const side = ex > state.canvasWidth / 2 ? -1 : 1
        const px = state.player.x + state.player.width / 2
        const p0: Point = { x: ex, y: ey }
        const p1: Point = { x: ex + side * 100, y: ey - 70 }
        const p2: Point = { x: px + (Math.random()-0.5)*80, y: state.canvasHeight*0.45 }
        const p3: Point = { x: px + (Math.random()-0.5)*50, y: state.canvasHeight + 40 }
        divingEnemies = [...divingEnemies, {
          id: `de-${Date.now()}-${Math.random()}`, enemyId: enemy.id, row: enemy.row,
          x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height,
          alive: true, p0, p1, p2, p3, t: 0,
          speed: DIVE_SPEED * (1 + (state.wave-1)*0.08),
          shotFired: false,
        }]
        enemies = enemies.map(e => e.id === enemy.id ? { ...e, diving: true } : e)
      }
    }
  }

  // Update diving enemies
  divingEnemies = divingEnemies.filter(de => de.alive).map(de => {
    const newT = Math.min(1, de.t + de.speed * dt)
    const pos = bezier(de.p0, de.p1, de.p2, de.p3, newT)

    // Shoot at ~40% through dive
    let shotFired = de.shotFired
    if (!shotFired && newT >= 0.4) {
      shotFired = true
      const angle = Math.atan2(state.player.y - pos.y, (state.player.x+state.player.width/2) - pos.x)
      const spread = (Math.random()-0.5)*0.4
      bullets = [...bullets, {
        id: `deb-${Date.now()}`, x: pos.x-2, y: pos.y,
        width: 4, height: 8, active: true, owner: 'enemy',
        vy: Math.sin(angle+spread) * ENEMY_BULLET_SPEED * 1.2,
      }]
    }

    // Exit screen → free formation slot
    if (newT >= 1 || pos.y > state.canvasHeight + 10) {
      enemies = enemies.map(e => e.id === de.enemyId ? { ...e, diving: false } : e)
      return null
    }
    return { ...de, t: newT, x: pos.x - de.width/2, y: pos.y - de.height/2, shotFired }
  }).filter(Boolean) as DivingEnemy[]

  // Update particles
  particles = particles
    .map(p => ({ ...p, x: p.x+p.vx*dt, y: p.y+p.vy*dt, vx: p.vx*0.9, vy: p.vy*0.9, life: p.life-p.decay*dt }))
    .filter(p => p.life > 0)

  const newHiScore = Math.max(state.hiScore, newScore)

  // Game over
  const lowestFormation = enemies.filter(e => e.alive && !e.diving)
    .reduce((max, e) => e.y+e.height > max ? e.y+e.height : max, 0)
  if (lowestFormation >= state.player.y || lives <= 0) {
    return {
      ...state, bullets, enemies, divingEnemies, particles, stars,
      lives, score: newScore, hiScore: newHiScore, gameStatus: 'gameover',
      formationVX, diveTimer, shakeTimer: newShakeTimer, shakeIntensity,
      animFrame, animTimer, enemyShootTimer,
      enemyDir: formationVX > 0 ? 1 : -1, enemyMoveTimer: 0, enemyMoveInterval: state.enemyMoveInterval,
    }
  }

  // Wave clear
  const totalAlive = enemies.filter(e => e.alive).length + divingEnemies.filter(d => d.alive).length
  if (totalAlive === 0) {
    const newWave = state.wave + 1
    return {
      ...state,
      enemies: buildEnemies(state.canvasWidth), bullets: [], divingEnemies: [], particles, stars,
      score: newScore, hiScore: newHiScore, wave: newWave, gameStatus: 'playing',
      enemyDir: 1, enemyMoveTimer: 0, enemyMoveInterval: Math.max(200, state.enemyMoveInterval-80),
      enemyShootTimer: 0, enemyShootInterval: Math.max(800, state.enemyShootInterval-150),
      formationVX: FORM_SPEED * (1 + (newWave-1)*0.12),
      diveTimer: Math.max(2000, DIVE_INTERVAL_MIN - (newWave-1)*200),
      shakeTimer: newShakeTimer, shakeIntensity, animFrame, animTimer,
    }
  }

  return {
    ...state, bullets, enemies, divingEnemies, particles, stars,
    lives, score: newScore, hiScore: newHiScore, gameStatus: 'playing',
    formationVX, diveTimer, shakeTimer: newShakeTimer, shakeIntensity,
    animFrame, animTimer,
    enemyDir: formationVX > 0 ? 1 : -1, enemyMoveTimer: 0,
    enemyMoveInterval: state.enemyMoveInterval, enemyShootTimer,
    enemyShootInterval: state.enemyShootInterval,
  }
}
