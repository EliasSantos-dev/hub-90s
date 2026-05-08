import DiscountBadge from '@/components/ui/DiscountBadge'
import type { RankingEntry } from '@/hooks/useRanking'

type Props = {
  entries: RankingEntry[]
  discountPct: number
  topN: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function RankingPreview({ entries, discountPct, topN }: Props) {
  const preview = entries.slice(0, 2)

  return (
    <section className="px-4 pb-6 max-w-lg mx-auto w-full">
      <h2 className="font-display text-tertiary text-xl tracking-widest mb-3 text-center">
        RANKING
      </h2>

      {preview.length === 0 ? (
        <p className="text-center text-gray-500 text-sm">
          Nenhuma pontuação ainda. Seja o primeiro!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {preview.map((entry) => (
            <li
              key={entry.player_id}
              className="flex items-center justify-between bg-black border border-gray-800 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{MEDALS[Number(entry.position) - 1] ?? `#${entry.position}`}</span>
                <span className="font-body text-white text-sm">
                  {entry.players?.nickname ?? 'Jogador'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-secondary text-lg">
                  {entry.score.toLocaleString('pt-BR')}
                </span>
                {Number(entry.position) <= topN && (
                  <DiscountBadge pct={discountPct} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-gray-500 text-xs mt-3">
        Top {topN} ganham desconto de {discountPct}% no delivery
      </p>
    </section>
  )
}
