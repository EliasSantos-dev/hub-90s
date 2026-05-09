'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameLoop } from '@/hooks/useGameLoop'
import StatsBar from './StatsBar'
import TouchControls from './TouchControls'
import TutorialOverlay from './TutorialOverlay'
import type { GameState } from '@/lib/game/engine'
import { saveScore } from '@/lib/scores'

type Props = {
  playerId: string | null
  gameId: string
  season: number
}

const CANVAS_WIDTH = 480
const CANVAS_HEIGHT = 520
const TUTORIAL_KEY = 'bi_tutorial_done'

type TutorialStep = 1 | 2 | 3 | null

export default function BurgerInvaders({ playerId, gameId, season }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [displayState, setDisplayState] = useState({
    score: 0, wave: 1, hiScore: 0, lives: 3,
  })

  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_KEY)) return null
    return 1
  })

  const { start, touchStart: rawTouchStart, touchEnd, setPaused, stateRef } = useGameLoop({
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

  const skipTutorial = useCallback(() => {
    setTutorialStep(null)
    localStorage.setItem(TUTORIAL_KEY, '1')
  }, [])

  // Intercept touchStart to advance tutorial steps
  const touchStart = useCallback((action: import('@/lib/game/engine').GameAction) => {
    rawTouchStart(action)
    setTutorialStep((prev) => {
      if ((action === 'left' || action === 'right') && prev === 1) return 2
      if (action === 'fire' && prev === 2) return 3
      return prev
    })
  }, [rawTouchStart])

  // Pause/unpause + auto-dismiss step 3
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

  const highlight = tutorialStep === 1 ? 'move' : tutorialStep === 2 ? 'fire' : null

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

      {/* Canvas + overlay do tutorial */}
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full block"
          style={{ imageRendering: 'pixelated', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
        />
        {tutorialStep !== null && (
          <TutorialOverlay step={tutorialStep} onSkip={skipTutorial} />
        )}
      </div>

      <TouchControls
        onTouchStart={touchStart}
        onTouchEnd={touchEnd}
        highlight={highlight}
      />
    </div>
  )
}
