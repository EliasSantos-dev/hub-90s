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
    <div className="flex flex-col items-center w-full">
      {/* Game header: SAIR | BURGER INVADERS | ♥♥♥ */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-black border-b border-gray-800">
        <button
          onClick={() => router.push('/')}
          className="font-display text-gray-400 hover:text-secondary text-sm tracking-widest transition-colors"
        >
          ← SAIR
        </button>
        <span className="font-display text-secondary text-base tracking-widest">
          BURGER INVADERS
        </span>
        <span className="text-primary text-lg tracking-widest">
          {'♥'.repeat(Math.max(0, displayState.lives))}
        </span>
      </div>

      <StatsBar
        score={displayState.score}
        wave={displayState.wave}
        hiScore={displayState.hiScore}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      <TouchControls onAction={touchAction} />
    </div>
  )
}
