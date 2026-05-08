interface KpiCardProps {
  label: string
  value: string | number
  description?: string
  accent?: 'red' | 'yellow' | 'orange'
}

const ACCENT_COLORS = {
  red: 'border-l-[#b92526] text-[#b92526]',
  yellow: 'border-l-[#f0df5a] text-[#f0df5a]',
  orange: 'border-l-[#ec9837] text-[#ec9837]',
}

export function KpiCard({ label, value, description, accent = 'yellow' }: KpiCardProps) {
  return (
    <div className={`bg-[#1a1a1a] border border-[#222] border-l-4 ${ACCENT_COLORS[accent]} rounded-lg p-5`}>
      <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="font-display text-4xl font-bold">{value}</p>
      {description && <p className="text-[#555] text-xs mt-1">{description}</p>}
    </div>
  )
}
