'use client'

import { useState, useEffect } from 'react'
import { SaiposLog } from '@/components/admin/SaiposLog'
import { getRecentWebhookLogs } from '@/lib/admin/dashboard'
import type { WebhookLog } from '@/types/admin'

export default function AdminSaiposPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [testFeedback, setTestFeedback] = useState<string | null>(null)

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/saipos`)
    getRecentWebhookLogs(50).then((data) => {
      setLogs(data)
      setLoading(false)
    })
  }, [])

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch {
      setCopyFeedback(false)
    }
  }

  async function handleTestWebhook() {
    const secret = prompt('Digite o SAIPOS_WEBHOOK_SECRET configurado:')
    if (!secret) return

    const fakePayload = {
      event: 'order.delivered',
      cod_store: 'TEST001',
      order_id: `TEST-${Date.now()}`,
      items: [],
      total: 50.0,
    }

    try {
      const res = await fetch('/api/webhooks/saipos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-saipos-secret': secret,
        },
        body: JSON.stringify(fakePayload),
      })
      const text = await res.text()
      setTestFeedback(`Status ${res.status}: ${text}`)
      // Refresh logs after test
      const updatedLogs = await getRecentWebhookLogs(50)
      setLogs(updatedLogs)
    } catch (err) {
      setTestFeedback(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">SAIPOS</h1>

      <div className="bg-[#1a1a1a] border border-[#222] rounded-lg p-5 space-y-4">
        <h2 className="font-display text-sm text-[#f0df5a] tracking-widest">CONFIGURAÇÃO DO WEBHOOK</h2>

        <div className="space-y-2">
          <label className="block text-[#888] text-xs">URL DO WEBHOOK</label>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#0f0f0f] border border-[#333] text-[#ec9837] rounded px-3 py-2 text-sm font-mono truncate">
              {webhookUrl || 'Carregando...'}
            </code>
            <button onClick={handleCopyUrl}
              className={`px-4 py-2 rounded text-xs font-display font-bold tracking-widest transition-colors ${copyFeedback ? 'bg-green-700 text-white' : 'bg-[#333] hover:bg-[#444] text-white'}`}>
              {copyFeedback ? 'COPIADO!' : 'COPIAR'}
            </button>
          </div>
          <p className="text-[#555] text-xs">Configure este URL no painel do Saipos como destino do webhook de pedidos.</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleTestWebhook}
            className="bg-[#b92526] hover:bg-[#d42828] text-white font-display font-bold px-4 py-2 rounded text-sm tracking-widest transition-colors">
            TESTAR WEBHOOK
          </button>
          {testFeedback && (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span>{testFeedback}</span>
              <button className="text-[#555] hover:text-white" onClick={() => setTestFeedback(null)}>&#x2715;</button>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-[#f0df5a] tracking-widest">LOGS RECENTES</h2>
          <span className="text-[#555] text-sm">{loading ? 'Carregando...' : `${logs.length} registros`}</span>
        </div>
        {loading ? (
          <div className="text-[#555] text-sm py-8 text-center">Carregando logs...</div>
        ) : (
          <SaiposLog logs={logs} />
        )}
      </section>
    </div>
  )
}
