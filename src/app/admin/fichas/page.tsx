'use client'

import { useState, useEffect, useCallback } from 'react'
import { FichaRulesTable } from '@/components/admin/FichaRulesTable'
import { FichasHistoryTable } from '@/components/admin/FichasHistoryTable'
import { listFichaRules, listFichaHistory, grantFichasAdmin } from '@/lib/admin/fichas-admin'
import { listPlayers } from '@/lib/admin/players'
import type { FichaRule, FichaTransaction, AdminPlayer } from '@/types/admin'

export default function AdminFichasPage() {
  const [rules, setRules] = useState<FichaRule[]>([])
  const [transactions, setTransactions] = useState<FichaTransaction[]>([])
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [loading, setLoading] = useState(true)

  const [grantPlayerId, setGrantPlayerId] = useState('')
  const [grantAmount, setGrantAmount] = useState(1)
  const [grantReason, setGrantReason] = useState('')
  const [grantFeedback, setGrantFeedback] = useState<string | null>(null)
  const [grantFeedbackType, setGrantFeedbackType] = useState<'success' | 'error'>('success')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [rulesData, txData, playersData] = await Promise.all([
      listFichaRules(),
      listFichaHistory(),
      listPlayers(),
    ])
    setRules(rulesData)
    setTransactions(txData)
    setPlayers(playersData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    const result = await grantFichasAdmin(grantPlayerId, grantAmount, grantReason)
    if (result.success) {
      setGrantFeedback('Fichas creditadas com sucesso!')
      setGrantFeedbackType('success')
      setGrantPlayerId('')
      setGrantAmount(1)
      setGrantReason('')
      // Refresh history
      const txData = await listFichaHistory()
      setTransactions(txData)
    } else {
      setGrantFeedback(result.error ?? 'Erro ao creditar fichas.')
      setGrantFeedbackType('error')
    }
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">FICHAS</h1>

      {loading ? (
        <div className="text-[#555] text-sm py-8 text-center">Carregando...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-xl text-[#f0df5a] tracking-widest">REGRAS DE FICHAS</h2>
            <FichaRulesTable initialRules={rules} />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-[#f0df5a] tracking-widest">GRANT MANUAL</h2>
            <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
              {grantFeedback && (
                <div className={`mb-4 rounded px-4 py-2 text-sm flex items-center justify-between border border-[#333] ${grantFeedbackType === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {grantFeedback}
                  <button className="text-[#555] hover:text-white ml-3" onClick={() => setGrantFeedback(null)}>&#x2715;</button>
                </div>
              )}
              <form onSubmit={handleGrant} className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1">
                  <label className="block text-[#888] text-xs mb-1">PLAYER</label>
                  <select value={grantPlayerId} onChange={(e) => setGrantPlayerId(e.target.value)} required
                    className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526] text-sm">
                    <option value="">Selecione um player...</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.nickname} ({p.phone})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#888] text-xs mb-1">QUANTIDADE</label>
                  <input type="number" min={1} value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))}
                    className="bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 w-24 focus:outline-none focus:border-[#b92526] text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-[#888] text-xs mb-1">MOTIVO</label>
                  <input type="text" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required
                    placeholder="ex: promoção especial"
                    className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-[#b92526] text-sm" />
                </div>
                <button type="submit"
                  className="bg-[#b92526] hover:bg-[#d42828] text-white font-display font-bold px-4 py-2 rounded tracking-widest text-sm transition-colors whitespace-nowrap">
                  GRANT FICHAS
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-[#f0df5a] tracking-widest">HISTÓRICO</h2>
            <FichasHistoryTable transactions={transactions} />
          </section>
        </>
      )}
    </div>
  )
}
