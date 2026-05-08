'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlayersTable } from '@/components/admin/PlayersTable'
import { listPlayers, buildCsvFromPlayers } from '@/lib/admin/players'
import type { AdminPlayer } from '@/types/admin'

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlayers = useCallback(async (term?: string) => {
    setLoading(true)
    const data = await listPlayers(term)
    setPlayers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  function handleExportCsv() {
    const csv = buildCsvFromPlayers(players)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `players-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">PLAYERS / LEADS</h1>
        <span className="text-[#555] text-sm">{loading ? 'Carregando...' : `${players.length} players`}</span>
      </div>
      {loading ? (
        <div className="text-[#555] text-sm py-8 text-center">Carregando players...</div>
      ) : (
        <PlayersTable players={players} onSearch={(term) => fetchPlayers(term)} onExportCsv={handleExportCsv} />
      )}
    </div>
  )
}
