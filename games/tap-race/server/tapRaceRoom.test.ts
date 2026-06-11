import { describe, it, expect, vi, type Mock } from 'vitest'
import { TapRaceRoom } from './tapRaceRoom'
import type { Server, Socket } from 'socket.io'

interface MockSocket extends Socket {
  __fire(event: string, ...args: unknown[]): void
  __count(event: string): number
}

function makeMockSocket(id = 'socket-1'): MockSocket {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {}
  return {
    id,
    rooms: new Set<string>(),
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      ;(handlers[event] ??= []).push(cb)
    }),
    off: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb)
    }),
    removeAllListeners: vi.fn((event?: string) => {
      if (event) handlers[event] = []
      else for (const k of Object.keys(handlers)) delete handlers[k]
    }),
    __fire(event: string, ...args: unknown[]) {
      for (const cb of [...(handlers[event] ?? [])]) cb(...args)
    },
    __count(event: string) {
      return (handlers[event] ?? []).length
    },
  } as unknown as MockSocket
}

function makeMockIo(): Server {
  return { to: vi.fn().mockReturnThis(), emit: vi.fn() } as unknown as Server
}

function lastLeaderboard(io: Server): { players: Array<{ id: string; score: number }> } {
  const calls = (io.emit as Mock).mock.calls.filter((c) => c[0] === 'LEADERBOARD_UPDATE')
  return calls[calls.length - 1][1]
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

describe('TapRaceRoom — anti-triche & robustesse', () => {
  it('ne ré-enregistre pas le handler TAP_BATCH au re-join (anti-empilement)', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST')
    const socket = makeMockSocket()
    room.join(socket, 'Alice')
    room.join(socket, 'Alice') // double-join sur la même socket (ex: double-clic)
    expect(socket.__count('TAP_BATCH')).toBe(1)
  })

  it('ne ré-enregistre pas le handler disconnect au re-join', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST')
    const socket = makeMockSocket()
    room.join(socket, 'Alice')
    room.join(socket, 'Alice')
    expect(socket.__count('disconnect')).toBe(1)
  })

  it('plafonne le score injecté par seconde malgré un count énorme', () => {
    vi.useFakeTimers()
    try {
      const io = makeMockIo()
      const room = new TapRaceRoom(io, 'TEST')
      const socket = makeMockSocket()
      room.join(socket, 'Alice')
      room.start(room.hostToken)
      vi.advanceTimersByTime(3000) // COUNTDOWN(3) → PLAYING
      socket.__fire('TAP_BATCH', { count: 500 })
      socket.__fire('TAP_BATCH', { count: 500 })
      vi.advanceTimersByTime(100) // déclenche un emitLeaderboard
      const me = lastLeaderboard(io).players.find((p) => p.id === socket.id)
      expect(me).toBeDefined()
      expect(me!.score).toBeGreaterThan(0)
      expect(me!.score).toBeLessThanOrEqual(50) // borné à un rythme humain, pas 1000
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuse les joueurs au-delà de la capacité max', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST', undefined, undefined, 2)
    room.join(makeMockSocket('s1'), 'A')
    room.join(makeMockSocket('s2'), 'B')
    const third = makeMockSocket('s3')
    room.join(third, 'C')
    const errorEmit = (third.emit as Mock).mock.calls.find((c) => c[0] === 'ERROR')
    expect(errorEmit).toBeDefined()
    expect(room.getStatus().playerCount).toBe(2)
  })
})

describe('TapRaceRoom — autorisation hôte', () => {
  it('start() sans le bon token ne démarre pas la partie', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST')
    room.join(makeMockSocket(), 'Alice')
    room.start('mauvais-token')
    expect(room.getStatus().phase).toBe('WAITING')
  })

  it('start() avec le hostToken démarre la partie', () => {
    vi.useFakeTimers()
    try {
      const room = new TapRaceRoom(makeMockIo(), 'TEST')
      room.join(makeMockSocket(), 'Alice')
      room.start(room.hostToken)
      expect(room.getStatus().phase).not.toBe('WAITING')
    } finally {
      vi.useRealTimers()
    }
  })

  it('watchAsHost refuse un mauvais token', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST')
    expect(room.watchAsHost(makeMockSocket(), 'mauvais')).toBe(false)
  })

  it('watchAsHost accepte le hostToken', () => {
    const room = new TapRaceRoom(makeMockIo(), 'TEST')
    expect(room.watchAsHost(makeMockSocket(), room.hostToken)).toBe(true)
  })
})

describe('TapRaceRoom — cycle de vie', () => {
  it('dispose() arrête les intervals (plus de progression de phase)', () => {
    vi.useFakeTimers()
    try {
      const room = new TapRaceRoom(makeMockIo(), 'TEST')
      room.join(makeMockSocket(), 'A')
      room.start(room.hostToken)
      const phase = room.getStatus().phase
      room.dispose()
      vi.advanceTimersByTime(5000)
      expect(room.getStatus().phase).toBe(phase)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejouer après RESULTS conserve les joueurs', () => {
    vi.useFakeTimers()
    try {
      const room = new TapRaceRoom(makeMockIo(), 'TEST')
      room.join(makeMockSocket('s1'), 'A')
      room.start(room.hostToken)
      vi.advanceTimersByTime(3000 + 61000) // countdown + 60s → RESULTS
      expect(room.getStatus().phase).toBe('RESULTS')
      room.start(room.hostToken) // rejouer
      expect(room.getStatus().playerCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
