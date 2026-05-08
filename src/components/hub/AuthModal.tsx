'use client'

import { useState } from 'react'
import { signInAnonymouslyAndRegister } from '@/lib/auth'
import type { Player } from '@/lib/supabase'

type Props = {
  onSuccess: (player: Player) => void
  onClose: () => void
}

export default function AuthModal({ onSuccess, onClose }: Props) {
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || !phone.trim()) {
      setError('Preencha nickname e telefone')
      return
    }
    setLoading(true)
    setError(null)
    const { player, error: authError } = await signInAnonymouslyAndRegister(
      nickname,
      phone
    )
    setLoading(false)
    if (authError) {
      setError(authError)
      return
    }
    if (player) onSuccess(player)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border-2 border-secondary w-full max-w-sm p-6 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-secondary text-3xl text-center mb-1 tracking-wider">
          INSERIR FICHA
        </h2>
        <p className="text-center text-gray-400 text-sm mb-6">
          Cadastre-se para entrar no ranking
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="SeuNome"
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
              WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(81) 99999-0000"
              className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-secondary"
            />
          </div>

          {error && (
            <p className="text-primary text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-red-700 disabled:opacity-50 text-white font-display text-xl tracking-wider py-2 rounded transition-colors"
          >
            {loading ? 'AGUARDE...' : 'JOGAR'}
          </button>
        </form>
      </div>
    </div>
  )
}
