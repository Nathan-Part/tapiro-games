import { randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import { serverReducer, getLeaderboard, initialServerState, type ServerGameState } from './tapRaceGame'
import { TapBatchSchema } from '../shared/messages'

type SaveResultsFn = (players: { name: string; score: number }[]) => void

interface PlayerSession {
  socketId: string
  name: string
  score: number
}

export class TapRaceRoom {
  private state: ServerGameState = { ...initialServerState }
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private leaderboardInterval: ReturnType<typeof setInterval> | null = null
  private scoreInterval: ReturnType<typeof setInterval> | null = null
  private sessions = new Map<string, PlayerSession>()
  lastActivity: number = Date.now()

  constructor(
    private readonly io: Server,
    private readonly roomId: string,
    private readonly saveResults: SaveResultsFn = () => {},
  ) {}

  join(socket: Socket, name: string) {
    const token = randomUUID()
    this.sessions.set(token, { socketId: socket.id, name, score: 0 })
    this.lastActivity = Date.now()

    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name })

    socket.emit('JOINED', { token })
    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })

    this.registerTapHandler(socket)
    socket.on('disconnect', () => {
      const entry = [...this.sessions.entries()].find(([, s]) => s.socketId === socket.id)
      if (entry) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) entry[1].score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    })
  }

  rejoin(socket: Socket, token: string): boolean {
    const session = this.sessions.get(token)
    if (!session) return false

    this.lastActivity = Date.now()
    session.socketId = socket.id

    socket.join(this.roomId)
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [socket.id]: { id: socket.id, name: session.name, score: session.score },
      },
    }

    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    socket.emit('SCORE_UPDATE', { score: session.score })

    this.registerTapHandler(socket)
    socket.on('disconnect', () => {
      const s = this.sessions.get(token)
      if (s) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) s.score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    })

    return true
  }

  watchAsHost(socket: Socket) {
    socket.join(this.roomId)
    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    socket.emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
  }

  start() {
    if (this.state.phase === 'RESULTS') { this.state = { ...initialServerState } }
    if (this.state.phase !== 'WAITING') return
    this.lastActivity = Date.now()
    this.state = serverReducer(this.state, { type: 'START' })
    this.broadcast()

    this.tickInterval = setInterval(() => {
      this.state = serverReducer(this.state, { type: 'TICK' })
      this.broadcast()
      if (this.state.phase === 'RESULTS') {
        this.stopIntervals()
        const leaderboard = getLeaderboard(this.state)
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: leaderboard })
        const players = Object.values(this.state.players).map(p => ({ name: p.name, score: p.score }))
        if (players.length > 0) this.saveResults(players)
      }
    }, 1000)

    this.leaderboardInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
      }
    }, 100)

    this.scoreInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        for (const player of Object.values(this.state.players)) {
          this.io.to(player.id).emit('SCORE_UPDATE', { score: player.score })
        }
      }
    }, 200)
  }

  private registerTapHandler(socket: Socket) {
    socket.on('TAP_BATCH', (raw: unknown) => {
      const result = TapBatchSchema.safeParse(raw)
      if (!result.success) return
      this.lastActivity = Date.now()
      this.state = serverReducer(this.state, { type: 'TAP_BATCH', playerId: socket.id, count: result.data.count })
    })
  }

  private broadcast() {
    this.io.to(this.roomId).emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
  }

  private stopIntervals() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.leaderboardInterval) clearInterval(this.leaderboardInterval)
    if (this.scoreInterval) clearInterval(this.scoreInterval)
    this.tickInterval = null; this.leaderboardInterval = null; this.scoreInterval = null
  }
}
