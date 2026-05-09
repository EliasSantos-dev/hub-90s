# Galaga Upgrade — Design Spec

**Date:** 2026-05-08  
**Source:** Galaga/Galaxian spec + Pencil designs  
**Repo:** /home/elias-santos/repos/game-90s  

---

## Context

Burger Invaders is a Space Invaders clone. This upgrade transforms it into a Galaga-style game:
- Enemies leave formation and dive at the player via Bézier curves
- Pixel-art sprites replace emoji
- Parallax star background (3 layers)
- Particle explosions + screen shake
- Chiptune audio (Web Audio API)
- Title / Ready / Game Over states
- Hi-score via localStorage

Stack: Next.js 14 App Router, React, TypeScript, Canvas 2D, Tailwind CSS.

---

## Decomposition

### Sub-A — Engine expansion
**File:** `src/lib/game/engine.ts`

New types added to GameState (backwards-compatible — tests still pass):
- `DivingEnemy` — enemy on Bézier path, separate from formation
- `Particle` — explosion particle (position, velocity, life, color)
- `Star` — parallax star (x, y, layer 0-2, twinklePhase)
- `formationVX` — smooth oscillation velocity (replaces step movement)
- `diveTimer` — ms until next dive
- `shakeTimer / shakeIntensity` — screen shake state
- `animFrame / animTimer` — 2-frame enemy animation

Formation movement: smooth velocity-based (bounces at edges, ~48 px/s).  
Dive scheduler: every 2.8–4.5s, 1–2 enemies leave formation and follow a cubic Bézier swoop.  
Bézier path: start at slot, control points create a swoop/loop, exit below canvas.  
Diving enemy: fires one bullet at t≈0.4, scores 2× row value.  
Particles: created on enemy death (8 particles) and player death (20 particles).  
Screen shake: SHAKE_DURATION=320ms on player hit.

**Constraint:** SCORE_BY_ROW stays {0:30, 1:20, 2:10} — tests verify these values.

---

### Sub-B — Renderer expansion
**File:** `src/lib/game/renderer.ts`

- Screen shake: `ctx.translate(shakeX, shakeY)` at start of frame
- Parallax stars: 3-layer rendering before game objects
- Hamburger pixel art: exact spec section 4 (24×18px, 5 layers)
- Enemy sprites: Bee (16×16, yellow, animated wings) + Butterfly (16×16, red, animated wings)
- Diving enemy rendering with subtle rotation during dive
- Particle rendering with globalAlpha = particle.life
- Bottom HUD: mini hamburger sprites for lives (replaces emoji)

---

### Sub-C — Game states + hi-score
**File:** `src/components/game/BurgerInvaders.tsx`

Phases: `'title' | 'ready' | 'playing' | 'gameover'`

- **Title:** overlay with logo, hi-score display, ► JOGAR button
- **Ready:** countdown 3→2→1→GO! (1s per step), then setPaused(false)
- **Playing:** existing game, plus audio sound effects on kill/die/dive
- **GameOver:** score + hi-score, "NOVO RECORDE!" badge, JOGAR DE NOVO + SAIR buttons

Hi-score: `localStorage('bi_hiscore')`, compared on game over.

---

### Sub-D — Audio
**File:** `src/lib/game/audio.ts` (create)

Web Audio API synth sounds (no files):
- `playShoot()` — square wave 880→1200Hz, 60ms
- `playKill()` — square wave 220→80Hz, 100ms  
- `playDive()` — square wave 200→600Hz, 180ms
- `playDie()` — sawtooth 800→50Hz, 800ms
- `playWave()` — 3 ascending beeps (C-E-G, 262/330/392Hz)

Lazy AudioContext init (unlocked by first user interaction).

---

### Sub-E — Touch drag + autofire
**File:** `src/hooks/useGameLoop.ts`, `src/components/game/BurgerInvaders.tsx`

- Touch drag: player follows finger X position on canvas touch events
- Autofire: when in `playing` phase, fire bullet every 400ms automatically
- Keep existing button controls as fallback

---

## Implementation Order

Wave 1 (parallel): Sub-A + Sub-D  
Wave 2 (parallel, after A): Sub-B + Sub-E  
Wave 3 (after B): Sub-C  
