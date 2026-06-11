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
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId  TEXT    NOT NULL DEFAULT '',
      round      INTEGER NOT NULL DEFAULT 1,
      name       TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      playedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  // Migration : ajouter les colonnes si elles n'existent pas (SQLite)
  const cols = (db.prepare("PRAGMA table_info(scores)").all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('sessionId')) db.exec("ALTER TABLE scores ADD COLUMN sessionId TEXT NOT NULL DEFAULT ''")
  if (!cols.includes('round')) db.exec("ALTER TABLE scores ADD COLUMN round INTEGER NOT NULL DEFAULT 1")
  return db
}

export function saveResults(
  db: Database.Database,
  sessionId: string,
  round: number,
  players: { name: string; score: number }[],
): void {
  const insert = db.prepare('INSERT INTO scores (sessionId, round, name, score) VALUES (?, ?, ?, ?)')
  const insertMany = db.transaction((rows: { name: string; score: number }[]) => {
    for (const row of rows) insert.run(sessionId, round, row.name, row.score)
  })
  insertMany(players)
}

export function getTopScores(db: Database.Database): ScoreEntry[] {
  return db
    .prepare('SELECT id, name, score, playedAt FROM scores ORDER BY score DESC LIMIT 20')
    .all() as ScoreEntry[]
}

export interface RoundResult {
  round: number
  score: number
}

export interface SessionEntry {
  sessionId: string
  playedAt: string
  rounds: RoundResult[]
  total: number
}

export interface PlayerStats {
  name: string
  gamesPlayed: number
  bestScore: number
  avgScore: number
  sessions: SessionEntry[]
}

export function getPlayerStats(db: Database.Database, name: string): PlayerStats | null {
  const agg = db
    .prepare('SELECT COUNT(*) AS cnt, MAX(score) AS bestScore, AVG(score) AS avgScore FROM scores WHERE name = ?')
    .get(name) as { cnt: number; bestScore: number | null; avgScore: number | null }
  if (!agg || agg.cnt === 0) return null

  // Toutes les entrées triées par date desc — on regroupe ensuite par sessionId
  const rows = db
    .prepare("SELECT sessionId, round, score, playedAt FROM scores WHERE name = ? ORDER BY playedAt DESC LIMIT 300")
    .all(name) as { sessionId: string; round: number; score: number; playedAt: string }[]

  // Regrouper par session (conserver l'ordre chronologique inversé de la première apparition)
  const map = new Map<string, { playedAt: string; rounds: RoundResult[] }>()
  for (const row of rows) {
    const key = row.sessionId || `solo-${row.playedAt}` // ancien data sans sessionId
    if (!map.has(key)) map.set(key, { playedAt: row.playedAt, rounds: [] })
    map.get(key)!.rounds.push({ round: row.round, score: row.score })
  }

  const sessions: SessionEntry[] = [...map.entries()]
    .slice(0, 50)
    .map(([sessionId, { playedAt, rounds }]) => {
      const sorted = [...rounds].sort((a, b) => a.round - b.round)
      return { sessionId, playedAt, rounds: sorted, total: sorted.reduce((s, r) => s + r.score, 0) }
    })

  return {
    name,
    gamesPlayed: sessions.length,
    bestScore: agg.bestScore ?? 0,
    avgScore: Math.round(agg.avgScore ?? 0),
    sessions,
  }
}
