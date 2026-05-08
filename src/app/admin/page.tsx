import { KpiCard } from '@/components/admin/KpiCard'
import { getAdminKpis, getDashboardRanking, getRecentWebhookLogs } from '@/lib/admin/dashboard'
import { listFichaRules } from '@/lib/admin/fichas-admin'

export default async function AdminDashboardPage() {
  const [kpis, ranking, recentLogs, fichaRules] = await Promise.all([
    getAdminKpis(),
    getDashboardRanking(),
    getRecentWebhookLogs(4),
    listFichaRules(),
  ])

  const activeRule = fichaRules.find((r) => r.active && r.min_value === 0)
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">DASHBOARD</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Players" value={kpis.total_players} accent="yellow" />
        <KpiCard label="Fichas Distribuídas" value={kpis.total_fichas_distributed} accent="orange" />
        <KpiCard label="Descontos Ativos" value={kpis.active_discounts} accent="red" />
        <KpiCard label="Webhooks Recebidos" value={kpis.total_webhook_orders} accent="yellow" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">RANKING ATUAL — TOP 3</h2>
          {ranking.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhum score registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((row) => (
                <div key={`${row.game_id}-${row.player_id}`}
                  className="flex items-center justify-between bg-[#0f0f0f] rounded px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{MEDALS[row.position - 1] ?? `#${row.position}`}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{row.nickname}</p>
                      <p className="text-[#555] text-xs">{row.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#f0df5a] font-bold">{row.score.toLocaleString('pt-BR')}</p>
                    <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">-10%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">SAIPOS</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-[#888] text-sm">Webhook configurado</span>
            </div>
            <div className="bg-[#0f0f0f] rounded px-3 py-2">
              <p className="text-[#555] text-xs mb-1">Regra atual</p>
              <p className="text-white text-sm">
                {activeRule ? `Qualquer pedido → ${activeRule.fichas_amount} fichas` : 'Nenhuma regra configurada'}
              </p>
            </div>
            <div>
              <p className="text-[#555] text-xs mb-2">Últimos webhooks</p>
              {recentLogs.length === 0 ? (
                <p className="text-[#444] text-xs">Nenhum webhook recebido ainda.</p>
              ) : (
                <div className="space-y-1">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs bg-[#0f0f0f] rounded px-3 py-2">
                      <span className="text-[#888]">{new Date(log.received_at).toLocaleString('pt-BR')}</span>
                      <span className="text-white">{log.order_id}</span>
                      <span className="text-green-400">{log.event}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
