import { randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import { serverReducer, getLeaderboard, getTeamScores, totalScore, makeInitialState, type ServerGameState, type TeamConfig } from './tapRaceGame'
import { TapBatchSchema } from '../shared/messages'

const MAX_TAPS_PER_SEC = 25
const FRENZY_DURATION_MS = 5_000
const FRENZY_MIN_DELAY_MS = 12_000
const FRENZY_MAX_EXTRA_MS = 13_000
const SURVIVAL_INTERVAL_MS = 10_000
const NEXT_ROUND_DELAY_MS = 5_000
/** One team needs this share of total taps to win tug-of-war early. */
const TUG_WIN_THRESHOLD = 0.8
const TUG_MIN_TOTAL_TAPS = 30

type SaveResultsFn = (sessionId: string, round: number, players: { name: string; score: number }[]) => void

export interface RoomConfig {
  mode: 'solo' | 'team' | 'survival' | 'tug'
  teams: TeamConfig[]
  rounds?: number
  duration?: number
}

interface PlayerSession {
  socketId: string
  name: string
  score: number
  cumulativeScore: number
  teamId?: string
  eliminated: boolean
}

export class TapRaceRoom {
  private state: ServerGameState
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private leaderboardInterval: ReturnType<typeof setInterval> | null = null
  private scoreInterval: ReturnType<typeof setInterval> | null = null
  private frenzyTimeout: ReturnType<typeof setTimeout> | null = null
  private frenzyEndTimeout: ReturnType<typeof setTimeout> | null = null
  private eliminationInterval: ReturnType<typeof setInterval> | null = null
  private nextRoundTimeout: ReturnType<typeof setTimeout> | null = null
  private sessions = new Map<string, PlayerSession>()
  private disconnectHandlers = new Map<string, () => void>()
  private purgeTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private sessionId: string | null = null
  private roundHistory: { round: number; players: { id: string; name: string; score: number; totalScore: number; teamId?: string; eliminated?: boolean }[] }[] = []
  readonly hostToken = randomUUID()
  lastActivity: number = Date.now()

  constructor(
    private readonly io: Server,
    private readonly roomId: string,
    private readonly saveResults: SaveResultsFn = () => {},
    private readonly config: RoomConfig = { mode: 'solo', teams: [] },
    private readonly maxPlayers: number = 10_000,
  ) {
    this.state = makeInitialState(config.rounds ?? 1, config.duration ?? 60)
  }

  getConfig(): RoomConfig { return this.config }

  getStatus() {
    return {
      phase: this.state.phase,
      playerCount: Object.keys(this.state.players).length,
      mode: this.config.mode,
    }
  }

  join(socket: Socket, name: string, teamId?: string) {
    if (Object.keys(this.state.players).length >= this.maxPlayers) {
      socket.emit('ERROR', { message: 'Room pleine' })
      return
    }
    const token = randomUUID()
    this.sessions.set(token, { socketId: socket.id, name, score: 0, cumulativeScore: 0, teamId, eliminated: false })
    this.lastActivity = Date.now()

    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name, teamId })

    socket.emit('JOINED', { token })
    socket.emit('GAME_STATE', this.buildStatePayload())
    this.emitLeaderboard()
    this.broadcastPlayerList()

    this.registerSocket(socket, token)
  }

  rejoin(socket: Socket, token: string): boolean {
    const session = this.sessions.get(token)
    if (!session) return false

    const pending = this.purgeTimers.get(token)
    if (pending) { clearTimeout(pending); this.purgeTimers.delete(token) }

    this.lastActivity = Date.now()
    session.socketId = socket.id

    socket.join(this.roomId)
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [socket.id]: { id: socket.id, name: session.name, score: session.score, cumulativeScore: session.cumulativeScore, teamId: session.teamId, eliminated: session.eliminated, ticksSinceLastTap: 0 },
      },
    }

    socket.emit('GAME_STATE', this.buildStatePayload())
    socket.emit('SCORE_UPDATE', { score: session.score, eliminated: session.eliminated })
    this.emitLeaderboard()
    this.broadcastPlayerList()

    this.registerSocket(socket, token)

    return true
  }

  leave(socket: Socket) {
    const entry = [...this.sessions.entries()].find(([, s]) => s.socketId === socket.id)
    if (entry) {
      const currentPlayer = this.state.players[socket.id]
      if (currentPlayer) {
        entry[1].score = currentPlayer.score
        entry[1].cumulativeScore = currentPlayer.cumulativeScore
        entry[1].eliminated = currentPlayer.eliminated
      }
    }
    this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    this.emitLeaderboard()
    this.broadcastPlayerList()
    socket.leave(this.roomId)
  }

  watchAsHost(socket: Socket, token: string): boolean {
    if (token !== this.hostToken) return false
    socket.join(this.roomId)
    socket.emit('GAME_STATE', this.buildStatePayload())
    socket.emit('LEADERBOARD_UPDATE', this.buildLeaderboardPayload())
    return true
  }

  start(token: string) {
    if (token !== this.hostToken) return
    if (this.state.phase === 'RESULTS') {
      const players = Object.fromEntries(
        Object.entries(this.state.players).map(([id, p]) => [id, { ...p, score: 0, cumulativeScore: 0, ticksSinceLastTap: 0, eliminated: false }]),
      )
      this.state = { ...makeInitialState(this.config.rounds ?? 1, this.config.duration ?? 60), players }
      this.roundHistory = []
    }
    if (this.state.phase !== 'WAITING') return
    if (Object.keys(this.state.players).length === 0) return
    this.sessionId = randomUUID()
    this.lastActivity = Date.now()
    this.state = serverReducer(this.state, { type: 'START' })
    this.broadcast()
    this.startIntervals()
  }

  private startIntervals() {
    this.stopIntervals()

    this.tickInterval = setInterval(() => {
      this.state = serverReducer(this.state, { type: 'TICK' })
      this.broadcast()

      if (this.state.phase === 'PLAYING' && this.config.mode === 'tug' && this.config.teams.length >= 2) {
        const teamScores = getTeamScores(this.state, this.config.teams)
        const total = teamScores.reduce((sum, t) => sum + t.score, 0)
        if (total >= TUG_MIN_TOTAL_TAPS) {
          const maxShare = Math.max(...teamScores.map(t => t.score / total))
          if (maxShare >= TUG_WIN_THRESHOLD) {
            this.state = serverReducer(this.state, { type: 'FORCE_END' })
            this.broadcast()
          }
        }
      }

      if (this.state.phase === 'RESULTS') {
        this.stopIntervals()
        this.emitLeaderboard()
        const players = Object.values(this.state.players).map(p => ({ name: p.name, score: p.score }))
        if (players.length > 0 && this.sessionId) this.saveResults(this.sessionId, this.state.currentRound, players)
        this.maybeScheduleNextRound()
      }
    }, 1000)

    this.leaderboardInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') this.emitLeaderboard()
    }, 100)

    this.scoreInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        for (const player of Object.values(this.state.players)) {
          this.io.to(player.id).emit('SCORE_UPDATE', { score: player.score, eliminated: player.eliminated })
        }
      }
    }, 200)

    this.scheduleFrenzy()

    if (this.config.mode === 'survival') {
      this.scheduleElimination()
    }
  }

  private scheduleFrenzy() {
    const delay = FRENZY_MIN_DELAY_MS + Math.random() * FRENZY_MAX_EXTRA_MS
    this.frenzyTimeout = setTimeout(() => {
      if (this.state.phase !== 'PLAYING') return
      this.state = serverReducer(this.state, { type: 'FRENZY_START' })
      this.io.to(this.roomId).emit('FRENZY_STATE', { active: true })

      this.frenzyEndTimeout = setTimeout(() => {
        this.state = serverReducer(this.state, { type: 'FRENZY_END' })
        this.io.to(this.roomId).emit('FRENZY_STATE', { active: false })
        if (this.state.phase === 'PLAYING') this.scheduleFrenzy()
      }, FRENZY_DURATION_MS)
    }, delay)
  }

  private scheduleElimination() {
    this.eliminationInterval = setInterval(() => {
      if (this.state.phase !== 'PLAYING') return
      const active = Object.values(this.state.players).filter(p => !p.eliminated)
      if (active.length <= 1) return
      const toEliminate = Math.max(1, Math.floor(active.length * 0.2))
      const sorted = [...active].sort((a, b) => a.score - b.score)
      const ids = sorted.slice(0, toEliminate).map(p => p.id)
      this.state = serverReducer(this.state, { type: 'ELIMINATE', ids })
      this.io.to(this.roomId).emit('ELIMINATION', { ids })
      // Si 1 seul survivant reste, fin anticipée : il est vainqueur
      const remaining = Object.values(this.state.players).filter(p => !p.eliminated)
      if (remaining.length <= 1 && this.state.phase === 'PLAYING') {
        this.state = serverReducer(this.state, { type: 'FORCE_END' })
        this.broadcast()
      }
    }, SURVIVAL_INTERVAL_MS)
  }

  private saveRoundSnapshot(round: number, useTotalScore: boolean) {
    if (this.roundHistory.find(s => s.round === round)) return
    const players = getLeaderboard(this.state, useTotalScore).map(p => ({
      id: p.id, name: p.name, score: p.score, totalScore: totalScore(p), teamId: p.teamId, eliminated: p.eliminated,
    }))
    this.roundHistory.push({ round, players })
  }

  private maybeScheduleNextRound() {
    if (this.state.currentRound < this.state.totalRounds) {
      this.saveRoundSnapshot(this.state.currentRound, false)
      this.nextRoundTimeout = setTimeout(() => {
        this.nextRoundTimeout = null
        this.state = serverReducer(this.state, { type: 'NEXT_ROUND', survivorOnly: this.config.mode === 'survival' })
        this.broadcast()
        this.startIntervals()
      }, NEXT_ROUND_DELAY_MS)
    }
  }

  private buildStatePayload() {
    return {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
      gameDuration: this.state.gameDuration,
      frenzy: this.state.frenzy,
      currentRound: this.state.currentRound,
      totalRounds: this.state.totalRounds,
      mode: this.config.mode,
    }
  }

  private buildLeaderboardPayload() {
    const isFinalResults = this.state.phase === 'RESULTS' && this.state.currentRound >= this.state.totalRounds
    const leaderboard = getLeaderboard(this.state, isFinalResults)
    const players = leaderboard.map(p => ({ ...p, totalScore: totalScore(p) }))
    type RoundHistoryEntry = { round: number; players: { id: string; name: string; score: number; totalScore: number; teamId?: string; eliminated?: boolean }[] }
    const payload: {
      players: typeof players
      teams?: ReturnType<typeof getTeamScores>
      ropePosition?: number
      isFinalResults?: boolean
      roundHistory?: RoundHistoryEntry[]
    } = { players }

    if (isFinalResults) {
      this.saveRoundSnapshot(this.state.currentRound, true)
      payload.isFinalResults = true
      payload.roundHistory = this.roundHistory
    }

    if (this.config.mode === 'team' || this.config.mode === 'tug') {
      payload.teams = getTeamScores(this.state, this.config.teams, isFinalResults)
    }
    if (this.config.mode === 'tug' && this.config.teams.length >= 2) {
      const teams = payload.teams!
      const total = teams.reduce((sum, t) => sum + t.score, 0)
      payload.ropePosition = total > 0 ? teams[0].score / total : 0.5
    }
    return payload
  }

  private emitLeaderboard() {
    this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', this.buildLeaderboardPayload())
  }

  private registerSocket(socket: Socket, token: string) {
    socket.removeAllListeners('TAP_BATCH')
    const prevDisconnect = this.disconnectHandlers.get(socket.id)
    if (prevDisconnect) socket.off('disconnect', prevDisconnect)

    let windowStart = Date.now()
    let inWindow = 0
    socket.on('TAP_BATCH', (raw: unknown) => {
      const result = TapBatchSchema.safeParse(raw)
      if (!result.success) return
      if (this.state.phase !== 'PLAYING') return
      const player = this.state.players[socket.id]
      if (player?.eliminated) return
      const now = Date.now()
      if (now - windowStart >= 1000) {
        windowStart = now
        inWindow = 0
      }
      const accepted = Math.min(result.data.count, Math.max(0, MAX_TAPS_PER_SEC - inWindow))
      if (accepted <= 0) return
      inWindow += accepted
      this.lastActivity = now
      this.state = serverReducer(this.state, { type: 'TAP_BATCH', playerId: socket.id, count: accepted })
    })

    const onDisconnect = () => {
      const s = this.sessions.get(token)
      if (s) {
        const currentPlayer = this.state.players[socket.id]
        if (currentPlayer) { s.score = currentPlayer.score; s.cumulativeScore = currentPlayer.cumulativeScore; s.eliminated = currentPlayer.eliminated }
      }
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
      this.disconnectHandlers.delete(socket.id)
      this.emitLeaderboard()
      this.broadcastPlayerList()

      const purge = setTimeout(() => {
        if (this.sessions.get(token)?.socketId === socket.id) this.sessions.delete(token)
        this.purgeTimers.delete(token)
      }, 30_000)
      this.purgeTimers.set(token, purge)
    }
    this.disconnectHandlers.set(socket.id, onDisconnect)
    socket.on('disconnect', onDisconnect)
  }

  private broadcast() {
    this.io.to(this.roomId).emit('GAME_STATE', this.buildStatePayload())
  }

  private broadcastPlayerList() {
    const all = Object.values(this.state.players)
    this.io.to(this.roomId).emit('PLAYERS_UPDATE', {
      players: all.slice(0, 100).map(p => ({ id: p.id, name: p.name, teamId: p.teamId })),
      total: all.length,
    })
  }

  dispose() {
    this.stopIntervals()
    this.disconnectHandlers.clear()
    for (const t of this.purgeTimers.values()) clearTimeout(t)
    this.purgeTimers.clear()
  }

  private stopIntervals() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.leaderboardInterval) clearInterval(this.leaderboardInterval)
    if (this.scoreInterval) clearInterval(this.scoreInterval)
    if (this.frenzyTimeout) clearTimeout(this.frenzyTimeout)
    if (this.frenzyEndTimeout) clearTimeout(this.frenzyEndTimeout)
    if (this.eliminationInterval) clearInterval(this.eliminationInterval)
    if (this.nextRoundTimeout) clearTimeout(this.nextRoundTimeout)
    this.tickInterval = null
    this.leaderboardInterval = null
    this.scoreInterval = null
    this.frenzyTimeout = null
    this.frenzyEndTimeout = null
    this.eliminationInterval = null
    this.nextRoundTimeout = null
  }
}
