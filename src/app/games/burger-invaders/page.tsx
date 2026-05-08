'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentPlayer } from '@/lib/auth'
import { supabase, type Player, type Game } from '@/lib/supabase'
import BurgerInvaders from '@/components/game/BurgerInvaders'
import AuthModal from '@/components/hub/AuthModal'

export default function BurgerInvadersPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function init() {
      try {
        const [currentPlayer, { data: gameData }] = await Promise.all([
          getCurrentPlayer(),
          supabase.from('games').select('*').eq('slug', 'burger-invaders').single(),
        ])
        setPlayer(currentPlayer)
        setGame(gameData as Game | null)
        if (!currentPlayer) setShowAuth(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="font-display text-secondary text-3xl tracking-widest animate-pulse">
          CARREGANDO...
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {player && game ? (
        <BurgerInvaders
          playerId={player.id}
          gameId={game.id}
          season={game.season}
        />
      ) : (
        !showAuth && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <p className="text-gray-400">Jogo não disponível</p>
            <button
              onClick={() => router.push('/')}
              className="font-display text-secondary border border-secondary px-6 py-2 rounded"
            >
              VOLTAR
            </button>
          </div>
        )
      )}

      {showAuth && (
        <AuthModal
          onSuccess={(p) => {
            setPlayer(p)
            setShowAuth(false)
          }}
          onClose={() => router.push('/')}
        />
      )}
    </div>
  )
}
