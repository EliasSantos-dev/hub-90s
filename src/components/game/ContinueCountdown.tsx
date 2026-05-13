'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  seconds: number
  onContinue: () => void
  onExpire: () => void
}

export default function ContinueCountdown({ seconds, onContinue, onExpire }: Props) {
  const [remaining, setRemaining] = useState(seconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (remaining <= 0) { onExpireRef.current(); return }
    const t = setTimeout(() => setRemaining(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const pct = (remaining / seconds) * 100

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-secondary transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        onClick={onContinue}
        className="font-display text-black bg-secondary text-xl tracking-widest px-8 py-3 rounded w-full active:scale-95 transition-transform"
      >
        CONTINUAR ({remaining}s)
      </button>
    </div>
  )
}
