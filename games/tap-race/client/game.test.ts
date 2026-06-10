import { describe, expect, it } from 'vitest'
import { gameReducer, initialState } from './game'

describe('gameReducer', () => {
  it('démarre en WAITING', () => {
    expect(initialState.phase).toBe('WAITING')
  })

  it('WAITING + START → COUNTDOWN 3', () => {
    const next = gameReducer(initialState, { type: 'START' })
    expect(next.phase).toBe('COUNTDOWN')
    expect(next.countdown).toBe(3)
  })

  it('COUNTDOWN + TICK décrémente le countdown', () => {
    const s = { ...initialState, phase: 'COUNTDOWN' as const, countdown: 3 }
    expect(gameReducer(s, { type: 'TICK' }).countdown).toBe(2)
    expect(gameReducer(s, { type: 'TICK' }).phase).toBe('COUNTDOWN')
  })

  it('COUNTDOWN countdown=1 + TICK → PLAYING timeLeft=60', () => {
    const s = { ...initialState, phase: 'COUNTDOWN' as const, countdown: 1 }
    const next = gameReducer(s, { type: 'TICK' })
    expect(next.phase).toBe('PLAYING')
    expect(next.timeLeft).toBe(60)
  })

  it('PLAYING + TAP incrémente le score', () => {
    const s = { ...initialState, phase: 'PLAYING' as const, timeLeft: 30, score: 0 }
    expect(gameReducer(s, { type: 'TAP' }).score).toBe(1)
  })

  it('TAP ignoré hors PLAYING', () => {
    expect(gameReducer(initialState, { type: 'TAP' }).score).toBe(0)
  })

  it('PLAYING timeLeft=1 + TICK → RESULTS, score conservé', () => {
    const s = { ...initialState, phase: 'PLAYING' as const, timeLeft: 1, score: 42 }
    const next = gameReducer(s, { type: 'TICK' })
    expect(next.phase).toBe('RESULTS')
    expect(next.score).toBe(42)
  })

  it('RESULTS + START → reset WAITING', () => {
    const s = { ...initialState, phase: 'RESULTS' as const, score: 99 }
    const next = gameReducer(s, { type: 'START' })
    expect(next.phase).toBe('WAITING')
    expect(next.score).toBe(0)
  })
})
