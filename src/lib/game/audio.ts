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
