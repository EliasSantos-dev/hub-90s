'use client'

type Props = {
  fichasBalance: number
  onInsertFicha: () => void
}

export default function TopBar({ fichasBalance }: Props) {
  return (
    <header className="flex items-center justify-between px-4 h-14 bg-primary sticky top-0 z-40 flex-shrink-0">
      <span className="font-display text-white text-xl tracking-widest">
        90&apos;S BURGERS
      </span>
      <span className="font-display text-secondary text-base tracking-wider">
        ★ {fichasBalance}
      </span>
    </header>
  )
}
