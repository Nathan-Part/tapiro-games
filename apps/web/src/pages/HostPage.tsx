/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import HostView from '@arcade/tap-race/client/HostView'
import type { HostViewState, LeaderboardEntry, RoundSnapshot, TeamScore } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'
import NotFoundPage from './NotFoundPage'

export default function HostPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teams, setTeams] = useState<TeamScore[]>([])
  const [qrUrl, setQrUrl] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [frenzy, setFrenzy] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [ropePosition, setRopePosition] = useState<number | undefined>(undefined)
  const [isFinalResults, setIsFinalResults] = useState(false)
  const [gameDuration, setGameDuration] = useState(60)
  const [roundSnapshots, setRoundSnapshots] = useState<RoundSnapshot[]>([])
  const phaseRef = useRef<Phase>('WAITING')
  const currentRoundRef = useRef(1)

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}${import.meta.env.BASE_URL}play/${code}`, { width: 400 }).then(setQrUrl)
  }, [code])

  useEffect(() => {
    const hostToken = code ? sessionStorage.getItem(`host-token-${code}`) : null
    const doHost = () => socket.emit('HOST_ROOM', { code, token: hostToken })
    if (socket.connected) { doHost() } else { socket.once('connect', doHost); socket.connect() }
    socket.once('ERROR', () => setNotFound(true))
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number; gameDuration?: number; frenzy?: boolean; currentRound?: number; totalRounds?: number }) => {
      phaseRef.current = d.phase
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
      if (d.gameDuration !== undefined) setGameDuration(d.gameDuration)
      if (d.frenzy !== undefined) setFrenzy(d.frenzy)
      if (d.currentRound !== undefined) { setCurrentRound(d.currentRound); currentRoundRef.current = d.currentRound }
      if (d.totalRounds !== undefined) setTotalRounds(d.totalRounds)
      if (d.phase === 'COUNTDOWN' || d.phase === 'WAITING') setFrenzy(false)
      if (d.phase === 'WAITING') setRoundSnapshots([])
    })
    socket.on('LEADERBOARD_UPDATE', (d: { players: LeaderboardEntry[]; teams?: TeamScore[]; ropePosition?: number; isFinalResults?: boolean }) => {
      setLeaderboard(d.players)
      if (d.teams) setTeams(d.teams)
      setRopePosition(d.ropePosition)
      if (d.isFinalResults !== undefined) setIsFinalResults(d.isFinalResults)
      if (phaseRef.current === 'RESULTS') {
        const rnd = currentRoundRef.current
        setRoundSnapshots(prev => prev.find(s => s.round === rnd) ? prev : [...prev, { round: rnd, players: d.players }])
      }
    })
    socket.on('FRENZY_STATE', (d: { active: boolean }) => setFrenzy(d.active))
    return () => {
      socket.off('GAME_STATE')
      socket.off('LEADERBOARD_UPDATE')
      socket.off('ERROR')
      socket.off('FRENZY_STATE')
    }
  }, [code])

  if (notFound) return <NotFoundPage message="Room introuvable ou expirée." />

  const state: HostViewState = {
    phase, countdown, timeLeft, leaderboard, roomCode: code,
    teams: teams.length > 0 ? teams : undefined,
    frenzy,
    currentRound,
    totalRounds,
    ropePosition,
    isFinalResults,
    gameDuration,
    roundSnapshots,
  }

  return (
    <HostView
      state={state}
      qrUrl={qrUrl}
      onStart={() => socket.emit('START_GAME', { code, token: code ? sessionStorage.getItem(`host-token-${code}`) : null })}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
    />
  )
}
