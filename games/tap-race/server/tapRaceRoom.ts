import { randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import { serverReducer, getLeaderboard, getTeamScores, initialServerState, type ServerGameState, type TeamConfig } from './tapRaceGame'
import { TapBatchSchema } from '../shared/messages'

type SaveResultsFn = (players: { name: string; score: number }[]) => void

export interface RoomConfig {
  mode: 'solo' | 'team'
  teams: TeamConfig[]
}

interface PlayerSession {
  socketId: string
  name: string
  score: number
  teamId?: string
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
    private readonly config: RoomConfig = { mode: 'solo', teams: [] },
  ) {}

  getConfig(): RoomConfig { return this.config }

  getStatus() {
    return {
      phase: this.state.phase,
      playerCount: Object.keys(this.state.players).length,
      mode: this.config.mode,
    }
  }

  join(socket: Socket, name: string, teamId?: string) {
    const token = randomUUID()
    this.sessions.set(token, { socketId: socket.id, name, score: 0, teamId })
    this.lastActivity = Date.now()

    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name, teamId })

    socket.emit('JOINED', { token })
    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    this.emitLeaderboard()
    this.broadcastPlayerList()

    this.registerTapHandler(socket)
    socket.on('disconnect', () => {
      const entry = [...this.sessions.entries()].find(([, s]) => s.socketId === socket.id)
      if (entry) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) entry[1].score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
      this.emitLeaderboard()
      this.broadcastPlayerList()
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
        [socket.id]: { id: socket.id, name: session.name, score: session.score, teamId: session.teamId },
      },
    }

    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    socket.emit('SCORE_UPDATE', { score: session.score })
    this.emitLeaderboard()
    this.broadcastPlayerList()

    this.registerTapHandler(socket)
    socket.on('disconnect', () => {
      const s = this.sessions.get(token)
      if (s) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) s.score = currentPlayer.score
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
      this.emitLeaderboard()
      this.broadcastPlayerList()
    })

    return true
  }

  leave(socket: Socket) {
    const entry = [...this.sessions.entries()].find(([, s]) => s.socketId === socket.id)
    if (entry) {
      const currentPlayer = this.state.players[socket.id]
      if (currentPlayer) entry[1].score = currentPlayer.score
    }
    this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    this.emitLeaderboard()
    this.broadcastPlayerList()
    socket.leave(this.roomId)
  }

  watchAsHost(socket: Socket) {
    socket.join(this.roomId)
    socket.emit('GAME_STATE', { phase: this.state.phase, countdown: this.state.countdown, timeLeft: this.state.timeLeft })
    socket.emit('LEADERBOARD_UPDATE', this.buildLeaderboardPayload())
  }

  start() {
    if (this.state.phase === 'RESULTS') { this.state = { ...initialServerState } }
    if (this.state.phase !== 'WAITING') return
    if (Object.keys(this.state.players).length === 0) return
    this.lastActivity = Date.now()
    this.state = serverReducer(this.state, { type: 'START' })
    this.broadcast()

    this.tickInterval = setInterval(() => {
      this.state = serverReducer(this.state, { type: 'TICK' })
      this.broadcast()
      if (this.state.phase === 'RESULTS') {
        this.stopIntervals()
        this.emitLeaderboard()
        const players = Object.values(this.state.players).map(p => ({ name: p.name, score: p.score }))
        if (players.length > 0) this.saveResults(players)
      }
    }, 1000)

    this.leaderboardInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') this.emitLeaderboard()
    }, 100)

    this.scoreInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        for (const player of Object.values(this.state.players)) {
          this.io.to(player.id).emit('SCORE_UPDATE', { score: player.score })
        }
      }
    }, 200)
  }

  private buildLeaderboardPayload() {
    const payload: { players: ReturnType<typeof getLeaderboard>; teams?: ReturnType<typeof getTeamScores> } = {
      players: getLeaderboard(this.state),
    }
    if (this.config.mode === 'team') {
      payload.teams = getTeamScores(this.state, this.config.teams)
    }
    return payload
  }

  private emitLeaderboard() {
    this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', this.buildLeaderboardPayload())
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

  private broadcastPlayerList() {
    const all = Object.values(this.state.players)
    this.io.to(this.roomId).emit('PLAYERS_UPDATE', {
      players: all.slice(0, 100).map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
      total: all.length,
    })
  }

  private stopIntervals() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.leaderboardInterval) clearInterval(this.leaderboardInterval)
    if (this.scoreInterval) clearInterval(this.scoreInterval)
    this.tickInterval = null; this.leaderboardInterval = null; this.scoreInterval = null
  }
}
