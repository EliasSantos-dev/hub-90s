import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSaiposOrder } from '@/lib/saipos/client'
import { buildRefId, calculateFichas } from '@/lib/fichas/rules'
import type { FichaRule } from '@/types/admin'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  // Auth: must be a logged-in player
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const orderId = body?.order_id as string | undefined
  if (!orderId?.trim()) {
    return NextResponse.json({ error: 'order_id é obrigatório' }, { status: 400 })
  }

  const codStore = process.env.SAIPOS_COD_STORE ?? '123'
  const token = process.env.SAIPOS_API_TOKEN ?? ''

  // Build dedup key (order IDs reset daily)
  const today = new Date().toISOString().slice(0, 10)
  const refId = buildRefId(codStore, orderId.trim(), today)

  // Check for existing claim
  const { data: existing } = await supabase
    .from('fichas')
    .select('id')
    .eq('ref_id', refId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Pedido já resgatado hoje' }, { status: 409 })
  }

  // Fetch order from Saipos to get totalValue
  const order = await getSaiposOrder(codStore, orderId.trim(), token)
  if (!order) {
    return NextResponse.json({ error: 'Pedido não encontrado no Saipos' }, { status: 404 })
  }

  // Fetch active fichas rules
  const { data: rulesData } = await supabase
    .from('fichas_rules')
    .select('*')
    .eq('active', true)

  const rules = (rulesData ?? []) as FichaRule[]
  const fichasAmount = calculateFichas(order.totalValue, rules)

  if (fichasAmount === 0) {
    return NextResponse.json({ error: 'Nenhuma regra de ficha aplicável' }, { status: 422 })
  }

  // Credit fichas
  const { error: insertError } = await supabase.from('fichas').insert({
    player_id: user.id,
    amount: fichasAmount,
    reason: 'pedido_saipos',
    ref_id: refId,
  })

  if (insertError) {
    if (insertError.message.includes('fichas_ref_id_unique')) {
      return NextResponse.json({ error: 'Pedido já resgatado hoje' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao creditar fichas' }, { status: 500 })
  }

  return NextResponse.json({ fichas_credited: fichasAmount, order_value: order.totalValue })
}
