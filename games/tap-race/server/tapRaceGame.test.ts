import { describe, expect, it } from 'vitest'
import { serverReducer, getLeaderboard, initialServerState } from './tapRaceGame'

describe('serverReducer', () => {
  it('démarre en WAITING', () => {
    expect(initialServerState.phase).toBe('WAITING')
  })

  it('PLAYER_JOIN ajoute un joueur en WAITING', () => {
    const next = serverReducer(initialServerState, { type: 'PLAYER_JOIN', id: 'p1', name: 'Alice' })
    expect(next.players['p1']).toEqual({ id: 'p1', name: 'Alice', score: 0 })
  })

  it('PLAYER_JOIN accepté en cours de partie (PLAYING)', () => {
    const s = { ...initialServerState, phase: 'PLAYING' as const, timeLeft: 30, players: {} }
    const next = serverReducer(s, { type: 'PLAYER_JOIN', id: 'p1', name: 'Alice' })
    expect(next.players['p1']).toEqual({ id: 'p1', name: 'Alice', score: 0 })
  })

  it('PLAYER_JOIN ignoré en RESULTS', () => {
    const s = { ...initialServerState, phase: 'RESULTS' as const, players: {} }
    const next = serverReducer(s, { type: 'PLAYER_JOIN', id: 'p1', name: 'Alice' })
    expect(next.players['p1']).toBeUndefined()
  })

  it('WAITING + START → COUNTDOWN 3', () => {
    const next = serverReducer(initialServerState, { type: 'START' })
    expect(next.phase).toBe('COUNTDOWN')
    expect(next.countdown).toBe(3)
  })

  it('PLAYING + TAP_BATCH accumule le score', () => {
    const s = {
      ...initialServerState,
      phase: 'PLAYING' as const, timeLeft: 30,
      players: { p1: { id: 'p1', name: 'Alice', score: 10 } },
    }
    expect(serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 }).players['p1'].score).toBe(15)
  })

  it('TAP_BATCH ignoré hors PLAYING', () => {
    const s = { ...initialServerState, players: { p1: { id: 'p1', name: 'Alice', score: 0 } } }
    expect(serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 }).players['p1'].score).toBe(0)
  })

  it('PLAYING timeLeft=1 + TICK → RESULTS', () => {
    const s = { ...initialServerState, phase: 'PLAYING' as const, timeLeft: 1, players: {} }
    expect(serverReducer(s, { type: 'TICK' }).phase).toBe('RESULTS')
  })
})

describe('getLeaderboard', () => {
  it('retourne le top 10 trié par score décroissant', () => {
    const players = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`p${i}`, { id: `p${i}`, name: `P${i}`, score: i * 10 }]),
    )
    const s = { ...initialServerState, phase: 'PLAYING' as const, timeLeft: 10, players }
    const lb = getLeaderboard(s)
    expect(lb).toHaveLength(10)
    expect(lb[0].score).toBe(110)
    expect(lb[9].score).toBe(20)
  })
})
