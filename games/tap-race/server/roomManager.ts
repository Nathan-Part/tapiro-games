import type { Server } from 'socket.io'
import { ROOM_CODE_LENGTH } from '@arcade/shared'
import { TapRaceRoom, type RoomConfig } from './tapRaceRoom'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: ROOM_CODE_LENGTH }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomManager {
  private rooms = new Map<string, TapRaceRoom>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(
    private readonly io: Server,
    private readonly db?: { saveResults: (sessionId: string, round: number, players: { name: string; score: number }[]) => void },
    private readonly inactivityTimeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      Math.min(inactivityTimeoutMs, 60_000),
    )
  }

  create(config?: RoomConfig): string {
    let code = generateCode()
    while (this.rooms.has(code)) code = generateCode()
    const db = this.db
    const saveResultsFn = db
      ? (sessionId: string, round: number, players: { name: string; score: number }[]) => db.saveResults(sessionId, round, players)
      : () => {}
    this.rooms.set(code, new TapRaceRoom(this.io, code, saveResultsFn, config))
    return code
  }

  get(code: string): TapRaceRoom | undefined {
    return this.rooms.get(code)
  }

  list(): string[] {
    return [...this.rooms.keys()]
  }

  listWithStatus(): { code: string; phase: string; playerCount: number; mode: string; hostToken: string }[] {
    return [...this.rooms.entries()].map(([code, room]) => ({ code, ...room.getStatus(), hostToken: room.hostToken }))
  }

  delete(code: string): boolean {
    this.rooms.get(code)?.dispose()
    return this.rooms.delete(code)
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }

  private cleanup() {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > this.inactivityTimeoutMs) {
        room.dispose()
        this.rooms.delete(code)
      }
    }
  }
}
