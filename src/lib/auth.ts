import { supabase, Player } from './supabase'

export type AuthResult = {
  player: Player | null
  error: string | null
}

export async function signInAnonymouslyAndRegister(
  nickname: string,
  phone: string
): Promise<AuthResult> {
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously()

  if (authError || !authData.user) {
    return { player: null, error: authError?.message ?? 'Erro de autenticação' }
  }

  const { data: player, error: insertError } = await supabase
    .from('players')
    .insert({ id: authData.user.id, nickname: nickname.trim(), phone: phone.trim() })
    .select()
    .single()

  if (insertError) {
    const isDuplicate = insertError.message.includes('duplicate key')
    return {
      player: null,
      error: isDuplicate
        ? 'Nickname ou telefone já está em uso'
        : insertError.message,
    }
  }

  // Inserir 3 fichas welcome (não bloqueia o cadastro se falhar)
  await supabase.from('fichas').insert([
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
    { player_id: authData.user.id, amount: 1, reason: 'welcome' },
  ])

  return { player: player as Player, error: null }
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Player | null
}
