import type { Metadata } from 'next'
import GameOverContentWrapper from './GameOverContent'

type Props = {
  searchParams: { score?: string; wave?: string; player?: string; position?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const score = Number(searchParams.score ?? 0)
  const wave  = Number(searchParams.wave ?? 1)
  const ogUrl = `/api/og?score=${score}&wave=${wave}${searchParams.player ? `&player=${encodeURIComponent(searchParams.player)}` : ''}${searchParams.position ? `&position=${searchParams.position}` : ''}`

  const title = `Fiz ${score.toLocaleString('pt-BR')} pts no Burger Invaders! 👾`

  return {
    title,
    openGraph: {
      title,
      description: 'Jogue Burger Invaders e ganhe desconto no delivery da 90s Burgers!',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [ogUrl],
    },
  }
}

export default function GameOverPage() {
  return <GameOverContentWrapper />
}
