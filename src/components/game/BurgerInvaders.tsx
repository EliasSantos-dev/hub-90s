'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameLoop } from '@/hooks/useGameLoop'
import StatsBar from './StatsBar'
import TouchControls from './TouchControls'
import type { GameState } from '@/lib/game/engine'
import { saveScore } from '@/lib/scores'

type Props = {
  playerId: string | null
  gameId: string
  season: number
}

const CANVAS_WIDTH = 480
const CANVAS_HEIGHT = 520

export default function BurgerInvaders({ playerId, gameId, season }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [displayState, setDisplayState] = useState({
    score: 0, wave: 1, hiScore: 0, lives: 3,
  })

  const { start, touchAction, stateRef } = useGameLoop({
    canvasRef,
    onGameOver: async (finalState: GameState) => {
      if (playerId) {
        await saveScore({
          playerId,
          gameId,
          score: finalState.score,
          wave: finalState.wave,
          season,
        })
      }
      router.push(
        `/games/burger-invaders/game-over?score=${finalState.score}&wave=${finalState.wave}`
      )
    },
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current
      if (s) {
        setDisplayState({
          score: s.score,
          wave: s.wave,
          hiScore: s.hiScore,
          lives: s.lives,
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [stateRef])

  useEffect(() => {
    start()
  }, [start])

  return (
    <div className="flex flex-col w-full">
      {/* Header vermelho */}
      <div className="flex items-center justify-between w-full px-4 h-14 bg-primary flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="font-display text-white text-sm tracking-widest"
        >
          ← SAIR
        </button>
        <span className="font-display text-white text-base tracking-widest">
          BURGER INVADERS
        </span>
        <span className="text-white text-lg tracking-widest">
          {'♥'.repeat(Math.max(0, displayState.lives))}
        </span>
      </div>

      <StatsBar
        score={displayState.score}
        wave={displayState.wave}
        hiScore={displayState.hiScore}
      />

      {/* Canvas escala por largura, mantém proporção */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full block"
        style={{ imageRendering: 'pixelated', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
      />

      <TouchControls onAction={touchAction} />
    </div>
  )
}
