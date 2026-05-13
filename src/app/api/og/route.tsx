// src/app/api/og/route.tsx
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const score    = Number(searchParams.get('score') ?? 0)
  const wave     = Number(searchParams.get('wave') ?? 1)
  const player   = searchParams.get('player') ?? ''
  const position = searchParams.get('position') ?? ''

  let bangersFont: ArrayBuffer | null = null
  try {
    bangersFont = await fetch(
      'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28wYQ.woff2'
    ).then(r => r.arrayBuffer())
  } catch {
    // fallback sem fonte customizada
  }

  const fonts = bangersFont
    ? [{ name: 'Bangers', data: bangersFont, weight: 400 as const }]
    : []

  const response = new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: bangersFont ? 'Bangers' : 'serif',
          gap: 16,
          padding: 40,
        }}
      >
        <div style={{ color: '#b92526', fontSize: 24, letterSpacing: 8, display: 'flex' }}>
          90&apos;S BURGERS N&apos;FRIES
        </div>
        <div style={{ color: '#f0df5a', fontSize: 68, letterSpacing: 10, display: 'flex' }}>
          BURGER INVADERS
        </div>
        <div style={{ color: '#ffffff', fontSize: 56, letterSpacing: 4, display: 'flex' }}>
          {score.toLocaleString('pt-BR')} PTS
        </div>
        <div style={{ color: '#ec9837', fontSize: 28, letterSpacing: 6, display: 'flex' }}>
          WAVE {wave}{position ? ` • #${position} NO RANKING` : ''}
        </div>
        {player ? (
          <div style={{ color: '#666666', fontSize: 22, letterSpacing: 4, display: 'flex' }}>
            {player}
          </div>
        ) : null}
        <div style={{ color: '#444444', fontSize: 18, marginTop: 8, letterSpacing: 3, display: 'flex' }}>
          Jogue e ganhe desconto no delivery
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    }
  )

  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400')
  return response
}
