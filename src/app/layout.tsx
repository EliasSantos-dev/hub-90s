import type { Metadata } from 'next'
import { Bangers, Inter } from 'next/font/google'
import './globals.css'

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '90s Burgers Game Hub',
  description: 'Jogue, suba no ranking e ganhe descontos!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${bangers.variable} ${inter.variable} bg-bg text-white font-body min-h-screen`}
      >
        {children}
      </body>
    </html>
  )
}
