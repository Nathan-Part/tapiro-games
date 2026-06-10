import type { Server, Socket } from 'socket.io'
import { serverReducer, getLeaderboard, initialServerState, type ServerGameState } from './tapRaceGame'
import { TapBatchSchema } from '../shared/messages'

export class TapRaceRoom {
  private state: ServerGameState = { ...initialServerState }
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private leaderboardInterval: ReturnType<typeof setInterval> | null = null
  private scoreInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly io: Server,
    private readonly roomId: string,
  ) {}

  join(socket: Socket, name: string) {
    socket.join(this.roomId)
    this.state = serverReducer(this.state, { type: 'PLAYER_JOIN', id: socket.id, name })

    socket.emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
    this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })

    socket.on('TAP_BATCH', (raw: unknown) => {
      const result = TapBatchSchema.safeParse(raw)
      if (!result.success) return
      this.state = serverReducer(this.state, {
        type: 'TAP_BATCH',
        playerId: socket.id,
        count: result.data.count,
      })
    })

    socket.on('disconnect', () => {
      this.state = serverReducer(this.state, { type: 'PLAYER_LEAVE', id: socket.id })
    })
  }

  watchAsHost(socket: Socket) {
    socket.join(this.roomId)
    socket.emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
    socket.emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
  }

  start() {
    if (this.state.phase === 'RESULTS') {
      this.state = { ...initialServerState }
    }
    if (this.state.phase !== 'WAITING') return
    this.state = serverReducer(this.state, { type: 'START' })
    this.broadcast()

    this.tickInterval = setInterval(() => {
      this.state = serverReducer(this.state, { type: 'TICK' })
      this.broadcast()
      if (this.state.phase === 'RESULTS') {
        this.stopIntervals()
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
      }
    }, 1000)

    // 10×/s vers l'hôte
    this.leaderboardInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        this.io.to(this.roomId).emit('LEADERBOARD_UPDATE', { players: getLeaderboard(this.state) })
      }
    }, 100)

    // 5×/s vers chaque joueur
    this.scoreInterval = setInterval(() => {
      if (this.state.phase === 'PLAYING') {
        for (const player of Object.values(this.state.players)) {
          this.io.to(player.id).emit('SCORE_UPDATE', { score: player.score })
        }
      }
    }, 200)
  }

  private broadcast() {
    this.io.to(this.roomId).emit('GAME_STATE', {
      phase: this.state.phase,
      countdown: this.state.countdown,
      timeLeft: this.state.timeLeft,
    })
  }

  private stopIntervals() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.leaderboardInterval) clearInterval(this.leaderboardInterval)
    if (this.scoreInterval) clearInterval(this.scoreInterval)
    this.tickInterval = null
    this.leaderboardInterval = null
    this.scoreInterval = null
  }
}
