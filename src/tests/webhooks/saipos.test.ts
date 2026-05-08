import { describe, it, expect } from 'vitest'
import { validateSaiposSignature, normalizePhone } from '@/lib/webhooks/saipos'

describe('normalizePhone', () => {
  it('removes non-numeric characters', () => { expect(normalizePhone('+55 (87) 9 9999-9999')).toBe('558799999999') })
  it('keeps already normalized number', () => { expect(normalizePhone('87999999999')).toBe('87999999999') })
  it('returns empty for empty input', () => { expect(normalizePhone('')).toBe('') })
})

describe('validateSaiposSignature', () => {
  it('returns true when token matches secret', () => { expect(validateSaiposSignature('secret-123', 'Bearer secret-123')).toBe(true) })
  it('returns false when token does not match', () => { expect(validateSaiposSignature('secret-123', 'Bearer wrong')).toBe(false) })
  it('returns false when header is empty', () => { expect(validateSaiposSignature('secret-123', '')).toBe(false) })
  it('returns false when secret is empty', () => { expect(validateSaiposSignature('', 'Bearer anything')).toBe(false) })
})
