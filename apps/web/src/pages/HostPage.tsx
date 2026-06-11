/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import HostView from '@arcade/tap-race/client/HostView'
import type { HostViewState, LeaderboardEntry, TeamScore } from '@arcade/tap-race/client/types'
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

  useEffect(() => {
    // inclut la base Vite (/tapi/) sinon le QR pointe vers une route inexistante
    QRCode.toDataURL(`${window.location.origin}${import.meta.env.BASE_URL}play/${code}`, { width: 400 }).then(setQrUrl)
  }, [code])

  useEffect(() => {
    const hostToken = code ? sessionStorage.getItem(`host-token-${code}`) : null
    const doHost = () => socket.emit('HOST_ROOM', { code, token: hostToken })
    if (socket.connected) { doHost() } else { socket.once('connect', doHost); socket.connect() }
    socket.once('ERROR', () => setNotFound(true))
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('LEADERBOARD_UPDATE', (d: { players: LeaderboardEntry[]; teams?: TeamScore[] }) => {
      setLeaderboard(d.players)
      if (d.teams) setTeams(d.teams)
    })
    return () => {
      socket.off('GAME_STATE')
      socket.off('LEADERBOARD_UPDATE')
      socket.off('ERROR')
    }
  }, [code])

  if (notFound) return <NotFoundPage message="Room introuvable ou expirée." />

  const state: HostViewState = { phase, countdown, timeLeft, leaderboard, roomCode: code, teams: teams.length > 0 ? teams : undefined }

  return (
    <HostView
      state={state}
      qrUrl={qrUrl}
      onStart={() => socket.emit('START_GAME', { code, token: code ? sessionStorage.getItem(`host-token-${code}`) : null })}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
    />
  )
}
