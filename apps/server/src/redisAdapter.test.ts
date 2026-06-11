import { describe, it, expect, vi } from 'vitest'

const subClientMock = { on: vi.fn() }
const pubClientMock = { duplicate: vi.fn(() => subClientMock), on: vi.fn() }

vi.mock('ioredis', () => ({
  // vitest 4.x exige function/class pour les mocks de constructeur (pas une flèche)
  Redis: vi.fn(function () { return pubClientMock }),
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

  it('attache un handler d’erreur sur les deux clients (sinon crash à la coupure)', () => {
    createRedisAdapter('redis://localhost:6379')
    expect(pubClientMock.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(subClientMock.on).toHaveBeenCalledWith('error', expect.any(Function))
  })
})
