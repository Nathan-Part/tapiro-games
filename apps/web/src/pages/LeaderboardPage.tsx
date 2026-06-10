/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ScoreEntry {
  id: number
  name: string
  score: number
  playedAt: string
}

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'}/api/leaderboard`)
      .then(r => r.json())
      .then((data: ScoreEntry[]) => { setScores(data); setLoading(false) })
      .catch(() => { setError('Impossible de charger le classement'); setLoading(false) })
  }, [])

  return (
    <div style={s.screen}>
      <button style={s.back} onClick={() => navigate('/')}>← Retour</button>
      <h1 style={s.title}>Meilleurs scores</h1>
      <p style={s.subtitle}>Top 20 all-time — Tap Race</p>
      {loading && <p style={s.msg}>Chargement…</p>}
      {error && <p style={s.error}>{error}</p>}
      {!loading && !error && scores.length === 0 && (
        <p style={s.msg}>Aucun score enregistré pour l'instant.</p>
      )}
      {scores.length > 0 && (
        <ol style={s.list}>
          {scores.map((entry, i) => (
            <li key={entry.id} style={s.row}>
              <span style={s.rank}>#{i + 1}</span>
              <span style={s.name}>{entry.name}</span>
              <span style={s.score}>{entry.score}</span>
              <span style={s.date}>{new Date(entry.playedAt).toLocaleDateString('fr-FR')}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minHeight: '100dvh', fontFamily: 'monospace', background: '#0f0f0f',
    color: '#fff', padding: '2rem', gap: '1rem', boxSizing: 'border-box',
  },
  back: {
    alignSelf: 'flex-start', background: 'transparent', color: '#aaa',
    border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0.25rem 0',
  },
  title: { fontSize: '2.5rem', margin: 0 },
  subtitle: { color: '#aaa', margin: 0, fontSize: '1rem' },
  msg: { color: '#666', fontSize: '1.2rem' },
  error: { color: '#f87171', fontSize: '1rem' },
  list: {
    listStyle: 'none', padding: 0, margin: 0, width: '100%', maxWidth: '600px',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '0.75rem 1.25rem', background: '#1a1a1a', borderRadius: '0.5rem',
  },
  rank: { color: '#facc15', width: '3rem', textAlign: 'center', fontWeight: 'bold' },
  name: { flex: 1, fontSize: '1.2rem' },
  score: { fontWeight: 'bold', color: '#4ade80', fontSize: '1.4rem', width: '5rem', textAlign: 'right' },
  date: { color: '#555', fontSize: '0.85rem', width: '6rem', textAlign: 'right' },
}
