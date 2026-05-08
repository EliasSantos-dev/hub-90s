'use client'

import type { FichaTransaction } from '@/types/admin'

const REASON_LABELS: Record<string, string> = {
  saipos_order: 'Pedido Saipos',
  admin_grant: 'Grant manual',
  game_reward: 'Recompensa de jogo',
  promotion: 'Promoção',
}

function translateReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}

interface FichasHistoryTableProps {
  transactions: FichaTransaction[]
}

export function FichasHistoryTable({ transactions }: FichasHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#222]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1a1a1a] border-b border-[#222]">
            {['DATA', 'PLAYER', 'FICHAS', 'MOTIVO', 'REF ID'].map((col) => (
              <th key={col} className="text-left text-[#f0df5a] px-4 py-3 text-xs font-display tracking-widest">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr><td colSpan={5} className="text-center text-[#555] py-8 text-sm">Nenhuma transação encontrada.</td></tr>
          ) : transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
              <td className="px-4 py-3 text-[#555] text-xs">
                {new Date(tx.created_at).toLocaleString('pt-BR')}
              </td>
              <td className="px-4 py-3 text-white font-bold">{tx.player_nickname}</td>
              <td className={`px-4 py-3 font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount}
              </td>
              <td className="px-4 py-3 text-[#888]">{translateReason(tx.reason)}</td>
              <td className="px-4 py-3 text-[#555] text-xs font-mono">{tx.ref_id ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
