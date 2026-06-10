import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RoomManager } from './roomManager'
import type { Server } from 'socket.io'

function makeMockIo(): Server {
  return { to: vi.fn().mockReturnThis(), emit: vi.fn() } as unknown as Server
}

describe('RoomManager — cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('removes a room after inactivity timeout', () => {
    let currentTime = 0
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    const manager = new RoomManager(makeMockIo(), undefined, 200)
    const code = manager.create()
    expect(manager.get(code)).toBeDefined()

    currentTime += 250
    vi.advanceTimersByTime(250)
    expect(manager.get(code)).toBeUndefined()
  })

  it('keeps an active room alive', () => {
    let currentTime = 0
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    const manager = new RoomManager(makeMockIo(), undefined, 500)
    const code = manager.create()

    // Simulate activity by moving lastActivity forward
    const room = manager.get(code)!
    currentTime += 100
    vi.advanceTimersByTime(100)
    room.lastActivity = Date.now()

    currentTime += 300
    vi.advanceTimersByTime(300)
    expect(manager.get(code)).toBeDefined()
  })

  it('cleanup interval can be stopped with destroy()', () => {
    let currentTime = 0
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    const manager = new RoomManager(makeMockIo(), undefined, 100)
    const code = manager.create()
    manager.destroy()

    currentTime += 500
    vi.advanceTimersByTime(500)
    // Room still there because cleanup stopped
    expect(manager.get(code)).toBeDefined()
  })
})
