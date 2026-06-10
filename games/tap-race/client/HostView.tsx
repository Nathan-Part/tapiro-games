import type { HostViewState, LeaderboardEntry } from './types'

interface Props {
  state: HostViewState
  onStart?: () => void
  onViewGlobalLeaderboard?: () => void
}

export default function HostView({ state, onStart, onViewGlobalLeaderboard }: Props) {
  return (
    <div style={s.screen}>
      <Header state={state} onStart={onStart} onViewGlobalLeaderboard={onViewGlobalLeaderboard} />
      <Leaderboard entries={state.leaderboard} />
    </div>
  )
}

function Header({ state, onStart, onViewGlobalLeaderboard }: { state: HostViewState; onStart?: () => void; onViewGlobalLeaderboard?: () => void }) {
  if (state.phase === 'WAITING') {
    return (
      <div style={s.header}>
        <h1 style={s.gameTitle}>Tap Race</h1>
        {onStart && (
          <button style={s.startBtn} onClick={onStart}>
            Démarrer la partie
          </button>
        )}
      </div>
    )
  }
  if (state.phase === 'COUNTDOWN') {
    return (
      <div style={s.header}>
        <p style={s.phaseLabel}>Prêt ?</p>
        <p style={s.countdown}>{state.countdown}</p>
      </div>
    )
  }
  if (state.phase === 'PLAYING') {
    return (
      <div style={s.header}>
        <p style={s.timerBig}>{state.timeLeft}s</p>
        <p style={s.phaseLabel}>EN JEU</p>
      </div>
    )
  }
  return (
    <div style={s.header}>
      <h2 style={s.gameTitle}>Résultats finaux</h2>
      {onViewGlobalLeaderboard && (
        <button style={s.globalBtn} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
    </div>
  )
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return <p style={s.empty}>En attente de joueurs…</p>
  return (
    <ol style={s.list}>
      {entries.map((e, i) => (
        <li key={e.id} style={s.row}>
          <span style={s.rank}>#{i + 1}</span>
          <span style={s.pName}>{e.name}</span>
          <span style={s.pScore}>{e.score}</span>
        </li>
      ))}
    </ol>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minHeight: '100dvh', fontFamily: 'monospace', background: '#0f0f0f',
    color: '#fff', padding: '2rem', gap: '2rem', boxSizing: 'border-box',
  },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' },
  gameTitle: { fontSize: '3rem', margin: 0 },
  phaseLabel: { fontSize: '1.5rem', color: '#aaa', margin: 0, textTransform: 'uppercase' },
  countdown: { fontSize: '10rem', fontWeight: 'bold', margin: 0, lineHeight: 1, color: '#facc15' },
  timerBig: { fontSize: '5rem', fontWeight: 'bold', margin: 0, color: '#4ade80' },
  startBtn: {
    padding: '1rem 3rem', fontSize: '1.5rem', borderRadius: '0.75rem',
    border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer',
  },
  empty: { color: '#666', fontSize: '1.2rem' },
  list: {
    listStyle: 'none', padding: 0, margin: 0, width: '100%', maxWidth: '800px',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1rem 1.5rem', background: '#1a1a1a', borderRadius: '0.75rem', fontSize: '1.5rem',
  },
  rank: { color: '#facc15', width: '3rem', textAlign: 'center', fontWeight: 'bold' },
  pName: { flex: 1 },
  pScore: { fontWeight: 'bold', color: '#4ade80', fontSize: '1.8rem' },
  globalBtn: {
    padding: '1rem 2.5rem', fontSize: '1.2rem', borderRadius: '0.5rem',
    border: '1px solid #4ade80', background: 'transparent', color: '#4ade80',
    cursor: 'pointer',
  },
}
