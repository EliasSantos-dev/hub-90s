import type { GameState } from './engine'

// ── Hambúrguer pixel art (spec seção 4, 24×18px) ──────────────────────────────
function drawHamburger(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  const P = '#D4A574', Ps = '#B8864A', G = '#FFE4B5'
  const L = '#4CAF50', Q = '#FFC107', C = '#5D2F1A'

  // Pão de cima — cúpula
  ctx.fillStyle = P
  ctx.fillRect(px+6,  py+0, 12, 1)
  ctx.fillRect(px+4,  py+1, 16, 1)
  ctx.fillRect(px+3,  py+2, 18, 1)
  ctx.fillRect(px+2,  py+3, 20, 1)
  ctx.fillRect(px+1,  py+4, 22, 3)
  // Sombra
  ctx.fillStyle = Ps
  ctx.fillRect(px+1,  py+6, 2, 1)
  ctx.fillRect(px+21, py+6, 2, 1)
  // Gergelim
  ctx.fillStyle = G
  for (const gx of [7, 12, 16]) ctx.fillRect(px+gx, py+2, 1, 1)
  for (const gx of [5, 18])     ctx.fillRect(px+gx, py+3, 1, 1)

  // Alface
  ctx.fillStyle = L
  ctx.fillRect(px+0, py+7, 24, 1)
  for (const wx of [0,1,3,4,6,7,9,10,12,13,15,16,18,19,21,22])
    ctx.fillRect(px+wx, py+8, 1, 1)

  // Queijo
  ctx.fillStyle = Q
  ctx.fillRect(px+1, py+9, 22, 1)
  for (const dx of [3, 8, 14, 20]) ctx.fillRect(px+dx, py+10, 1, 1)

  // Carne
  ctx.fillStyle = C
  ctx.fillRect(px+1, py+11, 22, 3)
  ctx.fillStyle = Ps
  for (const tx of [4, 10, 16]) ctx.fillRect(px+tx, py+12, 1, 1)

  // Pão de baixo
  ctx.fillStyle = P
  ctx.fillRect(px+1, py+14, 22, 2)
  ctx.fillRect(px+2, py+16, 20, 1)
  ctx.fillRect(px+4, py+17, 16, 1)
  ctx.fillStyle = Ps
  ctx.fillRect(px+1,  py+14, 1, 1)
  ctx.fillRect(px+22, py+14, 1, 1)
}

// ── Bee (16×16, row 1+2) ──────────────────────────────────────────────────────
function drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, f: 0 | 1): void {
  // Corpo amarelo
  ctx.fillStyle = '#FFD700'
  ctx.fillRect(x+4, y+4, 8, 8)
  ctx.fillRect(x+5, y+3, 6, 10)
  // Listras
  ctx.fillStyle = '#000000'
  ctx.fillRect(x+4, y+7, 8, 1)
  ctx.fillRect(x+4, y+9, 8, 1)
  // Olhos
  ctx.fillRect(x+5, y+5, 2, 2)
  ctx.fillRect(x+9, y+5, 2, 2)
  // Asas animadas
  ctx.fillStyle = 'rgba(200,220,255,0.85)'
  const wy = f === 0 ? y+3 : y+6
  ctx.fillRect(x+0,  wy, 4, 4)
  ctx.fillRect(x+12, wy, 4, 4)
}

// ── Butterfly (16×16, row 0) ──────────────────────────────────────────────────
function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, f: 0 | 1): void {
  // Corpo vermelho
  ctx.fillStyle = '#FF2244'
  ctx.fillRect(x+6, y+3, 4, 10)
  ctx.fillRect(x+5, y+5, 6, 6)
  // Olhos
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x+5, y+4, 2, 2)
  ctx.fillRect(x+9, y+4, 2, 2)
  ctx.fillStyle = '#000000'
  ctx.fillRect(x+5, y+4, 1, 1)
  ctx.fillRect(x+10, y+4, 1, 1)
  // Asas animadas (maiores)
  ctx.fillStyle = 'rgba(255,120,120,0.88)'
  const wy  = f === 0 ? y+2 : y+5
  const wy2 = f === 0 ? y+7 : y+4
  ctx.fillRect(x+0,  wy,  5, 6); ctx.fillRect(x+11, wy,  5, 6)
  ctx.fillRect(x+1,  wy2, 4, 4); ctx.fillRect(x+11, wy2, 4, 4)
  // Detalhe branco
  ctx.fillStyle = '#FFFFFF'
  const dy = f === 0 ? y+3 : y+6
  ctx.fillRect(x+1,  dy, 2, 2)
  ctx.fillRect(x+13, dy, 2, 2)
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  row: number, frame: 0 | 1
): void {
  if (row === 0) drawButterfly(ctx, x, y, frame)
  else           drawBee(ctx, x, y, frame)
}

// ── Batata frita (projétil do jogador 3×8) ────────────────────────────────────
function drawFry(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#FFD27F'
  ctx.fillRect(x, y, 3, 8)
  ctx.fillStyle = '#FF8800'
  ctx.fillRect(x+1, y, 1, 8)
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { canvasWidth: W, canvasHeight: H } = state

  // Screen shake offset
  const shakeX = state.shakeTimer > 0 ? (Math.random()-0.5) * state.shakeIntensity * 2 : 0
  const shakeY = state.shakeTimer > 0 ? (Math.random()-0.5) * state.shakeIntensity      : 0
  ctx.save()
  ctx.translate(shakeX, shakeY)

  // Fundo preto
  ctx.fillStyle = '#000000'
  ctx.fillRect(-4, -4, W+8, H+8)

  // Parallax stars
  const time = Date.now() * 0.001
  const starColors = ['#444444', '#999999', '#FFFFFF']
  for (const s of state.stars) {
    const twinkle = s.layer === 2
      ? 0.5 + 0.5 * Math.sin(time * 3 + s.twinklePhase)
      : 1
    ctx.globalAlpha = twinkle * (0.4 + s.layer * 0.3)
    ctx.fillStyle = starColors[s.layer]
    ctx.fillRect(s.x, s.y, s.size, s.size)
  }
  ctx.globalAlpha = 1

  // Silhueta de prédios
  ctx.fillStyle = '#1a1a2e'
  for (const b of [
    {x:0,w:60,h:50},{x:70,w:40,h:80},{x:120,w:80,h:60},{x:210,w:50,h:100},
    {x:270,w:30,h:70},{x:310,w:90,h:55},{x:410,w:60,h:90},{x:480,w:40,h:65},
  ]) {
    ctx.fillRect(b.x, H - b.h, b.w, b.h)
  }

  // Inimigos em formação
  for (const e of state.enemies) {
    if (!e.alive || e.diving) continue
    drawEnemy(ctx, e.x, e.y, e.row, state.animFrame)
  }

  // Inimigos em dive (com rotação sutil)
  for (const de of state.divingEnemies) {
    if (!de.alive) continue
    ctx.save()
    ctx.translate(de.x + de.width/2, de.y + de.height/2)
    ctx.rotate(Math.sin(de.t * Math.PI * 3) * 0.3)
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
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Vidas (mini hambúrgueres)
  for (let i = 0; i < state.lives; i++) {
    ctx.save()
    ctx.scale(0.6, 0.6)
    drawHamburger(ctx, Math.floor((8 + i * 20) / 0.6), Math.floor((H - 16) / 0.6))
    ctx.restore()
  }

  ctx.restore()
}
