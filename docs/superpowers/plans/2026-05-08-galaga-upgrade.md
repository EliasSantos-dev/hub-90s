# Galaga Upgrade — Engine, Sprites, Áudio, Game States

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o Burger Invaders de Space Invaders básico em Galaga temático: dive attacks, sprites pixel-art, parallax, partículas, screen shake, áudio chiptune, game states (title/ready/gameover), e hi-score persistido.

**Architecture:** Engine.ts recebe novos tipos (DivingEnemy, Particle, Star) e novos campos no GameState — todos inicializados em createGameState para não quebrar os testes existentes que usam `...state` spread. Renderer.ts recebe pixel art do hambúrguer (spec seção 4), inimigos animados (2 frames), e renderização das novas entidades. BurgerInvaders.tsx adiciona tela de título, ready countdown, e game over com hi-score. Audio.ts usa Web Audio API sintetizado.

**Tech Stack:** TypeScript, Canvas 2D, Web Audio API, localStorage, Tailwind CSS

**Constraint:** SCORE_BY_ROW[0]=30, [1]=20, [2]=10 não podem mudar (testes verificam esses valores).

---

## File Map

| File | Mudança |
|------|---------|
| `src/lib/game/engine.ts` | +DivingEnemy, +Particle, +Star, +campos GameState, smooth oscillation, dive attacks, particles, shake, animation |
| `src/lib/game/renderer.ts` | Hamburger pixel art, enemy sprites animados, parallax stars, particles, screen shake offset |
| `src/lib/game/audio.ts` | Criar — Web Audio API chiptune sounds |
| `src/components/game/BurgerInvaders.tsx` | Title screen, Ready countdown, GameOver overlay, hi-score localStorage, audio |

---

## Task 1: Engine — novos tipos e GameState expandido

**Files:**
- Modify: `src/lib/game/engine.ts`

- [ ] **Step 1: Substituir engine.ts completo**

```ts
export const ENEMY_ROWS = 3
export const ENEMY_COLS = 6
export const SCORE_BY_ROW: Record<number, number> = { 0: 30, 1: 20, 2: 10 }

const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const ENEMY_BULLET_SPEED = 4
const ENEMY_W = 36
const ENEMY_H = 28
const ENEMY_GAP_X = 20
const ENEMY_GAP_Y = 18
const PLAYER_W = 24
const PLAYER_H = 18

// Formation oscillation
const FORM_SPEED = 48   // px/s
const FORM_RANGE = 28   // max px offset from start

// Dive attacks
const DIVE_SPEED = 0.22  // t per second along bezier (0→1 in ~4.5s)
const DIVE_INTERVAL_MIN = 2800
const DIVE_INTERVAL_MAX = 4500

// Polish
const ANIM_INTERVAL = 180   // ms between animation frames
const SHAKE_INTENSITY = 6
const SHAKE_DURATION = 320   // ms

// Stars
const STAR_SPEEDS = [22, 52, 92]
const STAR_COUNTS = [40, 25, 10]

export type Point = { x: number; y: number }

export type Enemy = {
  id: string
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  diving: boolean
}

export type DivingEnemy = {
  id: string
  enemyId: string
  row: number
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  p0: Point; p1: Point; p2: Point; p3: Point
  t: number
  speed: number
  shotFired: boolean
}

export type Particle = {
  id: string
  x: number; y: number
  vx: number; vy: number
  color: string
  size: number
  life: number    // 1 → 0
  decay: number   // per second
}

export type Star = {
  x: number; y: number
  layer: 0 | 1 | 2
  size: number
  twinklePhase: number
}

export type Bullet = {
  id: string
  x: number; y: number
  width: number; height: number
  active: boolean
  owner: 'player' | 'enemy'
  vy: number
}

export type Player = {
  x: number; y: number; width: number; height: number
}

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
  // Legacy movement fields (kept for backwards compat)
  enemyDir: 1 | -1
  enemyMoveTimer: number
  enemyMoveInterval: number
  enemyShootTimer: number
  enemyShootInterval: number
  // Formation oscillation
  formationVX: number
  // Dive
  diveTimer: number
  // Polish
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
        id: `e${row}-${col}`,
        row, col,
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
  for (let layer = 0 as 0 | 1 | 2; layer < 3; layer++) {
    const count = STAR_COUNTS[layer]
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        layer,
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
  const ps: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const speed = 60 + Math.random() * 80
    ps.push({
      id: `p-${Date.now()}-${i}`,
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color, size,
      life: 1, decay: 1.8 + Math.random() * 1.2,
    })
  }
  return ps
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
    bullets: [],
    divingEnemies: [],
    particles: [],
    stars: buildStars(canvasWidth, canvasHeight),
    lives: 3, score: 0, hiScore: 0, wave: 1,
    gameStatus: 'playing',
    enemyDir: 1,
    enemyMoveTimer: 0,
    enemyMoveInterval: 800,
    enemyShootTimer: 0,
    enemyShootInterval: 2000,
    formationVX: FORM_SPEED,
    diveTimer: DIVE_INTERVAL_MIN + Math.random() * (DIVE_INTERVAL_MAX - DIVE_INTERVAL_MIN),
    shakeTimer: 0,
    shakeIntensity: 0,
    animFrame: 0,
    animTimer: 0,
  }
}

export function movePlayer(state: GameState, direction: 'left' | 'right'): GameState {
  const dx = direction === 'left' ? -PLAYER_SPEED : PLAYER_SPEED
  const newX = Math.max(0, Math.min(state.canvasWidth - state.player.width, state.player.x + dx))
  return { ...state, player: { ...state.player, x: newX } }
}

export function fireBullet(state: GameState): GameState {
  const playerBullets = state.bullets.filter(b => b.owner === 'player' && b.active)
  if (playerBullets.length > 0) return state
  const bullet: Bullet = {
    id: `pb-${Date.now()}`,
    x: state.player.x + state.player.width / 2 - 2,
    y: state.player.y - 10,
    width: 4, height: 10,
    active: true, owner: 'player', vy: -BULLET_SPEED,
  }
  return { ...state, bullets: [...state.bullets, bullet] }
}

function rectsOverlap(ax: number, ay: number, aw: number, ah: number,
                      bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by
}

export function tickGame(state: GameState, deltaMs: number): GameState {
  if (state.gameStatus !== 'playing') return state
  const dt = deltaMs / 1000

  // --- Stars ---
  const stars = state.stars.map(s => {
    const speed = STAR_SPEEDS[s.layer]
    let ny = s.y + speed * dt
    if (ny > state.canvasHeight) ny = -s.size
    return { ...s, y: ny }
  })

  // --- Animation frame ---
  let animTimer = state.animTimer + deltaMs
  let animFrame = state.animFrame
  if (animTimer >= ANIM_INTERVAL) {
    animTimer = 0
    animFrame = animFrame === 0 ? 1 : 0
  }

  // --- Screen shake ---
  let shakeTimer = Math.max(0, state.shakeTimer - deltaMs)
  const shakeIntensity = shakeTimer > 0 ? state.shakeIntensity * (shakeTimer / SHAKE_DURATION) : 0

  // --- Formation oscillation (smooth, replaces step movement) ---
  let formationVX = state.formationVX
  const aliveFormation = state.enemies.filter(e => e.alive && !e.diving)
  let enemies = state.enemies

  if (aliveFormation.length > 0) {
    const rightmost = Math.max(...aliveFormation.map(e => e.x + e.width))
    const leftmost  = Math.min(...aliveFormation.map(e => e.x))
    let bounce = false
    if (formationVX > 0 && rightmost + formationVX * dt > state.canvasWidth - 4) {
      formationVX = -Math.abs(formationVX)
      bounce = true
    } else if (formationVX < 0 && leftmost + formationVX * dt < 4) {
      formationVX = Math.abs(formationVX)
      bounce = true
    }
    const dx = bounce ? 0 : formationVX * dt
    enemies = enemies.map(e =>
      e.alive && !e.diving ? { ...e, x: e.x + dx } : e
    )
  }

  // --- Bullets move ---
  let bullets = state.bullets
    .map(b => ({ ...b, y: b.y + b.vy }))
    .filter(b => b.y + b.height > 0 && b.y < state.canvasHeight)

  // --- Player bullets hit formation enemies ---
  let newScore = state.score
  let particles: Particle[] = [...state.particles]
  const hitFormationIds = new Set<string>()
  const survivingBullets: Bullet[] = []

  for (const bullet of bullets) {
    if (bullet.owner !== 'player') { survivingBullets.push(bullet); continue }
    let hit = false
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.diving) continue
      if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height,
                       enemy.x, enemy.y, enemy.width, enemy.height)) {
        hitFormationIds.add(enemy.id)
        newScore += SCORE_BY_ROW[enemy.row] ?? 10
        particles = [...particles, ...makeParticles(
          enemy.x + enemy.width/2, enemy.y + enemy.height/2,
          enemy.row === 0 ? '#FF2244' : '#FFD700', 8, 2
        )]
        hit = true; break
      }
    }
    if (!hit) survivingBullets.push(bullet)
  }
  bullets = survivingBullets
  enemies = enemies.map(e => hitFormationIds.has(e.id) ? { ...e, alive: false } : e)

  // --- Player bullets hit diving enemies ---
  let divingEnemies = state.divingEnemies
  const survivingBullets2: Bullet[] = []
  for (const bullet of bullets) {
    if (bullet.owner !== 'player') { survivingBullets2.push(bullet); continue }
    let hit = false
    for (const de of divingEnemies) {
      if (!de.alive) continue
      if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height,
                       de.x, de.y, de.width, de.height)) {
        // Kill diving enemy + formation slot
        divingEnemies = divingEnemies.map(d => d.id === de.id ? { ...d, alive: false } : d)
        enemies = enemies.map(e => e.id === de.enemyId ? { ...e, alive: false, diving: false } : e)
        newScore += (SCORE_BY_ROW[de.row] ?? 10) * 2  // 2x for killing during dive
        particles = [...particles, ...makeParticles(
          de.x + de.width/2, de.y + de.height/2,
          de.row === 0 ? '#FF2244' : '#FFD700', 10, 3
        )]
        hit = true; break
      }
    }
    if (!hit) survivingBullets2.push(bullet)
  }
  bullets = survivingBullets2

  // --- Enemy bullets hit player ---
  let lives = state.lives
  let newShakeTimer = shakeTimer
  let newShakeIntensity = shakeIntensity
  const survivingEnemyBullets: Bullet[] = []
  for (const bullet of bullets) {
    if (bullet.owner !== 'enemy') { survivingEnemyBullets.push(bullet); continue }
    const p = state.player
    if (rectsOverlap(bullet.x, bullet.y, bullet.width, bullet.height,
                     p.x+3, p.y+3, p.width-6, p.height-6)) {
      lives -= 1
      particles = [...particles, ...makeParticles(p.x+p.width/2, p.y+p.height/2, '#D4A574', 20, 3)]
      newShakeTimer = SHAKE_DURATION
      newShakeIntensity = SHAKE_INTENSITY
    } else {
      survivingEnemyBullets.push(bullet)
    }
  }
  bullets = survivingEnemyBullets

  // --- Enemy shoot (formation) ---
  let enemyShootTimer = state.enemyShootTimer + deltaMs
  if (enemyShootTimer >= state.enemyShootInterval) {
    enemyShootTimer = 0
    const alive = enemies.filter(e => e.alive && !e.diving)
    if (alive.length > 0) {
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      bullets = [...bullets, {
        id: `eb-${Date.now()}`,
        x: shooter.x + shooter.width/2 - 2, y: shooter.y + shooter.height,
        width: 4, height: 10, active: true, owner: 'enemy', vy: ENEMY_BULLET_SPEED,
      }]
    }
  }

  // --- Dive attack scheduling ---
  let diveTimer = state.diveTimer - deltaMs
  if (diveTimer <= 0) {
    diveTimer = DIVE_INTERVAL_MIN + Math.random() * (DIVE_INTERVAL_MAX - DIVE_INTERVAL_MIN)
    const candidates = enemies.filter(e => e.alive && !e.diving)
    if (candidates.length > 1) {
      const count = Math.min(2, candidates.length, Math.ceil(state.wave / 2))
      const chosen = candidates.sort(() => Math.random() - 0.5).slice(0, count)
      for (const enemy of chosen) {
        const ex = enemy.x + enemy.width/2
        const ey = enemy.y + enemy.height/2
        const side = ex > state.canvasWidth/2 ? -1 : 1
        const px = state.player.x + state.player.width/2
        const p0: Point = { x: ex, y: ey }
        const p1: Point = { x: ex + side * 100, y: ey - 70 }
        const p2: Point = { x: px + (Math.random()-0.5)*80, y: state.canvasHeight*0.45 }
        const p3: Point = { x: px + (Math.random()-0.5)*50, y: state.canvasHeight + 40 }
        divingEnemies = [...divingEnemies, {
          id: `de-${Date.now()}-${enemy.id}`,
          enemyId: enemy.id,
          row: enemy.row,
          x: ex - enemy.width/2, y: ey - enemy.height/2,
          width: enemy.width, height: enemy.height,
          alive: true, p0, p1, p2, p3, t: 0,
          speed: DIVE_SPEED * (1 + (state.wave - 1) * 0.08),
          shotFired: false,
        }]
        enemies = enemies.map(e => e.id === enemy.id ? { ...e, diving: true } : e)
      }
    }
  }

  // --- Update diving enemies ---
  divingEnemies = divingEnemies
    .filter(de => de.alive)
    .map(de => {
      const newT = Math.min(1, de.t + de.speed * dt)
      const pos = bezier(de.p0, de.p1, de.p2, de.p3, newT)

      // Shoot at ~40% through the dive
      let shotFired = de.shotFired
      let newBullets = bullets
      if (!shotFired && newT >= 0.4) {
        shotFired = true
        const targetX = state.player.x + state.player.width/2
        const angle = Math.atan2(
          state.player.y - pos.y,
          targetX - pos.x
        )
        const spread = (Math.random()-0.5)*0.4
        newBullets = [...newBullets, {
          id: `deb-${Date.now()}`,
          x: pos.x - 2, y: pos.y,
          width: 4, height: 8, active: true, owner: 'enemy',
          vy: Math.sin(angle + spread) * ENEMY_BULLET_SPEED * 1.2,
        }]
        bullets = newBullets
      }

      // Exit screen → free formation slot
      if (newT >= 1 || pos.y > state.canvasHeight + 10) {
        enemies = enemies.map(e =>
          e.id === de.enemyId ? { ...e, diving: false } : e
        )
        return null
      }

      return { ...de, t: newT, x: pos.x - de.width/2, y: pos.y - de.height/2, shotFired }
    })
    .filter(Boolean) as DivingEnemy[]

  // --- Update particles ---
  particles = particles
    .map(p => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx * 0.9,
      vy: p.vy * 0.9,
      life: p.life - p.decay * dt,
    }))
    .filter(p => p.life > 0)

  const newHiScore = Math.max(state.hiScore, newScore)

  // --- Game over conditions ---
  const lowestEnemy = enemies
    .filter(e => e.alive && !e.diving)
    .reduce((max, e) => e.y + e.height > max ? e.y + e.height : max, 0)
  if (lowestEnemy >= state.player.y || lives <= 0) {
    return {
      ...state, bullets, enemies, divingEnemies, particles, stars,
      lives, score: newScore, hiScore: newHiScore,
      gameStatus: 'gameover',
      formationVX, diveTimer,
      shakeTimer: newShakeTimer, shakeIntensity: newShakeIntensity,
      animFrame, animTimer, enemyShootTimer,
      enemyDir: formationVX > 0 ? 1 : -1,
      enemyMoveTimer: 0, enemyMoveInterval: state.enemyMoveInterval,
    }
  }

  // --- Wave clear ---
  const aliveAny = enemies.filter(e => e.alive).length + divingEnemies.filter(d => d.alive).length
  if (aliveAny === 0) {
    const newWave = state.wave + 1
    return {
      ...state,
      enemies: buildEnemies(state.canvasWidth),
      bullets: [],
      divingEnemies: [],
      particles,
      stars,
      score: newScore, hiScore: newHiScore,
      wave: newWave,
      gameStatus: 'playing',
      enemyDir: 1,
      enemyMoveTimer: 0,
      enemyMoveInterval: Math.max(200, state.enemyMoveInterval - 80),
      enemyShootTimer: 0,
      enemyShootInterval: Math.max(800, state.enemyShootInterval - 150),
      formationVX: FORM_SPEED * (1 + (newWave-1)*0.12),
      diveTimer: Math.max(2000, DIVE_INTERVAL_MIN - (newWave-1)*200),
      shakeTimer: newShakeTimer, shakeIntensity: newShakeIntensity,
      animFrame, animTimer,
    }
  }

  return {
    ...state, bullets, enemies, divingEnemies, particles, stars,
    lives, score: newScore, hiScore: newHiScore,
    gameStatus: 'playing',
    formationVX, diveTimer,
    shakeTimer: newShakeTimer, shakeIntensity: newShakeIntensity,
    animFrame, animTimer,
    enemyDir: formationVX > 0 ? 1 : -1,
    enemyMoveTimer: 0, enemyMoveInterval: state.enemyMoveInterval,
    enemyShootTimer, enemyShootInterval: state.enemyShootInterval,
  }
}
```

- [ ] **Step 2: Rodar testes**

```bash
npm test 2>&1 | tail -12
```
Expected: 65 passed (11 test files). Se SCORE_BY_ROW falhar verifique que os valores 30/20/10 estão definidos corretamente.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1
```
Expected: sem output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/engine.ts
git commit -m "feat: engine — dive attacks bezier, oscillation, particles, screen shake, stars"
```

---

## Task 2: Renderer — pixel art + novas entidades

**Files:**
- Modify: `src/lib/game/renderer.ts`

- [ ] **Step 1: Substituir renderer.ts completo**

```ts
import type { GameState, DivingEnemy, Star } from './engine'

// ── Hamburger pixel art (spec seção 4, 24×18px) ─────────────────────────────
function drawHamburger(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const P = '#D4A574', Ps = '#B8864A', G = '#FFE4B5',
        L = '#4CAF50', Q = '#FFC107', C = '#5D2F1A'

  // Pão de cima (cúpula)
  ctx.fillStyle = P
  ctx.fillRect(px+6, py+0, 12, 1)
  ctx.fillRect(px+4, py+1, 16, 1)
  ctx.fillRect(px+3, py+2, 18, 1)
  ctx.fillRect(px+2, py+3, 20, 1)
  ctx.fillRect(px+1, py+4, 22, 3)
  // Sombra pão cima
  ctx.fillStyle = Ps
  ctx.fillRect(px+1, py+6, 2, 1); ctx.fillRect(px+21, py+6, 2, 1)
  // Gergelim
  ctx.fillStyle = G
  for (const gx of [7,12,16]) ctx.fillRect(px+gx, py+2, 1, 1)
  for (const gx of [5,18]) ctx.fillRect(px+gx, py+3, 1, 1)

  // Alface
  ctx.fillStyle = L
  ctx.fillRect(px+0, py+7, 24, 1)
  for (const wx of [0,1,3,4,6,7,9,10,12,13,15,16,18,19,21,22])
    ctx.fillRect(px+wx, py+8, 1, 1)

  // Queijo
  ctx.fillStyle = Q
  ctx.fillRect(px+1, py+9, 22, 1)
  for (const dx of [3,8,14,20]) ctx.fillRect(px+dx, py+10, 1, 1)

  // Carne
  ctx.fillStyle = C
  ctx.fillRect(px+1, py+11, 22, 3)
  ctx.fillStyle = Ps
  for (const tx of [4,10,16]) ctx.fillRect(px+tx, py+12, 1, 1)

  // Pão de baixo
  ctx.fillStyle = P
  ctx.fillRect(px+1, py+14, 22, 2)
  ctx.fillRect(px+2, py+16, 20, 1)
  ctx.fillRect(px+4, py+17, 16, 1)
  ctx.fillStyle = Ps
  ctx.fillRect(px+1, py+14, 1, 1); ctx.fillRect(px+22, py+14, 1, 1)
}

// ── Bee sprite 16×16, 2-frame animation ──────────────────────────────────────
function drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, f: 0 | 1) {
  // Corpo
  ctx.fillStyle = '#FFD700'
  ctx.fillRect(x+4, y+4, 8, 8)
  ctx.fillRect(x+5, y+3, 6, 10)
  // Olhos
  ctx.fillStyle = '#000000'
  ctx.fillRect(x+5, y+5, 2, 2); ctx.fillRect(x+9, y+5, 2, 2)
  // Listras
  ctx.fillRect(x+5, y+7, 6, 1); ctx.fillRect(x+5, y+9, 6, 1)
  // Asas animadas
  ctx.fillStyle = 'rgba(200,220,255,0.85)'
  const wy = f === 0 ? y+3 : y+6
  ctx.fillRect(x+0, wy, 4, 4); ctx.fillRect(x+12, wy, 4, 4)
}

// ── Butterfly sprite 16×16 ───────────────────────────────────────────────────
function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, f: 0 | 1) {
  // Corpo
  ctx.fillStyle = '#FF2244'
  ctx.fillRect(x+6, y+3, 4, 10); ctx.fillRect(x+5, y+5, 6, 6)
  // Olhos
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x+5, y+4, 2, 2); ctx.fillRect(x+9, y+4, 2, 2)
  ctx.fillStyle = '#000000'
  ctx.fillRect(x+5, y+4, 1, 1); ctx.fillRect(x+10, y+4, 1, 1)
  // Asas
  ctx.fillStyle = 'rgba(255,120,120,0.88)'
  const wy = f === 0 ? y+2 : y+5
  ctx.fillRect(x+0, wy, 5, 6); ctx.fillRect(x+11, wy, 5, 6)
  ctx.fillRect(x+1, f===0?y+7:y+4, 4, 4); ctx.fillRect(x+11, f===0?y+7:y+4, 4, 4)
  // Detalhe branco
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x+1, f===0?y+3:y+6, 2, 2); ctx.fillRect(x+13, f===0?y+3:y+6, 2, 2)
}

function drawEnemy(ctx: CanvasRenderingContext2D,
                   x: number, y: number,
                   row: number, frame: 0 | 1) {
  if (row === 0) drawButterfly(ctx, x, y, frame)
  else drawBee(ctx, x, y, frame)
}

// ── Projétil batata frita ─────────────────────────────────────────────────────
function drawFry(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#FFD27F'
  ctx.fillRect(x, y, 3, 8)
  ctx.fillStyle = '#FF8800'
  ctx.fillRect(x+1, y, 1, 8)
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { canvasWidth: W, canvasHeight: H } = state

  // Screen shake offset
  const shakeX = state.shakeTimer > 0
    ? (Math.random()-0.5) * state.shakeIntensity * 2
    : 0
  const shakeY = state.shakeTimer > 0
    ? (Math.random()-0.5) * state.shakeIntensity
    : 0

  ctx.save()
  ctx.translate(shakeX, shakeY)

  // Fundo preto
  ctx.fillStyle = '#000000'
  ctx.fillRect(-4, -4, W+8, H+8)

  // Parallax stars
  const time = Date.now() * 0.001
  for (const star of state.stars) {
    const twinkle = star.layer === 2
      ? 0.5 + 0.5 * Math.sin(time * 3 + star.twinklePhase)
      : 1
    const colors = ['#444444', '#999999', '#FFFFFF']
    ctx.fillStyle = colors[star.layer]
    ctx.globalAlpha = twinkle * (0.4 + star.layer * 0.3)
    ctx.fillRect(star.x, star.y, star.size, star.size)
  }
  ctx.globalAlpha = 1

  // Silhueta cidade (mantido do design original)
  ctx.fillStyle = '#1a1a2e'
  const buildings = [
    {x:0,w:60,h:50},{x:70,w:40,h:80},{x:120,w:80,h:60},{x:210,w:50,h:100},
    {x:270,w:30,h:70},{x:310,w:90,h:55},{x:410,w:60,h:90},{x:480,w:40,h:65},
  ]
  for (const b of buildings) ctx.fillRect(b.x, H-b.h, b.w, b.h)

  // Inimigos em formação
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.diving) continue
    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    drawEnemy(ctx, 0, 0, enemy.row, state.animFrame)
    ctx.restore()
  }

  // Inimigos em dive
  for (const de of state.divingEnemies) {
    if (!de.alive) continue
    ctx.save()
    ctx.translate(de.x, de.y)
    // Leve rotação durante o dive (visual de maquininha)
    const angle = Math.sin(de.t * Math.PI * 3) * 0.3
    ctx.translate(de.width/2, de.height/2)
    ctx.rotate(angle)
    ctx.translate(-de.width/2, -de.height/2)
    drawEnemy(ctx, 0, 0, de.row, state.animFrame)
    ctx.restore()
  }

  // Hambúrguer (jogador)
  drawHamburger(ctx, state.player.x, state.player.y)

  // Projéteis
  for (const b of state.bullets) {
    if (b.owner === 'player') {
      drawFry(ctx, b.x, b.y)
    } else {
      ctx.fillStyle = '#FF4444'
      ctx.fillRect(b.x, b.y, b.width, b.height)
      ctx.fillStyle = '#FF8888'
      ctx.fillRect(b.x+1, b.y, 2, 2)
    }
  }

  // Partículas
  for (const p of state.particles) {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Vidas (mini hambúrgueres)
  for (let i = 0; i < state.lives; i++) {
    drawHamburger(ctx, 6 + i * 20, H - 20)
  }

  ctx.restore()
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1
```
Expected: sem output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game/renderer.ts
git commit -m "feat: renderer — hamburger pixel art, bee/butterfly sprites, parallax, particles, shake"
```

---

## Task 3: Áudio chiptune

**Files:**
- Create: `src/lib/game/audio.ts`

- [ ] **Step 1: Criar audio.ts**

```ts
let ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)()
  return ctx
}

function playTone(freq: number, endFreq: number, duration: number, type: OscillatorType, vol: number) {
  try {
    const c = ac()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain); gain.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime)
    osc.frequency.linearRampToValueAtTime(endFreq, c.currentTime + duration)
    gain.gain.setValueAtTime(vol, c.currentTime)
    gain.gain.linearRampToValueAtTime(0, c.currentTime + duration)
    osc.start(); osc.stop(c.currentTime + duration)
  } catch { /* audio not available */ }
}

export function playShoot()  { playTone(880, 1200, 0.06, 'square', 0.08) }
export function playKill()   { playTone(220, 80,   0.10, 'square', 0.12) }
export function playDive()   { playTone(200, 600,  0.18, 'square', 0.08) }
export function playDie()    { playTone(800, 50,   0.80, 'sawtooth', 0.15) }
export function playWave() {
  // 3 bipes ascendentes (C-E-G)
  const notes = [262, 330, 392]
  notes.forEach((f, i) => setTimeout(() => playTone(f, f, 0.12, 'square', 0.1), i * 150))
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1
```
Expected: sem output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game/audio.ts
git commit -m "feat: audio — chiptune Web Audio API (shoot, kill, dive, die, wave)"
```

---

## Task 4: BurgerInvaders — Title, Ready, GameOver, Hi-Score, Áudio

**Files:**
- Modify: `src/components/game/BurgerInvaders.tsx`

- [ ] **Step 1: Substituir BurgerInvaders.tsx completo**

```tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameLoop } from '@/hooks/useGameLoop'
import StatsBar from './StatsBar'
import TouchControls from './TouchControls'
import TutorialOverlay from './TutorialOverlay'
import type { GameState } from '@/lib/game/engine'
import { saveScore } from '@/lib/scores'
import { playShoot, playKill, playDive, playDie, playWave } from '@/lib/game/audio'

type Props = {
  playerId: string | null
  gameId: string
  season: number
}

const CANVAS_WIDTH = 480
const CANVAS_HEIGHT = 520
const TUTORIAL_KEY = 'bi_tutorial_done'
const HISCORE_KEY  = 'bi_hiscore'

type Phase = 'title' | 'ready' | 'playing' | 'gameover'
type TutorialStep = 1 | 2 | 3 | null

export default function BurgerInvaders({ playerId, gameId, season }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('title')
  const [displayState, setDisplayState] = useState({
    score: 0, wave: 1, hiScore: 0, lives: 3,
  })
  const [readyCount, setReadyCount] = useState(3)
  const prevScoreRef = useRef(0)
  const prevDivingRef = useRef(0)
  const prevLivesRef = useRef(3)

  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_KEY)) return null
    return 1
  })

  const { start, touchStart: rawTouchStart, touchEnd, setPaused, stateRef } = useGameLoop({
    canvasRef,
    onGameOver: async (finalState: GameState) => {
      playDie()
      const stored = parseInt(localStorage.getItem(HISCORE_KEY) ?? '0', 10)
      if (finalState.score > stored) localStorage.setItem(HISCORE_KEY, String(finalState.score))
      if (playerId) {
        await saveScore({ playerId, gameId, score: finalState.score, wave: finalState.wave, season })
      }
      setPhase('gameover')
    },
  })

  // ── Tutorial ──────────────────────────────────────────────────────────────
  const skipTutorial = useCallback(() => {
    setTutorialStep(null)
    localStorage.setItem(TUTORIAL_KEY, '1')
  }, [])

  const touchStart = useCallback((action: import('@/lib/game/engine').GameAction) => {
    rawTouchStart(action)
    if (action === 'fire') playShoot()
    setTutorialStep((prev) => {
      if ((action === 'left' || action === 'right') && prev === 1) return 2
      if (action === 'fire' && prev === 2) return 3
      return prev
    })
  }, [rawTouchStart])

  useEffect(() => {
    if (tutorialStep === 1 || tutorialStep === 2) {
      setPaused(true)
    } else if (tutorialStep === 3) {
      setPaused(false)
      const t = setTimeout(() => {
        setTutorialStep(null)
        localStorage.setItem(TUTORIAL_KEY, '1')
      }, 2000)
      return () => clearTimeout(t)
    } else {
      setPaused(false)
    }
  }, [tutorialStep, setPaused])

  // ── Phase transitions ─────────────────────────────────────────────────────
  function startGame() {
    setPhase('ready')
    setReadyCount(3)
  }

  useEffect(() => {
    if (phase !== 'ready') return
    if (readyCount <= 0) {
      setPhase('playing')
      setPaused(false)
      playWave()
      return
    }
    const t = setTimeout(() => setReadyCount(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, readyCount, setPaused])

  useEffect(() => {
    if (phase === 'playing') setPaused(false)
    else if (phase === 'title' || phase === 'gameover') setPaused(true)
  }, [phase, setPaused])

  // ── Sound effects from state changes ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current
      if (!s) return
      setDisplayState({ score: s.score, wave: s.wave, hiScore: s.hiScore, lives: s.lives })

      if (s.score > prevScoreRef.current) playKill()
      prevScoreRef.current = s.score

      if (s.divingEnemies.length > prevDivingRef.current) playDive()
      prevDivingRef.current = s.divingEnemies.length

      if (s.lives < prevLivesRef.current) playDie()
      prevLivesRef.current = s.lives
    }, 100)
    return () => clearInterval(interval)
  }, [stateRef])

  useEffect(() => {
    start()
    setPaused(true)  // start paused, wait for title dismiss
  }, [start, setPaused])

  // ── Render ────────────────────────────────────────────────────────────────
  const highlight = tutorialStep === 1 ? 'move' : tutorialStep === 2 ? 'fire' : null
  const hiScore = parseInt(typeof window !== 'undefined' ? (localStorage.getItem(HISCORE_KEY) ?? '0') : '0', 10)

  return (
    <div className="flex flex-col w-full">
      {/* Header vermelho */}
      <div className="flex items-center justify-between w-full px-4 h-14 bg-primary flex-shrink-0">
        <button onClick={() => router.push('/')} className="font-display text-white text-sm tracking-widest">
          ← SAIR
        </button>
        <span className="font-display text-white text-base tracking-widest">BURGER INVADERS</span>
        <span className="text-white text-lg tracking-widest">
          {'♥'.repeat(Math.max(0, displayState.lives))}
        </span>
      </div>

      <StatsBar score={displayState.score} wave={displayState.wave} hiScore={displayState.hiScore} />

      {/* Canvas + overlays */}
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full block"
          style={{ imageRendering: 'pixelated', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
        />

        {/* Title screen */}
        {phase === 'title' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-6 px-6">
            <div className="flex flex-col items-center gap-2">
              <span className="font-display text-primary text-xs tracking-widest">90&apos;S BURGERS PRESENTS</span>
              <span className="font-display text-secondary text-4xl tracking-widest text-center leading-tight">
                BURGER<br/>INVADERS
              </span>
              <span className="font-display text-gray-500 text-xs tracking-widest mt-1">
                HI-SCORE: {Math.max(hiScore, displayState.hiScore).toLocaleString('pt-BR')}
              </span>
            </div>
            <button
              onClick={startGame}
              className="font-display text-black bg-secondary text-xl tracking-widest px-8 py-3 rounded animate-pulse"
            >
              ► JOGAR
            </button>
          </div>
        )}

        {/* Ready countdown */}
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 gap-4">
            <span className="font-display text-secondary text-2xl tracking-widest">
              WAVE {displayState.wave}
            </span>
            <span className="font-display text-white text-7xl">
              {readyCount > 0 ? readyCount : 'GO!'}
            </span>
          </div>
        )}

        {/* Tutorial overlay */}
        {phase === 'playing' && tutorialStep !== null && (
          <TutorialOverlay step={tutorialStep} onSkip={skipTutorial} />
        )}

        {/* Game Over overlay */}
        {phase === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-5 px-6">
            <span className="font-display text-primary text-4xl tracking-widest">GAME OVER</span>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display text-secondary text-2xl">
                {displayState.score.toLocaleString('pt-BR')} PTS
              </span>
              {displayState.score >= Math.max(hiScore, 1) && hiScore > 0 && (
                <span className="font-display text-yellow-400 text-sm tracking-wider animate-pulse">
                  ★ NOVO RECORDE!
                </span>
              )}
              <span className="text-gray-500 text-xs mt-1">
                HI: {Math.max(hiScore, displayState.score).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => { start(); setPhase('ready'); setReadyCount(3) }}
                className="font-display text-black bg-secondary text-base tracking-widest px-6 py-2 rounded"
              >
                JOGAR DE NOVO
              </button>
              <button
                onClick={() => router.push('/')}
                className="font-display text-gray-400 border border-gray-700 text-base tracking-widest px-6 py-2 rounded"
              >
                SAIR
              </button>
            </div>
          </div>
        )}
      </div>

      <TouchControls onTouchStart={touchStart} onTouchEnd={touchEnd} highlight={highlight} />
    </div>
  )
}
```

- [ ] **Step 2: Type check + build**

```bash
npx tsc --noEmit 2>&1 && npm run build 2>&1 | tail -12
```
Expected: zero erros, build table impressa.

- [ ] **Step 3: Rodar testes**

```bash
npm test 2>&1 | tail -8
```
Expected: 65 passed.

- [ ] **Step 4: Commit e push**

```bash
git add src/components/game/BurgerInvaders.tsx src/lib/game/audio.ts
git commit -m "feat: title screen, ready countdown, game over, hi-score, áudio chiptune"
git push hub main
```
