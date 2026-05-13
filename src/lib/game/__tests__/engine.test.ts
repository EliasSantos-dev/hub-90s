import { describe, it, expect } from 'vitest'
import {
  createGameState,
  continueGameState,
  tickGame,
  movePlayer,
  fireBullet,
  ENEMY_ROWS,
  ENEMY_COLS,
  SCORE_BY_ROW,
  type GameState,
} from '../engine'

describe('createGameState', () => {
  it('creates grid with correct number of enemies', () => {
    const state = createGameState(800, 600)
    const aliveEnemies = state.enemies.filter((e) => e.alive)
    expect(aliveEnemies.length).toBe(ENEMY_ROWS * ENEMY_COLS)
  })
  it('starts with 3 lives', () => {
    const state = createGameState(800, 600)
    expect(state.lives).toBe(3)
  })
  it('starts with score 0', () => {
    const state = createGameState(800, 600)
    expect(state.score).toBe(0)
  })
  it('starts with gameStatus playing', () => {
    const state = createGameState(800, 600)
    expect(state.gameStatus).toBe('playing')
  })
})

describe('movePlayer', () => {
  it('moves player left', () => {
    const state = createGameState(800, 600)
    const initialX = state.player.x
    const next = movePlayer(state, 'left')
    expect(next.player.x).toBeLessThan(initialX)
  })
  it('moves player right', () => {
    const state = createGameState(800, 600)
    const initialX = state.player.x
    const next = movePlayer(state, 'right')
    expect(next.player.x).toBeGreaterThan(initialX)
  })
  it('does not move player past left edge', () => {
    const state = createGameState(800, 600)
    let s = state
    for (let i = 0; i < 200; i++) s = movePlayer(s, 'left')
    expect(s.player.x).toBeGreaterThanOrEqual(0)
  })
  it('does not move player past right edge (800px wide)', () => {
    const state = createGameState(800, 600)
    let s = state
    for (let i = 0; i < 200; i++) s = movePlayer(s, 'right')
    expect(s.player.x + s.player.width).toBeLessThanOrEqual(800)
  })
})

describe('fireBullet', () => {
  it('adds a bullet to state', () => {
    const state = createGameState(800, 600)
    const next = fireBullet(state)
    expect(next.bullets.length).toBe(1)
  })
  it('bullet starts above the player', () => {
    const state = createGameState(800, 600)
    const next = fireBullet(state)
    expect(next.bullets[0].y).toBeLessThan(state.player.y)
  })
  it('does not add a second bullet when one is already active', () => {
    const state = createGameState(800, 600)
    const s1 = fireBullet(state)
    const s2 = fireBullet(s1)
    expect(s2.bullets.length).toBe(1)
  })
})

describe('tickGame — bullet collision', () => {
  it('kills an enemy and increases score when bullet hits', () => {
    const state = createGameState(800, 600)
    const firstEnemy = state.enemies[0]
    const stateWithBullet: GameState = {
      ...state,
      bullets: [
        {
          id: 'b1',
          x: firstEnemy.x,
          y: firstEnemy.y,
          width: 4,
          height: 10,
          active: true,
          owner: 'player',
          vy: -8,
        },
      ],
    }
    const next = tickGame(stateWithBullet, 16)
    const killedEnemy = next.enemies.find((e) => e.id === firstEnemy.id)
    expect(killedEnemy?.alive).toBe(false)
    expect(next.score).toBeGreaterThan(0)
  })
})

describe('SCORE_BY_ROW', () => {
  it('row 0 (aliens) = 30', () => expect(SCORE_BY_ROW[0]).toBe(30))
  it('row 1 (burgers) = 20', () => expect(SCORE_BY_ROW[1]).toBe(20))
  it('row 2 (batatas) = 10', () => expect(SCORE_BY_ROW[2]).toBe(10))
})

describe('continueGameState', () => {
  it('mantém wave, score e hiScore do estado anterior', () => {
    const base = createGameState(480, 520)
    const prev = { ...base, wave: 5, score: 12000, hiScore: 15000 }
    const next = continueGameState(prev)
    expect(next.wave).toBe(5)
    expect(next.score).toBe(12000)
    expect(next.hiScore).toBe(15000)
  })

  it('reseta lives para 1', () => {
    const base = createGameState(480, 520)
    const next = continueGameState({ ...base, lives: 0 })
    expect(next.lives).toBe(1)
  })

  it('reconstrói a grade de inimigos completa', () => {
    const base = createGameState(480, 520)
    const noEnemies = { ...base, enemies: base.enemies.map(e => ({ ...e, alive: false })) }
    const next = continueGameState(noEnemies)
    expect(next.enemies.filter(e => e.alive).length).toBe(ENEMY_ROWS * ENEMY_COLS)
  })

  it('escala formationVX com a wave', () => {
    const base = createGameState(480, 520)
    const w1 = continueGameState({ ...base, wave: 1 })
    const w5 = continueGameState({ ...base, wave: 5 })
    expect(Math.abs(w5.formationVX)).toBeGreaterThan(Math.abs(w1.formationVX))
  })

  it('define gameStatus como playing', () => {
    const base = createGameState(480, 520)
    const next = continueGameState({ ...base, gameStatus: 'gameover' })
    expect(next.gameStatus).toBe('playing')
  })
})
