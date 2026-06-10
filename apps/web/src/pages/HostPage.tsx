import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import HostView from '@arcade/tap-race/client/HostView'
import type { HostViewState, LeaderboardEntry } from '@arcade/tap-race/client/types'
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
  const [qrUrl, setQrUrl] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/play/${code}`, { width: 400 }).then(setQrUrl)
  }, [code])

  useEffect(() => {
    const doHost = () => socket.emit('HOST_ROOM', { code })
    if (socket.connected) { doHost() } else { socket.once('connect', doHost); socket.connect() }
    socket.once('ERROR', () => setNotFound(true))
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('LEADERBOARD_UPDATE', (d: { players: LeaderboardEntry[] }) => setLeaderboard(d.players))
    return () => {
      socket.off('GAME_STATE')
      socket.off('LEADERBOARD_UPDATE')
      socket.off('ERROR')
    }
  }, [code])

  if (notFound) return <NotFoundPage message="Room introuvable ou expirée." />

  const state: HostViewState = { phase, countdown, timeLeft, leaderboard, roomCode: code }

  return (
    <HostView
      state={state}
      qrUrl={qrUrl}
      onStart={() => socket.emit('START_GAME', { code })}
      onViewGlobalLeaderboard={() => navigate('/leaderboard')}
    />
  )
}
