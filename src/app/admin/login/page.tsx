'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    if (data.user.user_metadata?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Acesso negado. Usuário não é admin.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://redirect90s.vercel.app/assets/logo1.png" alt="90s Burgers" className="h-16 mx-auto mb-4" />
          <h1 className="font-display text-4xl text-secondary tracking-widest">ADMIN PANEL</h1>
        </div>
        <form onSubmit={handleLogin} className="bg-[#1a1a1a] border border-primary rounded-lg p-8 space-y-4">
          <div>
            <label className="block text-secondary text-xs font-bold mb-1 tracking-widest uppercase">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-primary"
              placeholder="admin@90sburgers.com" />
          </div>
          <div>
            <label className="block text-secondary text-xs font-bold mb-1 tracking-widest uppercase">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-[#0f0f0f] border border-[#333] text-white rounded px-3 py-2 focus:outline-none focus:border-primary"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-primary hover:bg-red-700 disabled:opacity-50 text-white font-display text-xl tracking-widest py-3 rounded transition-colors">
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  )
}
