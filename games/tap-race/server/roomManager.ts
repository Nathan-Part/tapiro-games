import type { Server } from 'socket.io'
import { TapRaceRoom } from './tapRaceRoom'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomManager {
  private rooms = new Map<string, TapRaceRoom>()

  constructor(
    private readonly io: Server,
    private readonly db?: { saveResults: (players: { name: string; score: number }[]) => void },
  ) {}

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
}
