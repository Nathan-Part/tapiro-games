export type ServerPhase = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS'

export interface TeamConfig {
  id: string
  name: string
  color: string
}

export interface PlayerRecord {
  id: string
  name: string
  score: number
  cumulativeScore: number
  teamId?: string
  eliminated: boolean
  ticksSinceLastTap: number
}

export interface ServerGameState {
  phase: ServerPhase
  countdown: number
  timeLeft: number
  gameDuration: number
  players: Record<string, PlayerRecord>
  frenzy: boolean
  currentRound: number
  totalRounds: number
}

export type ServerEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'PLAYER_JOIN'; id: string; name: string; teamId?: string }
  | { type: 'PLAYER_LEAVE'; id: string }
  | { type: 'TAP_BATCH'; playerId: string; count: number }
  | { type: 'FRENZY_START' }
  | { type: 'FRENZY_END' }
  | { type: 'NEXT_ROUND'; survivorOnly?: boolean }
  | { type: 'ELIMINATE'; ids: string[] }
  | { type: 'FORCE_END' }

/** Ticks without a tap before score starts decaying (1 tick = 1 s). */
const DECAY_GRACE = 3
const DECAY_RATE = 1

export function makeInitialState(totalRounds = 1, gameDuration = 60): ServerGameState {
  return {
    phase: 'WAITING',
    countdown: 3,
    timeLeft: gameDuration,
    gameDuration,
    players: {},
    frenzy: false,
    currentRound: 1,
    totalRounds,
  }
}

export const initialServerState: ServerGameState = makeInitialState()

export function serverReducer(state: ServerGameState, event: ServerEvent): ServerGameState {
  switch (event.type) {
    case 'PLAYER_JOIN':
      if (state.phase === 'RESULTS') return state
      return {
        ...state,
        players: {
          ...state.players,
          [event.id]: { id: event.id, name: event.name, score: 0, cumulativeScore: 0, teamId: event.teamId, eliminated: false, ticksSinceLastTap: 0 },
        },
      }

    case 'PLAYER_LEAVE': {
      if (state.phase === 'RESULTS') return state
      const players = { ...state.players }
      delete players[event.id]
      return { ...state, players }
    }

    case 'START':
      if (state.phase !== 'WAITING') return state
      return { ...state, phase: 'COUNTDOWN', countdown: 3 }

    case 'TICK':
      if (state.phase === 'COUNTDOWN') {
        if (state.countdown <= 1) return { ...state, phase: 'PLAYING', timeLeft: state.gameDuration }
        return { ...state, countdown: state.countdown - 1 }
      }
      if (state.phase === 'PLAYING') {
        if (state.timeLeft <= 1) return { ...state, phase: 'RESULTS', frenzy: false }
        const players = Object.fromEntries(
          Object.entries(state.players).map(([id, p]) => {
            const ticks = p.ticksSinceLastTap + 1
            const decaying = ticks > DECAY_GRACE && !p.eliminated
            const score = decaying ? Math.max(0, p.score - DECAY_RATE) : p.score
            return [id, { ...p, score, ticksSinceLastTap: ticks }]
          })
        )
        return { ...state, timeLeft: state.timeLeft - 1, players }
      }
      return state

    case 'TAP_BATCH': {
      if (state.phase !== 'PLAYING') return state
      const player = state.players[event.playerId]
      if (!player || player.eliminated) return state
      const multiplier = state.frenzy ? 2 : 1
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: { ...player, score: player.score + event.count * multiplier, ticksSinceLastTap: 0 },
        },
      }
    }

    case 'FRENZY_START':
      if (state.phase !== 'PLAYING') return state
      return { ...state, frenzy: true }

    case 'FRENZY_END':
      return { ...state, frenzy: false }

    case 'NEXT_ROUND':
      if (state.phase !== 'RESULTS') return state
      if (state.currentRound >= state.totalRounds) return state
      return {
        ...state,
        phase: 'COUNTDOWN',
        countdown: 3,
        timeLeft: state.gameDuration,
        frenzy: false,
        currentRound: state.currentRound + 1,
        players: Object.fromEntries(
          Object.entries(state.players).map(([id, p]) => [
            id,
            { ...p, cumulativeScore: p.cumulativeScore + p.score, score: 0, ticksSinceLastTap: 0, eliminated: event.survivorOnly ? p.eliminated : false },
          ])
        ),
      }

    case 'ELIMINATE': {
      if (state.phase !== 'PLAYING') return state
      const players = { ...state.players }
      for (const id of event.ids) {
        if (players[id]) players[id] = { ...players[id], eliminated: true }
      }
      return { ...state, players }
    }

    case 'FORCE_END':
      if (state.phase !== 'PLAYING') return state
      return { ...state, phase: 'RESULTS', frenzy: false }

    default:
      return state
  }
}

export function totalScore(p: PlayerRecord): number {
  return p.cumulativeScore + p.score
}

export function getLeaderboard(state: ServerGameState, useTotalScore = false): PlayerRecord[] {
  return Object.values(state.players)
    .sort((a, b) => (useTotalScore ? totalScore(b) - totalScore(a) : b.score - a.score))
    .slice(0, 10)
}

export function getTeamScores(state: ServerGameState, teams: TeamConfig[], useTotalScore = false): (TeamConfig & { score: number })[] {
  return teams.map(team => ({
    ...team,
    score: Object.values(state.players)
      .filter(p => p.teamId === team.id)
      .reduce((sum, p) => sum + (useTotalScore ? totalScore(p) : p.score), 0),
  }))
}
