export type Phase = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS'

export interface GameState {
  phase: Phase
  countdown: number
  timeLeft: number
  score: number
}

export type GameEvent = { type: 'START' } | { type: 'TICK' } | { type: 'TAP' }

export const initialState: GameState = {
  phase: 'WAITING',
  countdown: 3,
  timeLeft: 60,
  score: 0,
}

export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (state.phase) {
    case 'WAITING':
      if (event.type === 'START') return { ...state, phase: 'COUNTDOWN', countdown: 3 }
      return state

    case 'COUNTDOWN':
      if (event.type === 'TICK') {
        if (state.countdown <= 1) return { ...state, phase: 'PLAYING', timeLeft: 60 }
        return { ...state, countdown: state.countdown - 1 }
      }
      return state

    case 'PLAYING':
      if (event.type === 'TICK') {
        if (state.timeLeft <= 1) return { ...state, phase: 'RESULTS' }
        return { ...state, timeLeft: state.timeLeft - 1 }
      }
      if (event.type === 'TAP') return { ...state, score: state.score + 1 }
      return state

    case 'RESULTS':
      if (event.type === 'START') return { ...initialState }
      return state

    default:
      return state
  }
}
