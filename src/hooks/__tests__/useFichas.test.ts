import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const { mockRpc, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    mockRpc: vi.fn(),
    mockChannel,
    mockRemoveChannel: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

import { useFichas } from '../useFichas'

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('useFichas', () => {
  it('retorna balance 0 quando playerId é null', () => {
    const { result } = renderHook(() => useFichas(null))
    expect(result.current.balance).toBe(0)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('chama RPC recharge_fichas e armazena resultado no sessionStorage', async () => {
    mockRpc.mockResolvedValueOnce({ data: 2, error: null })
    const { result } = renderHook(() => useFichas('player-uuid'))
    await waitFor(() => expect(result.current.balance).toBe(2))
    expect(sessionStorage.getItem('fichas_player-uuid')).toBe('2')
    expect(mockRpc).toHaveBeenCalledWith('recharge_fichas', { p_player_id: 'player-uuid' })
  })

  it('usa sessionStorage sem chamar RPC quando cache existe', () => {
    sessionStorage.setItem('fichas_player-uuid', '3')
    const { result } = renderHook(() => useFichas('player-uuid'))
    expect(result.current.balance).toBe(3)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('invalidate limpa cache e refaz o fetch', async () => {
    sessionStorage.setItem('fichas_player-uuid', '3')
    mockRpc.mockResolvedValueOnce({ data: 1, error: null })
    const { result } = renderHook(() => useFichas('player-uuid'))
    expect(result.current.balance).toBe(3)
    act(() => { result.current.invalidate() })
    await waitFor(() => expect(result.current.balance).toBe(1))
    expect(sessionStorage.getItem('fichas_player-uuid')).toBe('1')
  })
})
