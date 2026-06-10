import { useEffect, useState } from 'react'
import { socket } from './socket'

type Status = 'disconnected' | 'connecting' | 'connected'

export default function App() {
  const [status, setStatus] = useState<Status>('disconnected')

  useEffect(() => {
    setStatus('connecting')
    socket.connect()

    socket.on('connect', () => setStatus('connected'))
    socket.on('disconnect', () => setStatus('disconnected'))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.disconnect()
    }
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Arcade</h1>
      <p>
        Serveur :{' '}
        <strong style={{ color: status === 'connected' ? 'green' : 'red' }}>{status}</strong>
      </p>
    </div>
  )
}
