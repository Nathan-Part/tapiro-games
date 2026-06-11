import { describe, expect, it } from 'vitest'
import { serverReducer, getLeaderboard, makeInitialState, initialServerState } from './tapRaceGame'

const playing = (overrides = {}) => ({
  ...makeInitialState(),
  phase: 'PLAYING' as const,
  timeLeft: 30,
  players: {},
  ...overrides,
})

const withPlayer = (state: ReturnType<typeof playing>, id = 'p1', score = 0) => ({
  ...state,
  players: { ...state.players, [id]: { id, name: id, score, eliminated: false, ticksSinceLastTap: 0 } },
})

describe('serverReducer', () => {
  it('démarre en WAITING', () => {
    expect(initialServerState.phase).toBe('WAITING')
  })

  it('PLAYER_JOIN ajoute un joueur en WAITING', () => {
    const next = serverReducer(initialServerState, { type: 'PLAYER_JOIN', id: 'p1', name: 'Alice' })
    expect(next.players['p1']).toMatchObject({ id: 'p1', name: 'Alice', score: 0, eliminated: false })
  })

  it('PLAYER_JOIN accepté en cours de partie (PLAYING)', () => {
    const s = playing()
    const next = serverReducer(s, { type: 'PLAYER_JOIN', id: 'p1', name: 'Alice' })
    expect(next.players['p1']).toMatchObject({ id: 'p1', name: 'Alice', score: 0 })
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
    const s = withPlayer(playing(), 'p1', 10)
    expect(serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 }).players['p1'].score).toBe(15)
  })

  it('TAP_BATCH ignoré hors PLAYING', () => {
    const s = { ...initialServerState, players: { p1: { id: 'p1', name: 'Alice', score: 0, eliminated: false, ticksSinceLastTap: 0 } } }
    expect(serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 }).players['p1'].score).toBe(0)
  })

  it('PLAYING timeLeft=1 + TICK → RESULTS', () => {
    const s = { ...playing(), timeLeft: 1 }
    expect(serverReducer(s, { type: 'TICK' }).phase).toBe('RESULTS')
  })

  // ── Golden Tap ──────────────────────────────────────────────
  it('FRENZY_START active la frenzy uniquement en PLAYING', () => {
    const s = withPlayer(playing())
    const frenzy = serverReducer(s, { type: 'FRENZY_START' })
    expect(frenzy.frenzy).toBe(true)
    const waiting = serverReducer(initialServerState, { type: 'FRENZY_START' })
    expect(waiting.frenzy).toBe(false)
  })

  it('FRENZY_END désactive la frenzy', () => {
    const s = { ...withPlayer(playing()), frenzy: true }
    expect(serverReducer(s, { type: 'FRENZY_END' }).frenzy).toBe(false)
  })

  it('TAP_BATCH × 2 en mode frenzy', () => {
    const s = { ...withPlayer(playing(), 'p1', 0), frenzy: true }
    const next = serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 })
    expect(next.players['p1'].score).toBe(10)
  })

  it('RESULTS désactive la frenzy (via TICK)', () => {
    const s = { ...withPlayer(playing()), frenzy: true, timeLeft: 1 }
    expect(serverReducer(s, { type: 'TICK' }).frenzy).toBe(false)
  })

  // ── Décroissance du score ────────────────────────────────────
  it('score ne décroit pas avant DECAY_GRACE ticks', () => {
    let s = withPlayer(playing(), 'p1', 10)
    // 3 ticks = grace period
    for (let i = 0; i < 3; i++) s = serverReducer(s, { type: 'TICK' })
    expect(s.players['p1'].score).toBe(10)
  })

  it('score décroit de 1 après DECAY_GRACE ticks sans tap', () => {
    let s = withPlayer(playing(), 'p1', 10)
    for (let i = 0; i < 4; i++) s = serverReducer(s, { type: 'TICK' })
    expect(s.players['p1'].score).toBe(9)
  })

  it('tap remet à zéro le compteur de décroissance', () => {
    let s = withPlayer(playing(), 'p1', 10)
    for (let i = 0; i < 3; i++) s = serverReducer(s, { type: 'TICK' })
    s = serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 1 })
    for (let i = 0; i < 3; i++) s = serverReducer(s, { type: 'TICK' })
    expect(s.players['p1'].score).toBe(11) // 10 + 1 tap, no decay yet
  })

  it('score ne passe pas en négatif', () => {
    let s = withPlayer(playing(), 'p1', 1)
    for (let i = 0; i < 10; i++) s = serverReducer(s, { type: 'TICK' })
    expect(s.players['p1'].score).toBeGreaterThanOrEqual(0)
  })

  // ── Plusieurs manches ────────────────────────────────────────
  it('makeInitialState avec totalRounds=3', () => {
    const s = makeInitialState(3)
    expect(s.totalRounds).toBe(3)
    expect(s.currentRound).toBe(1)
  })

  it('NEXT_ROUND avance la manche et remet les scores à zéro', () => {
    let s = { ...makeInitialState(2), phase: 'RESULTS' as const }
    s = { ...s, players: { p1: { id: 'p1', name: 'A', score: 50, eliminated: false, ticksSinceLastTap: 5 } } }
    const next = serverReducer(s, { type: 'NEXT_ROUND' })
    expect(next.currentRound).toBe(2)
    expect(next.phase).toBe('COUNTDOWN')
    expect(next.players['p1'].score).toBe(0)
    expect(next.players['p1'].eliminated).toBe(false)
  })

  it('NEXT_ROUND ignoré si déjà à la dernière manche', () => {
    const s = { ...makeInitialState(2), phase: 'RESULTS' as const, currentRound: 2 }
    expect(serverReducer(s, { type: 'NEXT_ROUND' }).phase).toBe('RESULTS')
  })

  // ── Mode Survie ──────────────────────────────────────────────
  it('ELIMINATE marque les joueurs comme éliminés', () => {
    const s = withPlayer(withPlayer(playing(), 'p1'), 'p2')
    const next = serverReducer(s, { type: 'ELIMINATE', ids: ['p1'] })
    expect(next.players['p1'].eliminated).toBe(true)
    expect(next.players['p2'].eliminated).toBe(false)
  })

  it('TAP_BATCH ignoré pour un joueur éliminé', () => {
    const s = { ...withPlayer(playing(), 'p1', 10), players: { p1: { id: 'p1', name: 'A', score: 10, eliminated: true, ticksSinceLastTap: 0 } } }
    expect(serverReducer(s, { type: 'TAP_BATCH', playerId: 'p1', count: 5 }).players['p1'].score).toBe(10)
  })

  // ── Tir à la corde (FORCE_END) ───────────────────────────────
  it('FORCE_END termine la partie en PLAYING', () => {
    expect(serverReducer(playing(), { type: 'FORCE_END' }).phase).toBe('RESULTS')
  })

  it('FORCE_END ignoré hors PLAYING', () => {
    expect(serverReducer(initialServerState, { type: 'FORCE_END' }).phase).toBe('WAITING')
  })
})

describe('getLeaderboard', () => {
  it('retourne le top 10 trié par score décroissant', () => {
    const players = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`p${i}`, { id: `p${i}`, name: `P${i}`, score: i * 10, eliminated: false, ticksSinceLastTap: 0 }]),
    )
    const s = { ...makeInitialState(), phase: 'PLAYING' as const, timeLeft: 10, players }
    const lb = getLeaderboard(s)
    expect(lb).toHaveLength(10)
    expect(lb[0].score).toBe(110)
    expect(lb[9].score).toBe(20)
  })
})
