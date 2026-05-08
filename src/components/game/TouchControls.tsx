'use client'

import type { GameAction } from '@/lib/game/engine'

type Props = {
  onTouchStart: (action: GameAction) => void
  onTouchEnd: (action: GameAction) => void
}

export default function TouchControls({ onTouchStart, onTouchEnd }: Props) {
  function start(action: GameAction) {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      onTouchStart(action)
    }
  }

  function end(action: GameAction) {
    return () => onTouchEnd(action)
  }

  return (
    <div className="flex items-center justify-between px-7 py-5 bg-[#0d0d0d] select-none flex-1">
      <button
        onTouchStart={start('left')}
        onTouchEnd={end('left')}
        onMouseDown={start('left')}
        onMouseUp={end('left')}
        onMouseLeave={end('left')}
        className="w-16 h-16 rounded-full border-2 border-gray-600 flex items-center justify-center text-gray-300 text-2xl active:bg-white/10"
      >
        ◀
      </button>

      <button
        onTouchStart={start('fire')}
        onTouchEnd={end('fire')}
        onMouseDown={start('fire')}
        onMouseUp={end('fire')}
        className="w-20 h-20 rounded-full bg-primary flex items-center justify-center font-display text-white text-base tracking-wider shadow-[0_0_20px_#b92526] active:opacity-80"
      >
        FIRE
      </button>

      <button
        onTouchStart={start('right')}
        onTouchEnd={end('right')}
        onMouseDown={start('right')}
        onMouseUp={end('right')}
        onMouseLeave={end('right')}
        className="w-16 h-16 rounded-full border-2 border-gray-600 flex items-center justify-center text-gray-300 text-2xl active:bg-white/10"
      >
        ▶
      </button>
    </div>
  )
}
