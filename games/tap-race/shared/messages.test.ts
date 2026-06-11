import { describe, it, expect } from 'vitest'
import { RejoinRoomSchema, TapBatchSchema } from './messages'

describe('RejoinRoomSchema', () => {
  it('accepts valid rejoin data', () => {
    const result = RejoinRoomSchema.safeParse({ code: 'AB12', token: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects missing token', () => {
    const result = RejoinRoomSchema.safeParse({ code: 'AB12' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid uuid token', () => {
    const result = RejoinRoomSchema.safeParse({ code: 'AB12', token: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('TapBatchSchema', () => {
  it('accepte un count plausible', () => {
    expect(TapBatchSchema.safeParse({ count: 12 }).success).toBe(true)
  })

  it('rejette un count absurde (anti-triche)', () => {
    expect(TapBatchSchema.safeParse({ count: 1_000_000_000 }).success).toBe(false)
  })

  it('rejette un count négatif', () => {
    expect(TapBatchSchema.safeParse({ count: -5 }).success).toBe(false)
  })
})
