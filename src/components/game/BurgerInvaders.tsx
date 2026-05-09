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
  const [readyCount, setReadyCount] = useState(3)
  const [displayState, setDisplayState] = useState({
    score: 0, wave: 1, hiScore: 0, lives: 3,
  })
  const prevScoreRef   = useRef(0)
  const prevDivingRef  = useRef(0)
  const prevLivesRef   = useRef(3)

  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TUTORIAL_KEY)) return null
    return 1
  })

  const { start, touchStart: rawTouchStart, touchEnd, setPaused, setDragX, stateRef } = useGameLoop({
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

  // ── Tutorial ─────────────────────────────────────────────────────────────────
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

  // ── Phase transitions ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    start()
    setPaused(true)
    setPhase('ready')
    setReadyCount(3)
    prevScoreRef.current  = 0
    prevDivingRef.current = 0
    prevLivesRef.current  = 3
  }, [start, setPaused])

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
    if (phase === 'playing' && tutorialStep === null) {
      setPaused(false)
    } else if (phase === 'title' || phase === 'gameover' || phase === 'ready') {
      setPaused(true)
    }
  }, [phase, tutorialStep, setPaused])

  // ── Autofire (playing, fora do tutorial) ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || tutorialStep !== null) return
    const iv = setInterval(() => {
      rawTouchStart('fire')
      touchEnd('fire')
    }, 300)
    return () => clearInterval(iv)
  }, [phase, tutorialStep, rawTouchStart, touchEnd])

  // ── Sound effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current
      if (!s) return
      setDisplayState({ score: s.score, wave: s.wave, hiScore: s.hiScore, lives: s.lives })
      if (s.score > prevScoreRef.current) playKill()
      if (s.divingEnemies.length > prevDivingRef.current) playDive()
      if (s.lives < prevLivesRef.current) playDie()
      prevScoreRef.current  = s.score
      prevDivingRef.current = s.divingEnemies.length
      prevLivesRef.current  = s.lives
    }, 100)
    return () => clearInterval(iv)
  }, [stateRef])

  // Iniciar com jogo pausado (espera title dismiss)
  useEffect(() => {
    start()
    setPaused(true)
  }, [start, setPaused])

  // ── Canvas touch drag ─────────────────────────────────────────────────────────
  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const canvasX = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_WIDTH
    setDragX(canvasX)
  }, [setDragX])

  const handleCanvasTouchEnd = useCallback(() => setDragX(null), [setDragX])

  // ── Hi-score ──────────────────────────────────────────────────────────────────
  const storedHi = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem(HISCORE_KEY) ?? '0', 10)
    : 0
  const hiScore = Math.max(storedHi, displayState.score)

  const highlight = tutorialStep === 1 ? 'move' : tutorialStep === 2 ? 'fire' : null

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
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
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
        />

        {/* Tela de título */}
        {phase === 'title' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-6 px-6">
            <div className="flex flex-col items-center gap-2">
              <span className="font-display text-primary text-xs tracking-widest">90&apos;S BURGERS PRESENTS</span>
              <span className="font-display text-secondary text-4xl tracking-widest text-center leading-tight">
                BURGER<br/>INVADERS
              </span>
              <span className="font-display text-gray-500 text-xs tracking-widest mt-1">
                HI: {hiScore.toLocaleString('pt-BR')}
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
            <span className="font-display text-secondary text-2xl tracking-widest">WAVE {displayState.wave}</span>
            <span className="font-display text-white text-7xl">
              {readyCount > 0 ? readyCount : 'GO!'}
            </span>
          </div>
        )}

        {/* Tutorial */}
        {phase === 'playing' && tutorialStep !== null && (
          <TutorialOverlay step={tutorialStep} onSkip={skipTutorial} />
        )}

        {/* Game Over */}
        {phase === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-5 px-6">
            <span className="font-display text-primary text-4xl tracking-widest">GAME OVER</span>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display text-secondary text-2xl">
                {displayState.score.toLocaleString('pt-BR')} PTS
              </span>
              {displayState.score > 0 && displayState.score >= storedHi && storedHi > 0 && (
                <span className="font-display text-yellow-400 text-sm tracking-wider animate-pulse">
                  ★ NOVO RECORDE!
                </span>
              )}
              <span className="text-gray-500 text-xs mt-1">
                HI: {hiScore.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={startGame}
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
