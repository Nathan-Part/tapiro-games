import { useEffect, useReducer, useRef } from 'react'
import { gameReducer, initialState } from './game'

export default function GamePage() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.phase === 'COUNTDOWN' || state.phase === 'PLAYING') {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [state.phase])

  if (state.phase === 'WAITING') {
    return (
      <div style={s.screen}>
        <h1 style={s.title}>Tap Race</h1>
        <p style={s.sub}>Tapez le plus vite possible pendant 60 secondes</p>
        <button style={s.btn} onClick={() => dispatch({ type: 'START' })}>
          Démarrer
        </button>
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
        <p style={s.score}>{state.score} taps</p>
        <button style={s.tap} onClick={() => dispatch({ type: 'TAP' })}>
          TAP
        </button>
      </div>
    )
  }

  return (
    <div style={s.screen}>
      <h2 style={s.title}>Résultat</h2>
      <p style={s.huge}>{state.score}</p>
      <p style={s.label}>taps en 60 secondes</p>
      <button style={s.btn} onClick={() => dispatch({ type: 'START' })}>
        Rejouer
      </button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh', fontFamily: 'monospace',
    gap: '1.5rem', padding: '1rem', boxSizing: 'border-box',
  },
  title: { fontSize: '2rem', margin: 0 },
  sub: { color: '#666', margin: 0, textAlign: 'center' },
  label: { fontSize: '1.2rem', margin: 0 },
  huge: { fontSize: '6rem', fontWeight: 'bold', margin: 0, lineHeight: 1 },
  score: { fontSize: '2rem', fontWeight: 'bold', margin: 0 },
  timer: { fontSize: '1.5rem', color: '#666', margin: 0 },
  btn: {
    padding: '1rem 2.5rem', fontSize: '1.2rem', borderRadius: '0.5rem',
    border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer',
  },
  tap: {
    width: '80vw', maxWidth: '400px', height: '40vh', fontSize: '3rem',
    fontWeight: 'bold', borderRadius: '1.5rem', border: 'none',
    background: '#dc2626', color: '#fff', cursor: 'pointer',
    touchAction: 'manipulation', userSelect: 'none',
  },
}
