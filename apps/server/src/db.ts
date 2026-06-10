import Database from 'better-sqlite3'

export type DbHandle = Database.Database

export interface ScoreEntry {
  id: number
  name: string
  score: number
  playedAt: string
}

export function createDb(path: string): Database.Database {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT    NOT NULL,
      score    INTEGER NOT NULL,
      playedAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return db
}

export function saveResults(
  db: Database.Database,
  players: { name: string; score: number }[],
): void {
  const insert = db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)')
  const insertMany = db.transaction((rows: { name: string; score: number }[]) => {
    for (const row of rows) insert.run(row.name, row.score)
  })
  insertMany(players)
}

export function getTopScores(db: Database.Database): ScoreEntry[] {
  return db
    .prepare('SELECT id, name, score, playedAt FROM scores ORDER BY score DESC LIMIT 20')
    .all() as ScoreEntry[]
}

export interface PlayerStats {
  name: string
  gamesPlayed: number
  bestScore: number
  avgScore: number
  history: { score: number; playedAt: string }[]
}

export function getPlayerStats(db: Database.Database, name: string): PlayerStats | null {
  const rows = db
    .prepare('SELECT score, playedAt FROM scores WHERE name = ? ORDER BY playedAt DESC')
    .all(name) as { score: number; playedAt: string }[]
  if (rows.length === 0) return null
  const scores = rows.map(r => r.score)
  return {
    name,
    gamesPlayed: rows.length,
    bestScore: Math.max(...scores),
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    history: rows,
  }
}
