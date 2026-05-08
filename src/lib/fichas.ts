import { supabase } from './supabase'

export async function getFichaBalance(playerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('fichas')
    .select('amount')
    .eq('player_id', playerId)

  if (error || !data) return 0
  return data.reduce((sum, row) => sum + row.amount, 0)
}
