import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const amount = Number(body?.amount ?? 1)
  const reason = String(body?.reason ?? 'jogo')

  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: 'amount deve ser inteiro positivo' }, { status: 400 })
  }

  const { data: newBalance, error } = await supabase.rpc('debit_ficha', {
    p_player_id: user.id,
    p_amount: amount,
    p_reason: reason,
  })

  if (error) {
    if (error.message.includes('insufficient_fichas')) {
      return NextResponse.json({ error: 'Fichas insuficientes' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro ao debitar fichas' }, { status: 500 })
  }

  return NextResponse.json({ new_balance: newBalance })
}
