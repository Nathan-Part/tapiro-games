import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import HostView from '@arcade/tap-race/client/HostView'
import type { HostViewState, LeaderboardEntry } from '@arcade/tap-race/client/types'
import type { Phase } from '@arcade/tap-race/client/game'
import { socket } from '../socket'

export default function HostPage() {
  const { code } = useParams<{ code: string }>()
  const [phase, setPhase] = useState<Phase>('WAITING')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(60)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/play/${code}`, { width: 200 }).then(setQrUrl)
  }, [code])

  useEffect(() => {
    socket.connect()
    socket.emit('HOST_ROOM', { code })
    socket.on('GAME_STATE', (d: { phase: Phase; countdown?: number; timeLeft?: number }) => {
      setPhase(d.phase)
      if (d.countdown !== undefined) setCountdown(d.countdown)
      if (d.timeLeft !== undefined) setTimeLeft(d.timeLeft)
    })
    socket.on('LEADERBOARD_UPDATE', (d: { players: LeaderboardEntry[] }) => setLeaderboard(d.players))
    return () => { socket.off('GAME_STATE'); socket.off('LEADERBOARD_UPDATE') }
  }, [code])

  const state: HostViewState = { phase, countdown, timeLeft, leaderboard }

  return (
    <div style={{ position: 'relative' }}>
      {phase === 'WAITING' && qrUrl && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#fff', padding: 8, borderRadius: 8, zIndex: 10, textAlign: 'center' }}>
          <img src={qrUrl} alt="QR" width={120} height={120} />
          <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.2rem', color: '#000' }}>{code}</p>
        </div>
      )}
      <HostView state={state} onStart={() => socket.emit('START_GAME', { code })} />
    </div>
  )
}
