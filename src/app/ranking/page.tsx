'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import { useRanking } from '@/hooks/useRanking'
import LeaderboardTable from '@/components/ranking/LeaderboardTable'

export default function RankingPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const activeGame = games.find((g) => g.id === activeGameId) ?? null
  const { ranking, loading } = useRanking(activeGameId)

  useEffect(() => {
    async function init() {
      const [currentPlayer, { data: gamesData }] = await Promise.all([
        getCurrentPlayer(),
        supabase.from('games').select('*').eq('active', true),
      ])
      setPlayer(currentPlayer)
      const g = (gamesData as Game[]) ?? []
      setGames(g)
      if (g.length > 0) setActiveGameId(g[0].id)
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Compact header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-bg sticky top-0 z-40">
        <Link href="/" className="font-display text-gray-400 hover:text-secondary text-sm tracking-widest transition-colors">
          ← VOLTAR
        </Link>
        <span className="font-display text-secondary text-xl tracking-widest">
          🏆 RANKING
        </span>
        <span className="font-display text-gray-500 text-sm tracking-widest">
          GLOBAL
        </span>
      </header>

      <main className="flex flex-col items-center py-6 gap-4">
        {games.length > 1 && (
          <div className="flex gap-2">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGameId(g.id)}
                className={`font-display text-sm tracking-widest px-4 py-1.5 rounded border transition-colors ${
                  activeGameId === g.id
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {g.name.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <LeaderboardTable
          entries={ranking}
          currentPlayerId={player?.id ?? null}
          discountPct={activeGame?.discount_pct ?? 10}
          topN={activeGame?.top_n_discount ?? 3}
          loading={loading}
        />
      </main>
    </div>
  )
}
