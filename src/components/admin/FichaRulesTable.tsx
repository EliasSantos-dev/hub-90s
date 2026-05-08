'use client'

import { useState } from 'react'
import type { FichaRule } from '@/types/admin'
import { addFichaRule, removeFichaRule } from '@/lib/admin/fichas-admin'

interface FichaRulesTableProps {
  initialRules: FichaRule[]
}

export function FichaRulesTable({ initialRules }: FichaRulesTableProps) {
  const [rules, setRules] = useState<FichaRule[]>(initialRules)
  const [newMinValue, setNewMinValue] = useState(0)
  const [newFichasAmount, setNewFichasAmount] = useState(1)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')

  function showFeedback(msg: string, type: 'success' | 'error' = 'success') {
    setFeedback(msg)
    setFeedbackType(type)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const result = await addFichaRule(newMinValue, newFichasAmount)
    if (result.success) {
      showFeedback('Regra adicionada!')
      setNewMinValue(0)
      setNewFichasAmount(1)
      // Refresh rules by re-fetching — for simplicity, trigger parent reload via a hack-free approach
      // The parent page handles re-fetch on demand; here we optimistically update
      const tempRule: FichaRule = {
        id: `temp-${Date.now()}`,
        cod_store: '*',
        min_value: newMinValue,
        fichas_amount: newFichasAmount,
        active: true,
        created_at: new Date().toISOString(),
      }
      setRules((prev) => [...prev, tempRule].sort((a, b) => a.min_value - b.min_value))
    } else {
      showFeedback(result.error ?? 'Erro ao adicionar regra.', 'error')
    }
  }

  async function handleRemove(rule_id: string) {
    const result = await removeFichaRule(rule_id)
    if (result.success) {
      setRules((prev) => prev.filter((r) => r.id !== rule_id))
      showFeedback('Regra removida.')
    } else {
      showFeedback(result.error ?? 'Erro ao remover regra.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`bg-[#1a1a1a] border border-[#333] rounded px-4 py-2 text-sm flex items-center justify-between ${feedbackType === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {feedback}
          <button className="text-[#555] hover:text-white ml-3" onClick={() => setFeedback(null)}>&#x2715;</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#222]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a1a1a] border-b border-[#222]">
              {['VALOR MÍNIMO DO PEDIDO', 'FICHAS', 'STATUS', 'AÇÕES'].map((col) => (
                <th key={col} className="text-left text-[#f0df5a] px-4 py-3 text-xs font-display tracking-widest">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-[#555] py-8 text-sm">Nenhuma regra configurada.</td></tr>
            ) : rules.map((rule) => (
              <tr key={rule.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                <td className="px-4 py-3 text-white">
                  {rule.min_value === 0
                    ? <span className="text-[#888]">Qualquer valor</span>
                    : <span>R$ {rule.min_value.toFixed(2).replace('.', ',')}+</span>}
                </td>
                <td className="px-4 py-3 text-[#ec9837] font-bold">{rule.fichas_amount} ficha{rule.fichas_amount !== 1 ? 's' : ''}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${rule.active ? 'bg-green-700 text-white' : 'bg-[#333] text-[#888]'}`}>
                    {rule.active ? 'ATIVA' : 'INATIVA'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleRemove(rule.id)}
                    className="text-[#888] hover:text-[#b92526] text-xs font-bold transition-colors">REMOVER</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
        <h3 className="font-display text-sm text-[#f0df5a] tracking-widest mb-4">ADICIONAR REGRA</h3>
        <form onSubmit={handleAdd} className="flex items-end gap-4">
          <div>
            <label className="block text-[#888] text-xs mb-1">VALOR MÍNIMO (R$)</label>
            <input type="number" min={0} step={0.01} value={newMinValue}
              onChange={(e) => setNewMinValue(Number(e.target.value))}
              className="bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 w-36 focus:outline-none focus:border-[#b92526] text-sm" />
          </div>
          <div>
            <label className="block text-[#888] text-xs mb-1">FICHAS</label>
            <input type="number" min={1} value={newFichasAmount}
              onChange={(e) => setNewFichasAmount(Number(e.target.value))}
              className="bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 w-24 focus:outline-none focus:border-[#b92526] text-sm" />
          </div>
          <button type="submit"
            className="bg-[#b92526] hover:bg-[#d42828] text-white font-display font-bold px-4 py-2 rounded tracking-widest text-sm transition-colors">
            + ADICIONAR
          </button>
        </form>
      </div>
    </div>
  )
}
