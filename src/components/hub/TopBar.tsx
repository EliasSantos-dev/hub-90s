'use client'

import Image from 'next/image'

type Props = {
  fichasBalance: number
  onInsertFicha: () => void
}

export default function TopBar({ fichasBalance, onInsertFicha }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-bg sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <Image
          src="https://redirect90s.vercel.app/assets/logo1.png"
          alt="90s Burgers"
          width={48}
          height={48}
          className="rounded"
          unoptimized
        />
        <span className="font-display text-secondary text-xl tracking-widest hidden sm:block">
          90s BURGERS
        </span>
      </div>

      <button
        onClick={onInsertFicha}
        className="flex items-center gap-2 border border-secondary rounded px-3 py-1 hover:bg-secondary/10 transition-colors"
      >
        <span className="text-secondary font-display text-lg tracking-wider">
          🪙 {fichasBalance}
        </span>
        <span className="text-gray-400 text-xs uppercase tracking-wider hidden sm:block">
          fichas
        </span>
      </button>
    </header>
  )
}
