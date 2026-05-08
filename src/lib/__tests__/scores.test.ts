import { describe, it, expect, vi } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}))

import { saveScore, getPlayerBestScore } from '../scores'

describe('saveScore', () => {
  it('inserts a score row and returns it', async () => {
    const fakeScore = { id: 'sc-1', player_id: 'p-1', game_id: 'g-1', score: 500, wave: 2, season: 1 }
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: fakeScore, error: null }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })
    const result = await saveScore({ playerId: 'p-1', gameId: 'g-1', score: 500, wave: 2, season: 1 })
    expect(result).toEqual(fakeScore)
  })

  it('returns null on error', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })
    const result = await saveScore({ playerId: 'p-1', gameId: 'g-1', score: 500, wave: 2, season: 1 })
    expect(result).toBeNull()
  })
})

describe('getPlayerBestScore', () => {
  it('returns the maximum score for a player in a game', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { score: 1200 }, error: null }),
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })
    const best = await getPlayerBestScore('p-1', 'g-1')
    expect(best).toBe(1200)
  })

  it('returns 0 when no scores exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })
    const best = await getPlayerBestScore('p-1', 'g-1')
    expect(best).toBe(0)
  })
})
