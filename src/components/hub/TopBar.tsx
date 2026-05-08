'use client'

type Props = {
  fichasBalance: number
  onInsertFicha: () => void
}

export default function TopBar({ fichasBalance }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-bg sticky top-0 z-40">
      <span className="font-display text-secondary text-xl tracking-widest">
        90&apos;S BURGERS
      </span>
      <span className="font-display text-secondary text-lg tracking-wider">
        ★ {fichasBalance}
      </span>
    </header>
  )
}
