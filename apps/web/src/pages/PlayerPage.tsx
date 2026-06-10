/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PlayerView from '@arcade/tap-race/client/PlayerView'
import type { PlayerViewState } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'
import NotFoundPage from './NotFoundPage'

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'
const storageKey = (code: string) => `tap-race-token-${code}`
const nameKey = (code: string) => `tap-race-name-${code}`

export default function PlayerPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [roomExists, setRoomExists] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const tapBuffer = useRef(0)
  const joinedRef = useRef(false)

  // Vérification HTTP : la room existe-t-elle ?
  useEffect(() => {
    if (!code) return
    fetch(`${API}/api/rooms/${code.toUpperCase()}`)
      .then(res => setRoomExists(res.ok))
      .catch(() => setRoomExists(false))
  }, [code])

  // Auto-rejoin si token présent
  useEffect(() => {
    if (!code || roomExists !== true) return
    const existingToken = localStorage.getItem(storageKey(code))
    if (!existingToken) return

    const savedName = localStorage.getItem(nameKey(code))
    if (savedName) setName(savedName)

    const doRejoin = () => {
      socket.emit('REJOIN_ROOM', { code: code.toUpperCase(), token: existingToken })
    }
    const onError = () => {
      localStorage.removeItem(storageKey(code))
      localStorage.removeItem(nameKey(code))
      setJoined(false)
    }
    const onGameState = (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      joinedRef.current = true
      setJoined(true)
    }

    socket.once('ERROR', onError)
    socket.once('GAME_STATE', onGameState)

    if (socket.connected) { doRejoin() }
    else { socket.once('connect', doRejoin); socket.connect() }

    return () => {
      socket.off('ERROR', onError)
      socket.off('GAME_STATE', onGameState)
    }
  }, [code, roomExists])

  // Quitter proprement au démontage du composant
  useEffect(() => {
    return () => {
      if (code && joinedRef.current) {
        socket.emit('LEAVE_ROOM', { code: code.toUpperCase() })
        joinedRef.current = false
      }
    }
  }, [code])

  // Listeners de jeu
  useEffect(() => {
    if (!joined) return
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('SCORE_UPDATE', (d: { score: number }) => setScore(d.score))
    const flush = setInterval(() => {
      if (tapBuffer.current > 0) {
        socket.emit('TAP_BATCH', { count: tapBuffer.current })
        tapBuffer.current = 0
      }
    }, 200)
    return () => {
      socket.off('GAME_STATE')
      socket.off('SCORE_UPDATE')
      clearInterval(flush)
    }
  }, [joined, code])

  function join() {
    const n = name || 'Anonyme'
    const emit = () => socket.emit('JOIN_ROOM', { code: code?.toUpperCase(), name: n })
    socket.once('JOINED', (d: { token: string }) => {
      if (code) {
        localStorage.setItem(storageKey(code), d.token)
        localStorage.setItem(nameKey(code), n)
      }
    })
    socket.once('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      joinedRef.current = true
      setJoined(true)
    })
    if (socket.connected) { emit() }
    else { socket.once('connect', emit); socket.connect() }
  }

  // Chargement
  if (roomExists === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0f0f0f', color: '#555', fontFamily: 'monospace' }}>
        Vérification…
      </div>
    )
  }

  // Room inconnue
  if (roomExists === false) {
    return <NotFoundPage message="Room introuvable ou expirée." />
  }

  // Formulaire de rejointe
  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '1rem', fontFamily: 'monospace', background: '#0f0f0f', color: '#fff' }}>
        <h1 style={{ margin: 0 }}>Tap Race</h1>
        <p style={{ color: '#aaa', margin: 0 }}>Room : <strong style={{ color: '#facc15' }}>{code}</strong></p>
        <input
          placeholder="Votre nom"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && join()}
          style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', textAlign: 'center' }}
        />
        <button
          onClick={join}
          style={{ padding: '0.75rem 2rem', fontSize: '1.1rem', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>
          Rejoindre
        </button>
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
