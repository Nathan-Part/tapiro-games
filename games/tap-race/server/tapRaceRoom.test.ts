import { describe, it, expect, vi } from 'vitest'
import { TapRaceRoom } from './tapRaceRoom'
import type { Server, Socket } from 'socket.io'

function makeMockSocket(id = 'socket-1'): Socket {
  return {
    id,
    join: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  } as unknown as Socket
}

function makeMockIo(): Server {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } as unknown as Server
}

describe('TapRaceRoom — player token', () => {
  it('emits JOINED with a token when player joins', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket = makeMockSocket()
    room.join(socket, 'Alice')
    const emitCalls = (socket.emit as ReturnType<typeof vi.fn>).mock.calls
    const joinedCall = emitCalls.find(([event]: unknown[]) => event === 'JOINED')
    expect(joinedCall).toBeDefined()
    expect(typeof joinedCall![1].token).toBe('string')
    expect(joinedCall![1].token.length).toBeGreaterThan(10)
  })

  it('rejoin with valid token re-registers the socket and returns true', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket1 = makeMockSocket('socket-1')
    room.join(socket1, 'Alice')
    const joinedCall = (socket1.emit as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]: unknown[]) => event === 'JOINED')
    const { token } = joinedCall![1] as { token: string }

    const socket2 = makeMockSocket('socket-2')
    const result = room.rejoin(socket2, token)
    expect(result).toBe(true)

    const emitCalls = (socket2.emit as ReturnType<typeof vi.fn>).mock.calls
    const gameStateCall = emitCalls.find(([event]: unknown[]) => event === 'GAME_STATE')
    expect(gameStateCall).toBeDefined()
    expect(gameStateCall![0]).toBe('GAME_STATE')
  })

  it('rejoin with unknown token returns false', () => {
    const io = makeMockIo()
    const room = new TapRaceRoom(io, 'TEST')
    const socket = makeMockSocket()
    expect(room.rejoin(socket, 'unknown-token')).toBe(false)
  })
})
