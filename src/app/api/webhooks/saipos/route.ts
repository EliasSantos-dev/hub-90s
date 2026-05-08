import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SaiposWebhookPayload } from '@/lib/saipos/types'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || !body.event || !body.cod_store || !body.order_id) {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 })
  }

  const payload = body as SaiposWebhookPayload

  // Log only — no auto-credit (Saipos payload has no phone/player identifier)
  const supabase = createSupabaseAdminClient()
  await supabase.from('saipos_webhook_log').insert({
    event: payload.event,
    cod_store: payload.cod_store,
    order_id: payload.order_id,
    raw_payload: payload,
  })

  return NextResponse.json({ received: true })
}
