import type { Server } from 'socket.io'
import { TapRaceRoom } from './tapRaceRoom'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomManager {
  private rooms = new Map<string, TapRaceRoom>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(
    private readonly io: Server,
    private readonly db?: { saveResults: (players: { name: string; score: number }[]) => void },
    private readonly inactivityTimeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      Math.min(inactivityTimeoutMs, 60_000),
    )
  }

  create(): string {
    let code = generateCode()
    while (this.rooms.has(code)) code = generateCode()
    const db = this.db
    const saveResultsFn = db
      ? (players: { name: string; score: number }[]) => db.saveResults(players)
      : () => {}
    this.rooms.set(code, new TapRaceRoom(this.io, code, saveResultsFn))
    return code
  }

  get(code: string): TapRaceRoom | undefined {
    return this.rooms.get(code)
  }

  list(): string[] {
    return [...this.rooms.keys()]
  }

  delete(code: string): boolean {
    return this.rooms.delete(code)
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }

  private cleanup() {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > this.inactivityTimeoutMs) {
        this.rooms.delete(code)
      }
    }
  }
}
