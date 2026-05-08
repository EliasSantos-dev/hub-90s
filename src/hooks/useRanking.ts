'use client'

import { useEffect, useState } from 'react'
import { supabase, RankingRow } from '@/lib/supabase'

export type RankingEntry = RankingRow & {
  players: { nickname: string }
}

export function useRanking(gameId: string | null) {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)

    supabase
      .from('ranking')
      .select('game_id, player_id, score, position, players(nickname)')
      .eq('game_id', gameId)
      .order('position', { ascending: true })
      .limit(10)
      .then(({ data }) => {
        setRanking((data as RankingEntry[]) ?? [])
        setLoading(false)
      })
  }, [gameId])

  return { ranking, loading }
}
