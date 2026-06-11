import { describe, it, expect, vi } from 'vitest'
import { createRateLimiter } from './rateLimiter'

describe('createRateLimiter', () => {
  it('autorise jusqu’à max puis bloque dans la fenêtre', () => {
    const limit = createRateLimiter({ max: 3, windowMs: 1000 })
    expect(limit('ip1')).toBe(true)
    expect(limit('ip1')).toBe(true)
    expect(limit('ip1')).toBe(true)
    expect(limit('ip1')).toBe(false)
  })

  it('isole les clés (IP) entre elles', () => {
    const limit = createRateLimiter({ max: 1, windowMs: 1000 })
    expect(limit('a')).toBe(true)
    expect(limit('a')).toBe(false)
    expect(limit('b')).toBe(true)
  })

  it('réinitialise après la fenêtre', () => {
    vi.useFakeTimers()
    try {
      const limit = createRateLimiter({ max: 1, windowMs: 1000 })
      expect(limit('x')).toBe(true)
      expect(limit('x')).toBe(false)
      vi.advanceTimersByTime(1001)
      expect(limit('x')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
