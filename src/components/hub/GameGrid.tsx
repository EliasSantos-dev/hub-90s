import Link from 'next/link'
import type { Game } from '@/lib/supabase'

type Props = {
  games: Game[]
}

const GAME_ROUTES: Record<string, string> = {
  'burger-invaders': '/games/burger-invaders',
}

export default function GameGrid({ games }: Props) {
  const slots = [
    ...games,
    ...Array(Math.max(0, 4 - games.length)).fill(null),
  ].slice(0, 4)

  return (
    <section className="grid grid-cols-2 gap-4 p-4 max-w-lg mx-auto w-full">
      {slots.map((game, i) =>
        game ? (
          <Link
            key={game.id}
            href={GAME_ROUTES[game.slug] ?? '/'}
            className="relative flex flex-col items-center justify-center aspect-square border-2 border-secondary rounded bg-black hover:border-tertiary hover:shadow-[0_0_16px_#ec9837] transition-all group"
          >
            <span className="text-5xl mb-2">👾</span>
            <span className="font-display text-secondary text-lg tracking-widest text-center px-2 leading-tight">
              {game.name.toUpperCase()}
            </span>
            <span className="absolute top-2 right-2 bg-primary text-white text-xs font-display px-1.5 py-0.5 rounded tracking-wider">
              ATIVO
            </span>
          </Link>
        ) : (
          <div
            key={`empty-${i}`}
            className="flex flex-col items-center justify-center aspect-square border-2 border-gray-700 rounded bg-black/40 opacity-50"
          >
            <span className="text-4xl mb-2 grayscale">🎮</span>
            <span className="font-display text-gray-500 text-base tracking-widest">
              EM BREVE
            </span>
          </div>
        )
      )}
    </section>
  )
}
