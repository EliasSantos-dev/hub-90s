# Sub-D: Áudio Chiptune — Web Audio API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `src/lib/game/audio.ts` com sons chiptune sintetizados via Web Audio API — sem arquivos de áudio externos.

**Architecture:** Módulo isolado com funções exportadas (playShoot, playKill, playDive, playDie, playWave). AudioContext lazy-init (criado no primeiro call, compatível com regra do navegador de unlock por interação do usuário). Cada função cria e destrói seus próprios nós de áudio.

**Tech Stack:** TypeScript, Web Audio API

---

## Task 1: Criar audio.ts

**Files:**
- Create: `src/lib/game/audio.ts`

- [ ] **Step 1: Criar o arquivo**

Criar `src/lib/game/audio.ts` com o seguinte conteúdo:

```ts
let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_ctx) {
    _ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )()
  }
  return _ctx
}

function tone(
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  vol: number,
  delayMs = 0
): void {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    const t0 = ctx.currentTime + delayMs / 1000
    osc.frequency.setValueAtTime(startFreq, t0)
    osc.frequency.linearRampToValueAtTime(endFreq, t0 + duration)
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.linearRampToValueAtTime(0, t0 + duration)
    osc.start(t0)
    osc.stop(t0 + duration)
  } catch {
    // Audio unavailable (SSR, permissions, etc.)
  }
}

/** Disparo de batata frita */
export function playShoot(): void {
  tone(880, 1200, 0.06, 'square', 0.08)
}

/** Inimigo destruído */
export function playKill(): void {
  tone(220, 80, 0.10, 'square', 0.12)
}

/** Inimigo inicia dive attack */
export function playDive(): void {
  tone(200, 600, 0.18, 'square', 0.08)
}

/** Jogador morre */
export function playDie(): void {
  tone(800, 50, 0.80, 'sawtooth', 0.15)
}

/** Início de nova wave (C-E-G arpejo) */
export function playWave(): void {
  tone(262, 262, 0.12, 'square', 0.10, 0)
  tone(330, 330, 0.12, 'square', 0.10, 150)
  tone(392, 392, 0.12, 'square', 0.10, 300)
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/elias-santos/repos/game-90s && npx tsc --noEmit 2>&1
```
Expected: sem output.

- [ ] **Step 3: Rodar testes (não devem ser afetados)**

```bash
npm test 2>&1 | tail -6
```
Expected: `Tests  65 passed (65)`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/audio.ts
git commit -m "feat(audio): chiptune Web Audio API — shoot, kill, dive, die, wave"
```
