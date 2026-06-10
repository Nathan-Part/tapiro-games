import type { PlayerViewState } from './types'

interface Props {
  state: PlayerViewState
  onTap: () => void
}

export default function PlayerView({ state, onTap }: Props) {
  if (state.phase === 'WAITING') {
    return (
      <div style={s.screen}>
        <h2 style={s.title}>Tap Race</h2>
        <p style={s.label}>En attente du démarrage…</p>
        <p style={s.name}>{state.playerName}</p>
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
}
