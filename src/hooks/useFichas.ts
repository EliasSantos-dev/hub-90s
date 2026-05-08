'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFichaBalance } from '@/lib/fichas'

export function useFichas(playerId: string | null) {
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    if (!playerId) {
      setBalance(0)
      return
    }

    getFichaBalance(playerId).then(setBalance)

    const channel = supabase
      .channel(`fichas:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fichas',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          getFichaBalance(playerId).then(setBalance)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId])

  return balance
}
