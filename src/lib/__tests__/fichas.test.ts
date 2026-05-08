import { describe, it, expect, vi } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('../supabase', () => ({
  supabase: { from: mockFrom },
}))

import { getFichaBalance } from '../fichas'

describe('getFichaBalance', () => {
  it('returns sum of amounts for a player', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ amount: 3 }, { amount: -1 }, { amount: 5 }],
        error: null,
      }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(7)
  })

  it('returns 0 when no fichas exist', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(0)
  })

  it('returns 0 on error', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
    })
    mockFrom.mockReturnValue({ select: mockSelect })

    const balance = await getFichaBalance('player-uuid')
    expect(balance).toBe(0)
  })
})
