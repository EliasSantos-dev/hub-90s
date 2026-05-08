type Props = {
  score: number
  wave: number
  hiScore: number
}

export default function StatsBar({ score, wave, hiScore }: Props) {
  return (
    <div className="flex items-center justify-between px-5 h-11 bg-[#111111] w-full flex-shrink-0">
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Score</span>
        <span className="font-display text-secondary text-xl tracking-wider">
          {score.toString().padStart(6, '0')}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Wave</span>
        <span className="font-display text-tertiary text-xl tracking-wider">{wave}</span>
      </div>
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-gray-500 text-xs tracking-widest uppercase">Hi-Score</span>
        <span className="font-display text-primary text-xl tracking-wider">
          {hiScore.toString().padStart(6, '0')}
        </span>
      </div>
    </div>
  )
}
