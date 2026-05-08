import { supabase, Score } from './supabase'

type SaveScoreParams = {
  playerId: string
  gameId: string
  score: number
  wave: number
  season: number
}

export async function saveScore(params: SaveScoreParams): Promise<Score | null> {
  const { data, error } = await supabase
    .from('scores')
    .insert({
      player_id: params.playerId,
      game_id: params.gameId,
      score: params.score,
      wave: params.wave,
      season: params.season,
    })
    .select()
    .single()

  if (error) return null
  return data as Score
}

export async function getPlayerBestScore(
  playerId: string,
  gameId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('scores')
    .select('score')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return 0
  return data.score
}
