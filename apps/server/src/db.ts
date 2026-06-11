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
  // agrégats calculés en SQL sur tout l'historique (évite Math.max(...n) qui
  // peut déborder la pile), liste limitée pour borner la taille de réponse.
  const agg = db
    .prepare('SELECT COUNT(*) AS gamesPlayed, MAX(score) AS bestScore, AVG(score) AS avgScore FROM scores WHERE name = ?')
    .get(name) as { gamesPlayed: number; bestScore: number | null; avgScore: number | null }
  if (!agg || agg.gamesPlayed === 0) return null
  const history = db
    .prepare('SELECT score, playedAt FROM scores WHERE name = ? ORDER BY playedAt DESC LIMIT 100')
    .all(name) as { score: number; playedAt: string }[]
  return {
    name,
    gamesPlayed: agg.gamesPlayed,
    bestScore: agg.bestScore ?? 0,
    avgScore: Math.round(agg.avgScore ?? 0),
    history,
  }
}
