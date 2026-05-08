'use client'

import { useState } from 'react'
import type { AdminGame } from '@/types/admin'
import { toggleGameActive, updateGameConfig, startNewSeason } from '@/lib/admin/games'

export function GamesTable({ initialGames }: { initialGames: AdminGame[] }) {
  const [games, setGames] = useState<AdminGame[]>(initialGames)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTopN, setEditTopN] = useState(3)
  const [editDiscountPct, setEditDiscountPct] = useState(10)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleToggle(game: AdminGame) {
    const result = await toggleGameActive(game.id, !game.active)
    if (result.success) setGames((prev) => prev.map((g) => g.id === game.id ? { ...g, active: !g.active } : g))
    else setFeedback(result.error ?? 'Erro.')
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const result = await updateGameConfig(editingId, editTopN, editDiscountPct)
    if (result.success) {
      setGames((prev) => prev.map((g) => g.id === editingId ? { ...g, top_n_discount: editTopN, discount_pct: editDiscountPct } : g))
      setFeedback('Salvo!')
      setEditingId(null)
    } else setFeedback(result.error ?? 'Erro.')
  }

  async function handleNewSeason(game: AdminGame) {
    if (!confirm(`Iniciar nova temporada para "${game.name}"? O ranking atual será invalidado.`)) return
    const result = await startNewSeason(game.id)
    if (result.success) {
      setGames((prev) => prev.map((g) => g.id === game.id ? { ...g, season: result.new_season ?? g.season + 1 } : g))
      setFeedback(`Temporada ${result.new_season} iniciada!`)
    } else setFeedback(result.error ?? 'Erro.')
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm text-green-400 flex items-center justify-between">
          {feedback}<button className="text-[#555] hover:text-white ml-3" onClick={() => setFeedback(null)}>&#x2715;</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['GAME', 'STATUS', 'TOP N', 'DESCONTO', 'TEMPORADA', 'AÇÕES'].map((col) => (
                <th key={col} className="text-left text-[#f0df5a] px-4 py-3 text-xs font-display tracking-widest">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-3 text-white font-bold">{game.name}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(game)}
                    className={`px-3 py-1 rounded text-xs font-bold ${game.active ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-[#333] hover:bg-[#444] text-[#888]'}`}>
                    {game.active ? 'ATIVO' : 'INATIVO'}
                  </button>
                </td>
                <td className="px-4 py-3 text-[#888]">Top {game.top_n_discount}</td>
                <td className="px-4 py-3 text-[#ec9837]">{game.discount_pct}%</td>
                <td className="px-4 py-3 text-[#555]">S{game.season}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => { setEditingId(game.id); setEditTopN(game.top_n_discount); setEditDiscountPct(game.discount_pct) }}
                      className="text-[#888] hover:text-[#f0df5a] text-xs font-bold">EDITAR</button>
                    <button onClick={() => handleNewSeason(game)} className="text-[#888] hover:text-[#b92526] text-xs font-bold">NOVA TEMPORADA</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form onSubmit={handleSaveConfig} className="bg-[#1a1a1a] border border-[#b92526] rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="font-display text-xl text-[#f0df5a] tracking-widest">CONFIGURAR GAME</h3>
            <div>
              <label className="block text-[#888] text-xs mb-1">TOP N</label>
              <input type="number" min={1} value={editTopN} onChange={(e) => setEditTopN(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]" />
            </div>
            <div>
              <label className="block text-[#888] text-xs mb-1">DESCONTO % (1-100)</label>
              <input type="number" min={1} max={100} value={editDiscountPct} onChange={(e) => setEditDiscountPct(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]" />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-[#b92526] hover:bg-[#d42828] text-white font-display font-bold py-2 rounded tracking-widest">SALVAR</button>
              <button type="button" onClick={() => setEditingId(null)} className="flex-1 bg-[#333] hover:bg-[#444] text-white font-bold py-2 rounded">CANCELAR</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
