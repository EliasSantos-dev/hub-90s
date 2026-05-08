'use client'

import { useState } from 'react'
import type { AdminPlayer } from '@/types/admin'
import { grantFichasToPlayer } from '@/lib/admin/players'

interface PlayersTableProps {
  players: AdminPlayer[]
  onSearch: (term: string) => void
  onExportCsv: () => void
}

export function PlayersTable({ players, onSearch, onExportCsv }: PlayersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [grantPlayerId, setGrantPlayerId] = useState<string | null>(null)
  const [grantAmount, setGrantAmount] = useState(1)
  const [grantReason, setGrantReason] = useState('')
  const [grantFeedback, setGrantFeedback] = useState<string | null>(null)

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!grantPlayerId) return
    const result = await grantFichasToPlayer(grantPlayerId, grantAmount, grantReason)
    if (result.success) {
      setGrantFeedback('Fichas creditadas!')
      setGrantPlayerId(null)
      setGrantAmount(1)
      setGrantReason('')
    } else {
      setGrantFeedback(result.error ?? 'Erro.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); onSearch(e.target.value) }}
          placeholder="Buscar por nickname ou telefone..."
          className="flex-1 bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#b92526]" />
        <button onClick={onExportCsv}
          className="bg-[#ec9837] hover:bg-[#d4872f] text-black font-display font-bold px-4 py-2 rounded text-sm transition-colors tracking-widest">
          EXPORTAR CSV
        </button>
      </div>

      {grantFeedback && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm text-green-400 flex items-center justify-between">
          {grantFeedback}
          <button className="text-[#555] hover:text-white ml-3" onClick={() => setGrantFeedback(null)}>&#x2715;</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['NICKNAME', 'TELEFONE', 'MELHOR SCORE', 'DESCONTO', 'FICHAS', 'CADASTRO', 'AÇÕES'].map((col) => (
                <th key={col} className="text-left text-[#f0df5a] px-4 py-3 text-xs font-display tracking-widest">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-[#555] py-8 text-sm">Nenhum player encontrado.</td></tr>
            ) : players.map((player) => (
              <tr key={player.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                <td className="px-4 py-3 text-white font-bold">{player.nickname}</td>
                <td className="px-4 py-3 text-[#888]">{player.phone}</td>
                <td className="px-4 py-3 text-[#f0df5a]">{player.best_score?.toLocaleString('pt-BR') ?? '—'}</td>
                <td className="px-4 py-3">
                  {player.has_active_discount
                    ? <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">-10%</span>
                    : <span className="text-[#555]">—</span>}
                </td>
                <td className="px-4 py-3 text-[#ec9837]">{player.ficha_balance}</td>
                <td className="px-4 py-3 text-[#555] text-xs">{new Date(player.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setGrantPlayerId(player.id)}
                    className="text-[#888] hover:text-[#ec9837] text-xs font-bold transition-colors">+ FICHAS</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grantPlayerId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form onSubmit={handleGrant} className="bg-[#1a1a1a] border border-[#b92526] rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="font-display text-xl text-[#f0df5a] tracking-widest">GRANT DE FICHAS</h3>
            <div>
              <label className="block text-[#888] text-xs mb-1">QUANTIDADE</label>
              <input type="number" min={1} value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]" />
            </div>
            <div>
              <label className="block text-[#888] text-xs mb-1">MOTIVO</label>
              <input type="text" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required
                placeholder="ex: promoção especial"
                className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526]" />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-[#b92526] hover:bg-[#d42828] text-white font-display font-bold py-2 rounded tracking-widest">CONFIRMAR</button>
              <button type="button" onClick={() => setGrantPlayerId(null)} className="flex-1 bg-[#333] hover:bg-[#444] text-white font-bold py-2 rounded">CANCELAR</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
