import Link from 'next/link'
import { KpiCard } from '@/components/admin/KpiCard'
import { getAdminKpis, getDashboardRanking } from '@/lib/admin/dashboard'
import { listFichaRules } from '@/lib/admin/fichas-admin'

export default async function AdminDashboardPage() {
  const [kpis, ranking, fichaRules] = await Promise.all([
    getAdminKpis(),
    getDashboardRanking(),
    listFichaRules(),
  ])

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">DASHBOARD</h1>
        <Link
          href="/admin/games"
          className="bg-[#b92526] hover:bg-red-700 text-white font-display text-sm tracking-widest px-4 py-2 rounded transition-colors"
        >
          NOVA TEMPORADA
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Jogadores" value={kpis.total_players} accent="yellow" />
        <KpiCard label="Fichas" value={kpis.total_fichas_distributed} accent="orange" />
        <KpiCard label="Descontos" value={kpis.active_discounts} accent="red" />
        <KpiCard label="Webhooks" value={kpis.total_webhook_orders} accent="yellow" />
      </div>

      {/* Two-panel row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: ranking */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">TOP RANKING</h2>
          {ranking.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhum score registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((row) => (
                <div
                  key={`${row.game_id}-${row.player_id}`}
                  className="flex items-center justify-between bg-[#0f0f0f] rounded px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-gray-400 w-6 text-sm">#{row.position}</span>
                    <div>
                      <p className="text-white font-bold text-sm">{row.nickname}</p>
                      <p className="text-[#555] text-xs">{row.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#f0df5a] font-bold">{row.score.toLocaleString('pt-BR')}</p>
                    <span className="bg-[#b92526] text-white text-xs px-2 py-0.5 rounded font-bold">
                      -10%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: fichas rules */}
        <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5">
          <h2 className="font-display text-xl text-[#f0df5a] mb-4 tracking-widest">FICHAS</h2>
          {fichaRules.length === 0 ? (
            <p className="text-[#555] text-sm">Nenhuma regra configurada.</p>
          ) : (
            <div className="space-y-2">
              {fichaRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-[#0f0f0f] rounded px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm">
                      {rule.min_value === 0
                        ? 'Qualquer pedido'
                        : `Pedido acima de R$ ${rule.min_value}`}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5">
                      {rule.fichas_amount} {rule.fichas_amount === 1 ? 'FICHA' : 'FICHAS'}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-display px-2 py-0.5 rounded ${
                      rule.active
                        ? 'bg-green-900 text-green-400'
                        : 'bg-[#222] text-[#555]'
                    }`}
                  >
                    {rule.active ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/fichas"
            className="mt-4 block text-center font-display text-xs text-gray-500 hover:text-secondary tracking-wider transition-colors"
          >
            GERENCIAR FICHAS →
          </Link>
        </div>
      </div>
    </div>
  )
}
