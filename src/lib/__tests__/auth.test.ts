import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSignInAnonymously, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockSignInAnonymously: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: { signInAnonymously: mockSignInAnonymously, getUser: mockGetUser },
    from: mockFrom,
  },
}))

import { signInAnonymouslyAndRegister, getCurrentPlayer } from '../auth'

describe('signInAnonymouslyAndRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when signInAnonymously fails', async () => {
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'auth error' },
    })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toBe('auth error')
    expect(result.player).toBeNull()
  })

  it('inserts player and returns it on success', async () => {
    const fakeUser = { id: 'uuid-123' }
    const fakePlayer = { id: 'uuid-123', nickname: 'Tester', phone: '81999990000', created_at: '2026-05-08' }

    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: fakePlayer, error: null }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toBeNull()
    expect(result.player?.nickname).toBe('Tester')
  })

  it('returns error when nickname already exists', async () => {
    const fakeUser = { id: 'uuid-456' }
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    })

    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      }),
    })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await signInAnonymouslyAndRegister('Tester', '81999990000')
    expect(result.error).toMatch(/já está em uso/)
  })
})

describe('getCurrentPlayer', () => {
  it('returns null when no session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await getCurrentPlayer()
    expect(result).toBeNull()
  })
})
