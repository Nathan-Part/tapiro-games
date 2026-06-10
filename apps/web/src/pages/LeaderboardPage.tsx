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

const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)']

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

  const best = scores.length > 0 ? scores[0].score : 0

  return (
    <div className="arc-screen arc-screen--top">
      <div className="arc-ambient" aria-hidden="true" />
      <main className="arc-content" style={{ gap: '0.9rem', maxWidth: 640, paddingTop: '1rem' }}>
        <button className="arc-btn arc-btn-ghost arc-btn--sm arc-rise" style={s.back} onClick={() => navigate('/')}>
          ← Retour
        </button>
        <p className="arc-kicker arc-rise">/// hall of fame ///</p>
        <h1 className="arc-logo arc-rise" style={{ ...s.title, '--d': '80ms' } as React.CSSProperties}>
          Meilleurs scores
        </h1>
        <p className="arc-hint arc-rise" style={{ '--d': '160ms' } as React.CSSProperties}>
          Top 20 all-time — Tap Race
        </p>

        {loading && <div className="arc-spinner" style={{ marginTop: '2rem' }} />}
        {error && <p className="arc-error">{error}</p>}
        {!loading && !error && scores.length === 0 && (
          <p className="arc-hint" style={{ marginTop: '2rem' }}>Aucun score enregistré pour l'instant.</p>
        )}

        {scores.length > 0 && (
          <ol style={s.list}>
            {scores.map((entry, i) => (
              <li
                key={entry.id}
                className="arc-row arc-row--click arc-rise"
                style={{ ...s.row, '--d': `${200 + i * 50}ms` } as React.CSSProperties}
                onClick={() => openProfile(entry.name)}
              >
                <span style={{ ...s.rank, color: RANK_COLORS[i] ?? 'var(--ink-faint)' }}>
                  {i + 1 <= 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                </span>
                <span style={s.name}>{entry.name}</span>
                <span style={s.score}>{entry.score}</span>
                <span style={s.date}>{new Date(entry.playedAt).toLocaleDateString('fr-FR')}</span>
                <div style={{ ...s.bar, width: `${best > 0 ? Math.max(4, (entry.score / best) * 100) : 0}%` }} aria-hidden="true" />
              </li>
            ))}
          </ol>
        )}

        {/* Popup profil */}
        {(selected || loadingPlayer) && (
          <div className="arc-overlay" onClick={() => setSelected(null)}>
            <div className="arc-modal" onClick={e => e.stopPropagation()}>
              {loadingPlayer && <div className="arc-spinner" style={{ alignSelf: 'center' }} />}
              {selected && (
                <>
                  <div style={s.modalHeader}>
                    <h2 style={s.modalName}>{selected.name}</h2>
                    <button className="arc-btn arc-btn-ghost arc-btn--sm" onClick={() => setSelected(null)}>✕</button>
                  </div>
                  <div style={s.stats}>
                    <div style={s.stat}>
                      <span style={s.statVal}>{selected.bestScore}</span>
                      <span className="arc-label" style={s.statLabel}>Meilleur</span>
                    </div>
                    <div style={s.stat}>
                      <span style={s.statVal}>{selected.gamesPlayed}</span>
                      <span className="arc-label" style={s.statLabel}>Parties</span>
                    </div>
                    <div style={s.stat}>
                      <span style={s.statVal}>{selected.avgScore}</span>
                      <span className="arc-label" style={s.statLabel}>Moyenne</span>
                    </div>
                  </div>
                  <p className="arc-label">Historique</p>
                  <ul style={s.histList}>
                    {selected.history.map((h, i) => (
                      <li key={i} style={s.histRow}>
                        <span style={s.histScore}>{h.score}</span>
                        <span style={s.histDate}>
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
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  back: { alignSelf: 'flex-start' },
  title: { fontSize: 'clamp(1.6rem, 6vw, 2.6rem)', textAlign: 'center' },
  list: {
    listStyle: 'none', padding: 0, margin: '1rem 0 0', width: '100%',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  row: { position: 'relative', overflow: 'hidden' },
  rank: {
    width: '3rem', textAlign: 'center', fontWeight: 700,
    fontFamily: 'var(--font-display)', fontSize: '1.05rem', zIndex: 1,
  },
  name: { flex: 1, fontSize: '1.1rem', fontWeight: 600, zIndex: 1 },
  score: {
    fontWeight: 700, color: 'var(--cyan)', fontSize: '1.35rem', width: '5rem',
    textAlign: 'right', fontFamily: 'var(--font-display)',
    textShadow: '0 0 12px rgba(0, 245, 255, 0.45)', zIndex: 1,
  },
  date: { color: 'var(--ink-faint)', fontSize: '0.8rem', width: '6rem', textAlign: 'right', zIndex: 1 },
  bar: {
    position: 'absolute', left: 0, bottom: 0, height: '100%',
    background: 'linear-gradient(90deg, rgba(123, 47, 255, 0.13), rgba(0, 245, 255, 0.07))',
    borderRight: '1px solid rgba(0, 245, 255, 0.25)',
    transition: 'width 0.8s var(--ease-out)',
    pointerEvents: 'none',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalName: {
    margin: 0, fontSize: '1.5rem', color: '#fff', fontFamily: 'var(--font-display)',
    letterSpacing: '0.06em', textShadow: '0 0 16px rgba(0, 245, 255, 0.6)',
  },
  stats: { display: 'flex', gap: '1rem', justifyContent: 'space-around' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' },
  statVal: {
    fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-display)',
    color: 'var(--cyan)', textShadow: '0 0 14px rgba(0, 245, 255, 0.5)',
  },
  statLabel: { fontSize: '0.62rem' },
  histList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  histRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.55rem 0.85rem', background: 'rgba(2, 2, 8, 0.6)',
    border: '1px solid rgba(0, 245, 255, 0.08)', borderRadius: 9,
  },
  histScore: { color: 'var(--cyan)', fontWeight: 700, fontFamily: 'var(--font-display)' },
  histDate: { color: 'var(--ink-faint)', fontSize: '0.82rem' },
}
