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
