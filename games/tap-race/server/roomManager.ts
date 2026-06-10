import type { Server } from 'socket.io'
import { TapRaceRoom } from './tapRaceRoom'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export class RoomManager {
  private rooms = new Map<string, TapRaceRoom>()

  constructor(private readonly io: Server) {}

  create(): string {
    let code = generateCode()
    while (this.rooms.has(code)) code = generateCode()
    this.rooms.set(code, new TapRaceRoom(this.io, code))
    return code
  }

  get(code: string): TapRaceRoom | undefined {
    return this.rooms.get(code)
  }
}
