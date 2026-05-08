import { describe, it, expect } from 'vitest'
import { extractAdminRole } from '@/lib/admin/auth'

describe('extractAdminRole', () => {
  it('returns true when user_metadata.role is admin', () => {
    expect(extractAdminRole({ user_metadata: { role: 'admin' } })).toBe(true)
  })
  it('returns false when role is missing', () => {
    expect(extractAdminRole({ user_metadata: {} })).toBe(false)
  })
  it('returns false when user is null', () => {
    expect(extractAdminRole(null)).toBe(false)
  })
})
