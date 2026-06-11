import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
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
    saveResults(db, [
      { name: 'Alice', score: 120 },
      { name: 'Bob', score: 85 },
    ])
    const top = getTopScores(db)
    expect(top[0]).toMatchObject({ name: 'Alice', score: 120 })
    expect(top[1]).toMatchObject({ name: 'Bob', score: 85 })
  })

  it('returns at most 20 entries', () => {
    const players = Array.from({ length: 25 }, (_, i) => ({ name: `P${i}`, score: i }))
    saveResults(db, players)
    expect(getTopScores(db).length).toBe(20)
  })

  it('top 20 are sorted by score descending across multiple games', () => {
    saveResults(db, [{ name: 'Low', score: 10 }])
    saveResults(db, [{ name: 'High', score: 200 }])
    const top = getTopScores(db)
    expect(top[0].name).toBe('High')
  })

  it('each entry has id, name, score, playedAt fields', () => {
    saveResults(db, [{ name: 'Alice', score: 50 }])
    const [entry] = getTopScores(db)
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('name')
    expect(entry).toHaveProperty('score')
    expect(entry).toHaveProperty('playedAt')
  })

  it('getPlayerStats agrège sur tout l’historique mais limite la liste à 100', () => {
    for (let i = 0; i < 150; i++) saveResults(db, [{ name: 'Alice', score: i }])
    const stats = getPlayerStats(db, 'Alice')!
    expect(stats.gamesPlayed).toBe(150)
    expect(stats.bestScore).toBe(149)
    expect(stats.history.length).toBeLessThanOrEqual(100)
  })

  it('getPlayerStats retourne null pour un joueur inconnu', () => {
    expect(getPlayerStats(db, 'Inconnu')).toBeNull()
  })
})
