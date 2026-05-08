'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const NAV_ITEMS = [
  { href: '/admin', label: 'DASHBOARD' },
  { href: '/admin/players', label: 'PLAYERS' },
  { href: '/admin/games', label: 'GAMES' },
  { href: '/admin/fichas', label: 'FICHAS' },
  { href: '/admin/saipos', label: 'SAIPOS' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-[#0a0a0a] border-r border-[#222] flex flex-col">
      <div className="p-4 border-b border-[#222]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://redirect90s.vercel.app/assets/logo1.png" alt="90s Burgers" className="h-10" />
        <p className="font-display text-secondary text-xs mt-1 tracking-widest">ADMIN PANEL</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex items-center px-4 py-3 font-display text-sm tracking-widest transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'
              }`}>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-[#222]">
        <button onClick={handleLogout}
          className="w-full text-left font-display text-[#888] hover:text-primary text-sm tracking-widest transition-colors">
          ⬛ SAIR
        </button>
      </div>
    </aside>
  )
}
