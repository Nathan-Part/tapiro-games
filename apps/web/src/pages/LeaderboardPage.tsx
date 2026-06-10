/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'

interface ScoreEntry {
  id: number
  name: string
  score: number
  playedAt: string
}

interface PlayerStats {
  name: string
  gamesPlayed: number
  bestScore: number
  avgScore: number
  history: { score: number; playedAt: string }[]
}

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<PlayerStats | null>(null)
  const [loadingPlayer, setLoadingPlayer] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/leaderboard`)
      .then(r => r.json())
      .then((data: ScoreEntry[]) => { setScores(data); setLoading(false) })
      .catch(() => { setError('Impossible de charger le classement'); setLoading(false) })
  }, [])

  async function openProfile(name: string) {
    setLoadingPlayer(true)
    try {
      const res = await fetch(`${API}/api/players/${encodeURIComponent(name)}`)
      const data: PlayerStats = await res.json()
      setSelected(data)
    } finally {
      setLoadingPlayer(false)
    }
  }

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
            <li key={entry.id} style={s.row} onClick={() => openProfile(entry.name)}>
              <span style={s.rank}>#{i + 1}</span>
              <span style={s.name}>{entry.name}</span>
              <span style={s.score}>{entry.score}</span>
              <span style={s.date}>{new Date(entry.playedAt).toLocaleDateString('fr-FR')}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Popup profil */}
      {(selected || loadingPlayer) && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            {loadingPlayer && <p style={{ color: '#aaa', margin: 0 }}>Chargement…</p>}
            {selected && (
              <>
                <div style={s.modalHeader}>
                  <h2 style={s.modalName}>{selected.name}</h2>
                  <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
                </div>
                <div style={s.stats}>
                  <div style={s.stat}>
                    <span style={s.statVal}>{selected.bestScore}</span>
                    <span style={s.statLabel}>Meilleur score</span>
                  </div>
                  <div style={s.stat}>
                    <span style={s.statVal}>{selected.gamesPlayed}</span>
                    <span style={s.statLabel}>Parties jouées</span>
                  </div>
                  <div style={s.stat}>
                    <span style={s.statVal}>{selected.avgScore}</span>
                    <span style={s.statLabel}>Moyenne</span>
                  </div>
                </div>
                <p style={s.histTitle}>Historique</p>
                <ul style={s.histList}>
                  {selected.history.map((h, i) => (
                    <li key={i} style={s.histRow}>
                      <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{h.score}</span>
                      <span style={{ color: '#555', fontSize: '0.85rem' }}>
                        {new Date(h.playedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
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
    cursor: 'pointer',
  },
  rank: { color: '#facc15', width: '3rem', textAlign: 'center', fontWeight: 'bold' },
  name: { flex: 1, fontSize: '1.2rem' },
  score: { fontWeight: 'bold', color: '#4ade80', fontSize: '1.4rem', width: '5rem', textAlign: 'right' },
  date: { color: '#555', fontSize: '0.85rem', width: '6rem', textAlign: 'right' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#1a1a1a', borderRadius: 12, padding: '1.5rem',
    width: '100%', maxWidth: '400px', maxHeight: '80dvh',
    display: 'flex', flexDirection: 'column', gap: '1rem',
    boxSizing: 'border-box', overflowY: 'auto',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalName: { margin: 0, fontSize: '1.5rem', color: '#facc15' },
  closeBtn: {
    background: 'transparent', border: 'none', color: '#888',
    cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem',
  },
  stats: { display: 'flex', gap: '1rem', justifyContent: 'space-around' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' },
  statVal: { fontSize: '1.8rem', fontWeight: 'bold', color: '#4ade80' },
  statLabel: { fontSize: '0.75rem', color: '#888' },
  histTitle: { margin: 0, color: '#aaa', fontSize: '0.9rem' },
  histList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  histRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0.75rem', background: '#0f0f0f', borderRadius: 6,
  },
}
