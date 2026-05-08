'use client'

import type { WebhookLog } from '@/types/admin'

interface SaiposLogProps {
  logs: WebhookLog[]
}

export function SaiposLog({ logs }: SaiposLogProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#222]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1a1a1a] border-b border-[#222]">
            {['DATA/HORA', 'EVENTO', 'LOJA', 'PEDIDO ID', 'PAYLOAD'].map((col) => (
              <th key={col} className="text-left text-[#f0df5a] px-4 py-3 text-xs font-display tracking-widest">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr><td colSpan={5} className="text-center text-[#555] py-8 text-sm">Nenhum webhook recebido ainda.</td></tr>
          ) : logs.map((log) => (
            <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
              <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">
                {new Date(log.received_at).toLocaleString('pt-BR')}
              </td>
              <td className="px-4 py-3">
                <span className="bg-green-800 text-green-300 text-xs px-2 py-0.5 rounded font-mono">{log.event}</span>
              </td>
              <td className="px-4 py-3 text-[#888] font-mono text-xs">{log.cod_store}</td>
              <td className="px-4 py-3 text-white font-mono text-xs">{log.order_id}</td>
              <td className="px-4 py-3 text-[#555] text-xs max-w-xs truncate font-mono">
                {JSON.stringify(log.raw_payload).substring(0, 80)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
