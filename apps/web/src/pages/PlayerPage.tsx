/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PlayerView from '@arcade/tap-race/client/PlayerView'
import type { PlayerViewState, RoundSnapshot, TeamScore } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'
import NotFoundPage from './NotFoundPage'
import ParticleField from '../components/ParticleField'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'
const storageKey = (code: string) => `tap-race-token-${code}`
const nameKey = (code: string) => `tap-race-name-${code}`

export default function PlayerPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [roomInfo, setRoomInfo] = useState<{ exists: boolean; mode: string; teams: { id: string; name: string; color: string }[] } | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teams, setTeams] = useState<TeamScore[]>([])
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [waitingPlayers, setWaitingPlayers] = useState<{ id: string; name: string; teamId?: string }[]>([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [frenzy, setFrenzy] = useState(false)
  const [eliminated, setEliminated] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [totalScore, setTotalScore] = useState<number | undefined>(undefined)
  const [gameDuration, setGameDuration] = useState(60)
  const [ropePosition, setRopePosition] = useState<number | undefined>(undefined)
  const [connected, setConnected] = useState(true)
  const [roundSnapshots, setRoundSnapshots] = useState<RoundSnapshot[]>([])
  const phaseRef = useRef<Phase>('WAITING')
  const currentRoundRef = useRef(1)
  const frenzyRef = useRef(false)
  const tapBuffer = useRef(0)
  const joinedRef = useRef(false)

  // Vérification HTTP : la room existe-t-elle ?
  useEffect(() => {
    if (!code) return
    fetch(`${API}/api/rooms/${code.toUpperCase()}`)
      .then(r => r.json())
      .then((data: { exists: boolean; mode: string; teams: { id: string; name: string; color: string }[] }) => setRoomInfo(data))
      .catch(() => setRoomInfo({ exists: false, mode: 'solo', teams: [] }))
  }, [code])

  // Auto-rejoin si token présent
  useEffect(() => {
    if (!code || roomInfo?.exists !== true) return
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
    const onGameState = (d: { phase: Phase; countdown?: number; timeLeft?: number; frenzy?: boolean; currentRound?: number; totalRounds?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      if (d.frenzy !== undefined) setFrenzy(d.frenzy)
      if (d.currentRound !== undefined) setCurrentRound(d.currentRound)
      if (d.totalRounds !== undefined) setTotalRounds(d.totalRounds)
      joinedRef.current = true
      setJoined(true)
    }

    socket.once('ERROR', onError)
    socket.once('GAME_STATE', onGameState)
    socket.once('PLAYERS_UPDATE', (d: { players: { id: string; name: string; teamId?: string }[]; total: number }) => {
      setWaitingPlayers(d.players)
      setTotalPlayers(d.total)
    })

    if (socket.connected) { doRejoin() }
    else { socket.once('connect', doRejoin); socket.connect() }

    return () => {
      socket.off('ERROR', onError)
      socket.off('GAME_STATE', onGameState)
      socket.off('PLAYERS_UPDATE')
    }
  }, [code, roomInfo])

  // Wake Lock : empêche la mise en veille pendant la partie
  useEffect(() => {
    if (phase !== 'PLAYING') return
    type WLS = { release(): Promise<void> }
    let sentinel: WLS | null = null
    // biome-ignore lint: WakeLock API non standard
    ;(navigator as unknown as { wakeLock?: { request(t: string): Promise<WLS> } })
      .wakeLock?.request('screen')
      .then(s => { sentinel = s })
      .catch(() => {})
    return () => { sentinel?.release().catch(() => {}) }
  }, [phase])

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
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number; gameDuration?: number; frenzy?: boolean; currentRound?: number; totalRounds?: number }) => {
      phaseRef.current = d.phase
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      if (d.gameDuration !== undefined) setGameDuration(d.gameDuration)
      if (d.frenzy !== undefined) { setFrenzy(d.frenzy); frenzyRef.current = d.frenzy }
      if (d.currentRound !== undefined) { setCurrentRound(d.currentRound); currentRoundRef.current = d.currentRound }
      if (d.totalRounds !== undefined) setTotalRounds(d.totalRounds)
      // Réinitialise l'état de manche au passage en COUNTDOWN
      if (d.phase === 'COUNTDOWN' || d.phase === 'WAITING') {
        setEliminated(false)
        setScore(0)
        setTotalScore(undefined)
      }
      if (d.phase === 'WAITING') setRoundSnapshots([])
    })
    socket.on('SCORE_UPDATE', (d: { score: number; eliminated?: boolean }) => {
      setScore(d.score)
      if (d.eliminated !== undefined) setEliminated(d.eliminated)
    })
    socket.on('LEADERBOARD_UPDATE', (d: { players?: { id: string; name: string; score: number; totalScore?: number; teamId?: string; eliminated?: boolean }[]; teams?: TeamScore[]; ropePosition?: number; isFinalResults?: boolean; roundHistory?: RoundSnapshot[] }) => {
      if (d.teams) setTeams(d.teams)
      if (d.ropePosition !== undefined) setRopePosition(d.ropePosition)
      if (d.players) {
        if (d.isFinalResults) {
          const myName = name || 'Anonyme'
          const me = d.players.find(p => p.name === myName)
          if (me?.totalScore !== undefined) setTotalScore(me.totalScore)
        }
        if (d.roundHistory && d.roundHistory.length > 0) {
          setRoundSnapshots(d.roundHistory)
        } else if (phaseRef.current === 'RESULTS') {
          const rnd = currentRoundRef.current
          setRoundSnapshots(prev => prev.find(s => s.round === rnd) ? prev : [...prev, { round: rnd, players: d.players! }])
        }
      }
    })
    socket.on('PLAYERS_UPDATE', (d: { players: { id: string; name: string; teamId?: string }[]; total: number }) => {
      setWaitingPlayers(d.players)
      setTotalPlayers(d.total)
    })
    socket.on('FRENZY_STATE', (d: { active: boolean }) => {
      setFrenzy(d.active); frenzyRef.current = d.active
    })
    socket.on('ELIMINATION', (d: { ids: string[] }) => {
      // Le joueur ne connaît pas son propre socket.id ici — le serveur envoie
      // aussi un SCORE_UPDATE avec eliminated:true pour les joueurs concernés.
      // Ce listener permet d'autres réactions futures (son, vibration…).
      void d
    })
    const flush = setInterval(() => {
      if (tapBuffer.current > 0) {
        socket.emit('TAP_BATCH', { count: tapBuffer.current })
        tapBuffer.current = 0
      }
    }, 200)

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    return () => {
      socket.off('GAME_STATE')
      socket.off('SCORE_UPDATE')
      socket.off('LEADERBOARD_UPDATE')
      socket.off('PLAYERS_UPDATE')
      socket.off('FRENZY_STATE')
      socket.off('ELIMINATION')
      socket.off('connect')
      socket.off('disconnect')
      clearInterval(flush)
    }
  }, [joined, code])

  function join() {
    const n = name || 'Anonyme'
    const emit = () => socket.emit('JOIN_ROOM', { code: code?.toUpperCase(), name: n, teamId: teamId ?? undefined })
    socket.once('JOINED', (d: { token: string }) => {
      if (code) {
        localStorage.setItem(storageKey(code), d.token)
        localStorage.setItem(nameKey(code), n)
      }
    })
    socket.once('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number; frenzy?: boolean; currentRound?: number; totalRounds?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      if (d.frenzy !== undefined) setFrenzy(d.frenzy)
      if (d.currentRound !== undefined) setCurrentRound(d.currentRound)
      if (d.totalRounds !== undefined) setTotalRounds(d.totalRounds)
      joinedRef.current = true
      setJoined(true)
    })
    socket.once('PLAYERS_UPDATE', (d: { players: { id: string; name: string; teamId?: string }[]; total: number }) => {
      setWaitingPlayers(d.players)
      setTotalPlayers(d.total)
    })
    if (socket.connected) { emit() }
    else { socket.once('connect', emit); socket.connect() }
  }

  // Chargement
  if (roomInfo === null) {
    return (
      <div className="arc-screen">
        <div className="arc-ambient" aria-hidden="true" />
        <main className="arc-content" style={{ gap: '1.4rem' }}>
          <div className="arc-spinner" />
          <p className="arc-label">Vérification…</p>
        </main>
      </div>
    )
  }

  // Room inconnue
  if (roomInfo?.exists === false) {
    return <NotFoundPage message="Room introuvable ou expirée." />
  }

  const isTeamMode = roomInfo?.mode === 'team' || roomInfo?.mode === 'tug'

  // Formulaire de rejointe
  if (!joined) {
    return (
      <div className="arc-screen">
        <div className="arc-ambient" aria-hidden="true" />
        <ParticleField />
        <main className="arc-content" style={{ gap: '1.1rem' }}>
          <h1
            className="arc-logo arc-logo--breathe arc-rise"
            style={{ fontSize: 'clamp(2.2rem, 8vw, 3.6rem)', textAlign: 'center' }}
          >
            Tap&nbsp;Race
          </h1>
          <span className="arc-roomtag arc-rise" style={delay(100)}>
            room {code}
          </span>
          <div className="arc-card arc-rise" style={{ ...delay(200), maxWidth: 400 }}>
            {isTeamMode && (
              <>
                <p className="arc-label">Choisir son équipe</p>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {roomInfo!.teams.map(team => (
                    <button
                      key={team.id}
                      style={{
                        flex: 1, padding: '1rem 0.5rem', borderRadius: 10, cursor: 'pointer',
                        fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem',
                        border: `2px solid ${teamId === team.id ? team.color : 'rgba(255,255,255,0.1)'}`,
                        background: teamId === team.id ? `${team.color}22` : 'transparent',
                        color: teamId === team.id ? team.color : '#888',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => setTeamId(team.id)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="arc-label">Identité du pilote</p>
            <input
              className="arc-input"
              style={{ textAlign: 'center', fontSize: '1.25rem' }}
              placeholder="Votre nom"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (!isTeamMode || teamId) && join()}
              maxLength={20}
              autoComplete="off"
            />
            <button
              className="arc-btn arc-btn-primary"
              style={{ width: '100%', opacity: isTeamMode && !teamId ? 0.4 : 1 }}
              onClick={join}
              disabled={isTeamMode && !teamId}
            >
              Rejoindre
            </button>
          </div>
        </main>
      </div>
    )
  }

  const knownTeams: TeamScore[] | undefined =
    teams.length > 0 ? teams
    : roomInfo && roomInfo.teams.length > 0 ? roomInfo.teams.map(t => ({ ...t, score: 0 }))
    : undefined
  const state: PlayerViewState = {
    phase, countdown, timeLeft, score, totalScore,
    playerName: name || 'Anonyme',
    waitingPlayers, totalPlayers,
    teamId: teamId ?? undefined,
    teams: knownTeams,
    frenzy,
    eliminated,
    currentRound,
    totalRounds,
    gameDuration,
    ropePosition,
    connected,
    roundSnapshots,
    mode: roomInfo?.mode,
  }
  return (
    <PlayerView
      state={state}
      onTap={() => { tapBuffer.current += 1; setScore(prev => prev + (frenzyRef.current ? 2 : 1)) }}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
      onReturnHome={() => navigate('/')}
    />
  )
}
