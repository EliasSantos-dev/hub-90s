'use client'

import type { GameAction } from '@/lib/game/engine'

type Props = {
  onAction: (action: GameAction) => void
}

export default function TouchControls({ onAction }: Props) {
  function handleTouch(action: GameAction) {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault()
      onAction(action)
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-black border-t border-gray-800 select-none md:hidden">
      <button
        onTouchStart={handleTouch('left')}
        onMouseDown={handleTouch('left')}
        className="w-16 h-16 rounded-full border-2 border-secondary flex items-center justify-center font-display text-secondary text-2xl active:bg-secondary/20"
      >
        ◀
      </button>

      <button
        onTouchStart={handleTouch('fire')}
        onMouseDown={handleTouch('fire')}
        className="w-20 h-16 rounded border-2 border-primary flex items-center justify-center font-display text-primary text-xl tracking-wider active:bg-primary/20"
      >
        FIRE
      </button>

      <button
        onTouchStart={handleTouch('right')}
        onMouseDown={handleTouch('right')}
        className="w-16 h-16 rounded-full border-2 border-secondary flex items-center justify-center font-display text-secondary text-2xl active:bg-secondary/20"
      >
        ▶
      </button>
    </div>
  )
}
