export type ServerPhase = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS'

export interface PlayerRecord {
  id: string
  name: string
  score: number
}

export interface ServerGameState {
  phase: ServerPhase
  countdown: number
  timeLeft: number
  players: Record<string, PlayerRecord>
}

export type ServerEvent =
  | { type: 'START' }
  | { type: 'TICK' }
  | { type: 'PLAYER_JOIN'; id: string; name: string }
  | { type: 'PLAYER_LEAVE'; id: string }
  | { type: 'TAP_BATCH'; playerId: string; count: number }

export const initialServerState: ServerGameState = {
  phase: 'WAITING',
  countdown: 3,
  timeLeft: 60,
  players: {},
}

export function serverReducer(state: ServerGameState, event: ServerEvent): ServerGameState {
  switch (event.type) {
    case 'PLAYER_JOIN':
      if (state.phase === 'RESULTS') return state
      return {
        ...state,
        players: { ...state.players, [event.id]: { id: event.id, name: event.name, score: 0 } },
      }

    case 'PLAYER_LEAVE': {
      const players = { ...state.players }
      delete players[event.id]
      return { ...state, players }
    }

    case 'START':
      if (state.phase !== 'WAITING') return state
      return { ...state, phase: 'COUNTDOWN', countdown: 3 }

    case 'TICK':
      if (state.phase === 'COUNTDOWN') {
        if (state.countdown <= 1) return { ...state, phase: 'PLAYING', timeLeft: 60 }
        return { ...state, countdown: state.countdown - 1 }
      }
      if (state.phase === 'PLAYING') {
        if (state.timeLeft <= 1) return { ...state, phase: 'RESULTS' }
        return { ...state, timeLeft: state.timeLeft - 1 }
      }
      return state

    case 'TAP_BATCH': {
      if (state.phase !== 'PLAYING') return state
      const player = state.players[event.playerId]
      if (!player) return state
      return {
        ...state,
        players: {
          ...state.players,
          [event.playerId]: { ...player, score: player.score + event.count },
        },
      }
    }

    default:
      return state
  }
}

export function getLeaderboard(state: ServerGameState): PlayerRecord[] {
  return Object.values(state.players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}
