import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, saveResults, getTopScores, getPlayerStats } from './db'

describe('db', () => {
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns empty array when no scores saved', () => {
    expect(getTopScores(db)).toEqual([])
  })

  it('saves results and retrieves them ordered by score desc', () => {
    saveResults(db, 'sess-1', 1, [
      { name: 'Alice', score: 120 },
      { name: 'Bob', score: 85 },
    ])
    const top = getTopScores(db)
    expect(top[0]).toMatchObject({ name: 'Alice', score: 120 })
    expect(top[1]).toMatchObject({ name: 'Bob', score: 85 })
  })

  it('returns at most 20 entries', () => {
    const players = Array.from({ length: 25 }, (_, i) => ({ name: `P${i}`, score: i }))
    saveResults(db, 'sess-2', 1, players)
    expect(getTopScores(db).length).toBe(20)
  })

  it('top 20 are sorted by score descending across multiple games', () => {
    saveResults(db, 'sess-3', 1, [{ name: 'Low', score: 10 }])
    saveResults(db, 'sess-4', 1, [{ name: 'High', score: 200 }])
    const top = getTopScores(db)
    expect(top[0].name).toBe('High')
  })

  it('each entry has id, name, score, playedAt fields', () => {
    saveResults(db, 'sess-5', 1, [{ name: 'Alice', score: 50 }])
    const [entry] = getTopScores(db)
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('name')
    expect(entry).toHaveProperty('score')
    expect(entry).toHaveProperty('playedAt')
  })

  it('getPlayerStats groupe par session et retourne les rounds', () => {
    saveResults(db, 'sess-A', 1, [{ name: 'Alice', score: 50 }])
    saveResults(db, 'sess-A', 2, [{ name: 'Alice', score: 70 }])
    saveResults(db, 'sess-B', 1, [{ name: 'Alice', score: 30 }])
    const stats = getPlayerStats(db, 'Alice')!
    expect(stats.gamesPlayed).toBe(2)
    expect(stats.sessions).toHaveLength(2)
    const sessA = stats.sessions.find(s => s.sessionId === 'sess-A')!
    expect(sessA.rounds).toHaveLength(2)
    expect(sessA.total).toBe(120)
  })

  it('getPlayerStats retourne null pour un joueur inconnu', () => {
    expect(getPlayerStats(db, 'Inconnu')).toBeNull()
  })
})
