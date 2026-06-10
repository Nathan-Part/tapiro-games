import type { PlayerViewState } from './types'

interface Props {
  state: PlayerViewState
  onTap: () => void
  onViewGlobalLeaderboard?: () => void
}

export default function PlayerView({ state, onTap, onViewGlobalLeaderboard }: Props) {
  if (state.phase === 'WAITING') {
    const players = state.waitingPlayers ?? []
    const total = state.totalPlayers ?? players.length
    return (
      <div style={s.screen}>
        <h2 style={s.title}>Tap Race</h2>
        <p style={s.label}>En attente du démarrage…</p>
        <p style={s.name}>{state.playerName}</p>
        {total > 0 && (
          <div style={s.lobby}>
            <p style={s.lobbyCount}>{total} joueur{total > 1 ? 's' : ''} connecté{total > 1 ? 's' : ''}</p>
            <ul style={s.lobbyList}>
              {players.map(p => (
                <li key={p.id} style={{ ...s.lobbyItem, fontWeight: p.name === state.playerName ? 'bold' : 'normal', color: p.name === state.playerName ? '#facc15' : '#ccc' }}>
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (state.phase === 'COUNTDOWN') {
    return (
      <div style={s.screen}>
        <p style={s.label}>Prêt ?</p>
        <p style={s.huge}>{state.countdown}</p>
      </div>
    )
  }

  if (state.phase === 'PLAYING') {
    return (
      <div style={s.screen}>
        <p style={s.timer}>{state.timeLeft}s</p>
        <p style={s.score}>{state.score}</p>
        <button style={s.tap} onClick={onTap}>TAP</button>
      </div>
    )
  }

  return (
    <div style={s.screen}>
      <h2 style={s.title}>Terminé !</h2>
      <p style={s.huge}>{state.score}</p>
      <p style={s.label}>taps</p>
      {onViewGlobalLeaderboard && (
        <button style={s.globalBtn} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh', fontFamily: 'monospace',
    gap: '1rem', padding: '1rem', background: '#0f0f0f', color: '#fff',
    boxSizing: 'border-box',
  },
  title: { fontSize: '1.8rem', margin: 0 },
  label: { fontSize: '1.1rem', color: '#aaa', margin: 0 },
  name: { fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa', margin: 0 },
  huge: { fontSize: '7rem', fontWeight: 'bold', margin: 0, lineHeight: 1 },
  score: { fontSize: '4rem', fontWeight: 'bold', margin: 0 },
  timer: { fontSize: '1.5rem', color: '#aaa', margin: 0 },
  tap: {
    width: '80vw', maxWidth: '380px', height: '42vh', fontSize: '3.5rem',
    fontWeight: 'bold', borderRadius: '2rem', border: 'none',
    background: '#dc2626', color: '#fff', cursor: 'pointer',
    touchAction: 'manipulation', userSelect: 'none',
    boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
  },
  lobby: {
    width: '100%', maxWidth: '320px', background: '#1a1a1a',
    borderRadius: 10, padding: '0.75rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  lobbyCount: { margin: 0, fontSize: '0.8rem', color: '#888', textAlign: 'center' as const },
  lobbyList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '0.3rem',
    maxHeight: '40vh', overflowY: 'auto' as const,
  },
  lobbyItem: { fontSize: '1rem', padding: '0.2rem 0.4rem' },
  globalBtn: {
    padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: '0.5rem',
    border: '1px solid #4ade80', background: 'transparent', color: '#4ade80',
    cursor: 'pointer', marginTop: '0.5rem',
  },
}
