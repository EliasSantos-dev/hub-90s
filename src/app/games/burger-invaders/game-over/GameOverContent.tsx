'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Game } from '@/lib/supabase'
import { useFichas } from '@/hooks/useFichas'
import { useRanking } from '@/hooks/useRanking'

function GameOverContent() {
  const searchParams = useSearchParams()
  const score = Number(searchParams.get('score') ?? 0)
  const wave = Number(searchParams.get('wave') ?? 1)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [game, setGame] = useState<Game | null>(null)
  const { balance: fichas } = useFichas(playerId)
  const { ranking } = useRanking(game?.id ?? null)

  useEffect(() => {
    async function init() {
      const [player, { data: gameData }] = await Promise.all([
        getCurrentPlayer(),
        supabase.from('games').select('*').eq('slug', 'burger-invaders').single(),
      ])
      if (player) {
        setPlayerId(player.id)
        setNickname(player.nickname)
      }
      setGame(gameData as Game | null)
    }
    init()
  }, [])

  const myEntry = ranking.find((r) => r.player_id === playerId)
  const position = myEntry ? Number(myEntry.position) : null
  const hasDiscount = position !== null && game !== null && position <= game.top_n_discount

  const shareText = `Fiz ${score.toLocaleString('pt-BR')} pts no Burger Invaders! Estou em #${position ?? '?'} 👾 Jogue também: ${typeof window !== 'undefined' ? window.location.origin : ''}`

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  void nickname

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-8 gap-6">
      <h1 className="font-display text-primary text-5xl tracking-widest">GAME OVER</h1>

      <div className="w-full max-w-sm border-2 border-secondary rounded bg-black p-6 text-center">
        <p className="text-gray-400 text-xs tracking-widest uppercase mb-1">Pontuação final</p>
        <p className="font-display text-secondary text-6xl tracking-wider mb-2">
          {score.toLocaleString('pt-BR')}
        </p>
        <p className="text-gray-400 text-sm">Wave {wave}</p>

        {position && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="font-display text-white text-2xl tracking-wider">
              #{position} no ranking
            </p>
            {hasDiscount && (
              <p className="text-primary font-display text-lg tracking-wider mt-1">
                🎉 TOP {game!.top_n_discount} — DESCONTO DE {game!.discount_pct}%!
              </p>
            )}
          </div>
        )}

        {fichas > 0 && (
          <p className="mt-3 text-gray-400 text-xs">
            Você tem <span className="text-secondary font-semibold">{fichas} fichas</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={shareWhatsApp}
          className="w-full bg-green-700 hover:bg-green-600 font-display text-white text-xl tracking-widest py-3 rounded transition-colors"
        >
          COMPARTILHAR
        </button>

        <a
          href="https://90s.saipos.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-tertiary hover:bg-orange-500 font-display text-black text-xl tracking-widest py-3 rounded text-center block transition-colors"
        >
          PEDIR AGORA 🍔
        </a>

        <Link
          href="/games/burger-invaders"
          className="w-full border-2 border-secondary hover:bg-secondary/10 font-display text-secondary text-xl tracking-widest py-3 rounded text-center block transition-colors"
        >
          JOGAR DE NOVO
        </Link>
      </div>
    </div>
  )
}

export default function GameOverContentWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="font-display text-secondary text-3xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    }>
      <GameOverContent />
    </Suspense>
  )
}
