'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FichasResult = { balance: number; invalidate: () => void }

export function useFichas(playerId: string | null): FichasResult {
  const [balance, setBalance] = useState(0)

  const fetchAndCache = useCallback(async (pid: string) => {
    const { data } = await supabase.rpc('recharge_fichas', { p_player_id: pid })
    const b = (data as number) ?? 0
    setBalance(b)
    sessionStorage.setItem(`fichas_${pid}`, String(b))
  }, [])

  const invalidate = useCallback(() => {
    if (!playerId) return
    sessionStorage.removeItem(`fichas_${playerId}`)
    fetchAndCache(playerId)
  }, [playerId, fetchAndCache])

  useEffect(() => {
    if (!playerId) { setBalance(0); return }

    const cached = sessionStorage.getItem(`fichas_${playerId}`)
    if (cached) {
      setBalance(Number(cached))
    } else {
      fetchAndCache(playerId)
    }

    const channel = supabase
      .channel(`fichas:${playerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fichas', filter: `player_id=eq.${playerId}` },
        () => {
          sessionStorage.removeItem(`fichas_${playerId}`)
          fetchAndCache(playerId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [playerId, fetchAndCache])

  return { balance, invalidate }
}
