'use client'

import DiscountBadge from '@/components/ui/DiscountBadge'
import type { RankingEntry } from '@/hooks/useRanking'

type Props = {
  entries: RankingEntry[]
  currentPlayerId: string | null
  discountPct: number
  topN: number
  loading: boolean
}

export default function LeaderboardTable({
  entries,
  currentPlayerId,
  discountPct,
  topN,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="font-display text-gray-500 text-xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        Nenhuma pontuação ainda. Seja o primeiro!
      </p>
    )
  }

  const currentEntry = entries.find((e) => e.player_id === currentPlayerId)
  const top10 = entries.slice(0, 10)
  const currentIsInTop10 = top10.some((e) => e.player_id === currentPlayerId)

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {currentEntry && (
        <div className="mb-4 bg-tertiary/10 border border-tertiary rounded px-4 py-2 text-center">
          <span className="font-display text-tertiary text-lg tracking-wider">
            SUA POSIÇÃO: #{currentEntry.position}
          </span>
          <span className="text-gray-400 text-sm ml-3">
            {currentEntry.score.toLocaleString('pt-BR')} pts
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {top10.map((entry) => {
          const isCurrentPlayer = entry.player_id === currentPlayerId
          const hasDiscount = Number(entry.position) <= topN

          return (
            <li
              key={entry.player_id}
              className={`flex items-center justify-between rounded px-3 py-2 border transition-colors ${
                isCurrentPlayer
                  ? 'border-tertiary bg-tertiary/10'
                  : hasDiscount
                  ? 'border-secondary/40 bg-secondary/5'
                  : 'border-gray-800 bg-black opacity-70'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-gray-400 w-7 text-sm">
                  #{entry.position}
                </span>
                <span
                  className={`text-sm font-body ${
                    isCurrentPlayer ? 'text-tertiary font-semibold' : 'text-white'
                  }`}
                >
                  {entry.players?.nickname ?? 'Jogador'}
                  {isCurrentPlayer && (
                    <span className="text-xs text-gray-400 ml-1">(você)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {entry.score.toLocaleString('pt-BR')}
                </span>
                {hasDiscount && <DiscountBadge pct={discountPct} />}
              </div>
            </li>
          )
        })}

        {currentEntry && !currentIsInTop10 && (
          <>
            <li className="text-center text-gray-600 font-display text-sm py-1">· · ·</li>
            <li className="flex items-center justify-between rounded px-3 py-2 border border-tertiary bg-tertiary/10">
              <div className="flex items-center gap-3">
                <span className="font-display text-gray-400 w-7 text-sm">
                  #{currentEntry.position}
                </span>
                <span className="text-sm font-body text-tertiary font-semibold">
                  {currentEntry.players?.nickname ?? 'Jogador'}
                  <span className="text-xs text-gray-400 ml-1">(você)</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {currentEntry.score.toLocaleString('pt-BR')}
                </span>
              </div>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}
