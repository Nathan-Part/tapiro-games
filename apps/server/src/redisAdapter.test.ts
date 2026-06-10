import { describe, it, expect, vi } from 'vitest'

const subClientMock = {}
const pubClientMock = { duplicate: vi.fn(() => subClientMock) }

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => pubClientMock),
}))

vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(() => vi.fn()),
}))

import { createRedisAdapter } from './redisAdapter'

describe('createRedisAdapter', () => {
  it('returns adapter function and two distinct clients', () => {
    const result = createRedisAdapter('redis://localhost:6379')
    expect(typeof result.adapter).toBe('function')
    expect(result.subClient).toBe(subClientMock)
    expect(result.pubClient).not.toBe(result.subClient)
  })
})
