'use client'

const STEPS = {
  1: {
    label: 'PASSO 1 DE 3',
    title: 'SEGURE PARA MOVER',
    sub: 'Use os botões ◄ e ► abaixo',
  },
  2: {
    label: 'PASSO 2 DE 3',
    title: 'TOQUE PARA ATIRAR',
    sub: 'Pressione FIRE para lançar batatas',
  },
  3: {
    label: 'PASSO 3 DE 3',
    title: 'DESTRUA OS INIMIGOS!',
    sub: 'Acerte todos para subir no ranking',
  },
} as const

type Props = {
  step: 1 | 2 | 3
  onSkip: () => void
}

export default function TutorialOverlay({ step, onSkip }: Props) {
  const info = STEPS[step]

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/70 pb-6 px-5">
      {/* Setas para passo 1 — apontam para ◄ e ► */}
      {step === 1 && (
        <div className="absolute bottom-6 w-full flex justify-between px-[46px] pointer-events-none">
          <Arrow color="#FFD700" />
          <Arrow color="#FFD700" />
        </div>
      )}

      {/* Seta central para passo 2 — aponta para FIRE */}
      {step === 2 && (
        <div className="absolute bottom-6 flex justify-center w-full pointer-events-none">
          <Arrow color="#b92526" />
        </div>
      )}

      {/* Card de instrução */}
      <div className="w-full border-2 border-primary rounded-xl bg-[#1a0505] px-4 py-3 flex flex-col gap-2.5">
        {/* Dots de progresso */}
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((d) => (
            <div
              key={d}
              className={`h-2 rounded-full transition-all ${d === step ? 'w-8 bg-primary' : 'w-8 bg-gray-700'}`}
            />
          ))}
        </div>

        {/* Label do passo */}
        <div className="bg-primary rounded px-2 py-0.5 self-start">
          <span className="font-display text-white text-xs tracking-wider">{info.label}</span>
        </div>

        {/* Instrução principal */}
        <span className="font-display text-white text-xl tracking-widest leading-tight">
          {info.title}
        </span>

        {/* Sub + botão pular */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">{info.sub}</span>
          <button
            onClick={onSkip}
            className="text-gray-600 text-xs font-display tracking-wider hover:text-gray-400 transition-colors"
          >
            PULAR
          </button>
        </div>
      </div>
    </div>
  )
}

function Arrow({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-6 h-8 rounded-sm" style={{ backgroundColor: color, opacity: 0.9 }} />
      <div
        className="w-0 h-0"
        style={{
          borderLeft: '14px solid transparent',
          borderRight: '14px solid transparent',
          borderTop: `14px solid ${color}`,
          opacity: 0.9,
        }}
      />
    </div>
  )
}
