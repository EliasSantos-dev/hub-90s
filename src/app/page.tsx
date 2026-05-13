'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import { useFichas } from '@/hooks/useFichas'
import { useRanking } from '@/hooks/useRanking'
import TopBar from '@/components/hub/TopBar'
import GameGrid from '@/components/hub/GameGrid'
import RankingPreview from '@/components/hub/RankingPreview'
import AuthModal from '@/components/hub/AuthModal'

export default function HomePage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { balance: fichasBalance } = useFichas(player?.id ?? null)
  const burgerInvadersGame = games.find((g) => g.slug === 'burger-invaders') ?? null
  const { ranking } = useRanking(burgerInvadersGame?.id ?? null)

  useEffect(() => {
    getCurrentPlayer().then(setPlayer)
    supabase
      .from('games')
      .select('*')
      .eq('active', true)
      .then(({ data }) => setGames((data as Game[]) ?? []))
  }, [])

  function handleInsertFicha() {
    if (!player) setShowAuthModal(true)
  }

  function handleAuthSuccess(p: Player) {
    setPlayer(p)
    setShowAuthModal(false)
  }

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <TopBar fichasBalance={fichasBalance} onInsertFicha={handleInsertFicha} />

      <section className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <span className="bg-primary text-white font-display text-xs tracking-widest px-3 py-1 rounded mb-3 inline-block">
          ARCADE HUB
        </span>
        <h1 className="font-display text-secondary text-5xl sm:text-6xl tracking-widest leading-none mb-2">
          JOGAR E GANHAR
        </h1>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Jogue, suba no ranking e ganhe desconto no delivery enquanto estiver no top 3
        </p>
        <button
          onClick={handleInsertFicha}
          className="bg-primary hover:bg-red-700 active:scale-95 transition-all font-display text-white text-2xl tracking-widest px-8 py-3 rounded shadow-[0_0_20px_#b92526] flex items-center gap-2"
        >
          <span>►</span> INSERIR FICHA
        </button>
        {player && (
          <p className="text-gray-500 text-xs mt-3">
            Bem-vindo, <span className="text-secondary">{player.nickname}</span>!
          </p>
        )}
      </section>

      <div className="flex items-center justify-between px-4 max-w-lg mx-auto w-full mb-1">
        <h2 className="font-display text-tertiary text-xl tracking-widest">SEUS JOGOS</h2>
        <Link href="/ranking" className="font-display text-xs text-gray-400 hover:text-secondary tracking-wider transition-colors">
          VER TUDO →
        </Link>
      </div>
      <GameGrid games={games} />

      <RankingPreview
        entries={ranking}
        discountPct={burgerInvadersGame?.discount_pct ?? 10}
        topN={burgerInvadersGame?.top_n_discount ?? 3}
      />

      {showAuthModal && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </main>
  )
}
