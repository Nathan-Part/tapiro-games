import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PlayerView from '@arcade/tap-race/client/PlayerView'
import type { PlayerViewState } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'

const storageKey = (code: string) => `tap-race-token-${code}`

export default function PlayerPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const tapBuffer = useRef(0)

  // Auto-rejoin if token exists for this room
  useEffect(() => {
    if (!code) return
    const existingToken = localStorage.getItem(storageKey(code))
    if (!existingToken) return
    socket.connect()
    const onConnect = () => {
      socket.emit('REJOIN_ROOM', { code: code.toUpperCase(), token: existingToken })
    }
    const onError = () => {
      localStorage.removeItem(storageKey(code))
      setJoined(false)
    }
    const onGameState = () => {
      setJoined(true)
    }
    socket.once('connect', onConnect)
    socket.once('ERROR', onError)
    socket.once('GAME_STATE', onGameState)
    return () => {
      socket.off('connect', onConnect)
      socket.off('ERROR', onError)
      socket.off('GAME_STATE', onGameState)
    }
  }, [code])

  // Register game event listeners once joined
  useEffect(() => {
    if (!joined) return
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('SCORE_UPDATE', (d: { score: number }) => setScore(d.score))
    socket.on('JOINED', (d: { token: string }) => {
      if (code) localStorage.setItem(storageKey(code), d.token)
    })
    const flush = setInterval(() => {
      if (tapBuffer.current > 0) {
        socket.emit('TAP_BATCH', { count: tapBuffer.current })
        tapBuffer.current = 0
      }
    }, 200)
    return () => {
      socket.off('GAME_STATE')
      socket.off('SCORE_UPDATE')
      socket.off('JOINED')
      clearInterval(flush)
    }
  }, [joined, code])

  function join() {
    setErrorMsg('')
    socket.connect()
    socket.once('connect', () => {
      socket.emit('JOIN_ROOM', { code: code?.toUpperCase(), name: name || 'Anonyme' })
    })
    socket.once('ERROR', (d: { message: string }) => {
      setErrorMsg(d.message ?? 'Room introuvable')
    })
    socket.once('JOINED', () => {
      setJoined(true)
    })
  }

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '1rem', fontFamily: 'monospace', background: '#0f0f0f', color: '#fff' }}>
        <h1 style={{ margin: 0 }}>Tap Race</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Room : <strong style={{ color: '#facc15' }}>{code}</strong></p>
        <input placeholder="Votre nom" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
          style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', textAlign: 'center' }} />
        <button onClick={join}
          style={{ padding: '0.75rem 2rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>
          Rejoindre
        </button>
        {errorMsg && (
          <div style={{ color: '#f87171', fontSize: '1rem', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem' }}>{errorMsg}</p>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>
              ← Retour à l'accueil
            </button>
          </div>
        )}
      </div>
    )
  }

  const state: PlayerViewState = { phase, countdown, timeLeft, score, playerName: name || 'Anonyme' }
  return (
    <PlayerView
      state={state}
      onTap={() => { tapBuffer.current += 1 }}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
    />
  )
}
