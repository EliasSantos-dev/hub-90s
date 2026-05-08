import { describe, it, expect } from 'vitest'
import { keyToAction } from '../input'

describe('keyToAction', () => {
  it('ArrowLeft maps to left', () => expect(keyToAction('ArrowLeft')).toBe('left'))
  it('ArrowRight maps to right', () => expect(keyToAction('ArrowRight')).toBe('right'))
  it('Space maps to fire', () => expect(keyToAction(' ')).toBe('fire'))
  it('unknown key maps to none', () => expect(keyToAction('Enter')).toBe('none'))
  it('a maps to left', () => expect(keyToAction('a')).toBe('left'))
  it('d maps to right', () => expect(keyToAction('d')).toBe('right'))
})
