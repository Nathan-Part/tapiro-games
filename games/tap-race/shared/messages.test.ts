import { describe, it, expect } from 'vitest'
import { RejoinRoomSchema } from './messages'

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
