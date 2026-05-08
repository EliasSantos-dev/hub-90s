type Props = {
  pct: number
  className?: string
}

export default function DiscountBadge({ pct, className = '' }: Props) {
  return (
    <span
      className={`inline-block bg-primary text-secondary font-display text-sm px-2 py-0.5 rounded tracking-wider ${className}`}
    >
      -{pct}%
    </span>
  )
}
