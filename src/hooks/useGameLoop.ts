'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createGameState, tickGame, movePlayer, fireBullet, type GameState, type GameAction } from '@/lib/game/engine'
import { renderFrame } from '@/lib/game/renderer'

type Options = {
  canvasRef: React.RefObject<HTMLCanvasElement>
  onGameOver: (state: GameState) => void
}

export function useGameLoop({ canvasRef, onGameOver }: Options) {
  const stateRef = useRef<GameState | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const pressedKeys = useRef<Set<string>>(new Set())
  const touchPressed = useRef<Set<GameAction>>(new Set())
  const onGameOverRef = useRef(onGameOver)
  onGameOverRef.current = onGameOver

  const start = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const canvas = canvasRef.current
    if (!canvas) return
    stateRef.current = createGameState(canvas.width, canvas.height)
    pressedKeys.current.clear()
    touchPressed.current.clear()
    lastTimeRef.current = 0

    function loop(timestamp: number) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
      lastTimeRef.current = timestamp

      let state = stateRef.current!

      if (pressedKeys.current.has('ArrowLeft') || pressedKeys.current.has('a') || touchPressed.current.has('left')) {
        state = movePlayer(state, 'left')
      }
      if (pressedKeys.current.has('ArrowRight') || pressedKeys.current.has('d') || touchPressed.current.has('right')) {
        state = movePlayer(state, 'right')
      }
      if (pressedKeys.current.has(' ') || touchPressed.current.has('fire')) {
        state = fireBullet(state)
      }

      state = tickGame(state, delta)
      stateRef.current = state

      renderFrame(ctx, state)

      if (state.gameStatus === 'gameover') {
        onGameOverRef.current(state)
        return
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [canvasRef])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    pressedKeys.current.add(e.key)
    if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    pressedKeys.current.delete(e.key)
  }, [])

  const touchStart = useCallback((action: GameAction) => {
    if (action !== 'none') touchPressed.current.add(action)
  }, [])

  const touchEnd = useCallback((action: GameAction) => {
    touchPressed.current.delete(action)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(rafRef.current)
    }
  }, [handleKeyDown, handleKeyUp])

  return { start, stop, touchStart, touchEnd, stateRef }
}
