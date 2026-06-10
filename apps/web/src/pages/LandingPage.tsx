import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

export default function LandingPage() {
  const navigate = useNavigate()

  function createRoom() {
    socket.connect()
    socket.once('ROOM_CREATED', ({ code }: { code: string }) => navigate(`/host/${code}`))
    socket.emit('CREATE_ROOM')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: '1.5rem', fontFamily: 'monospace', background: '#0f0f0f', color: '#fff' }}>
      <h1 style={{ fontSize: '3rem', margin: 0 }}>Tap Race</h1>
      <button onClick={createRoom}
        style={{ padding: '1rem 3rem', fontSize: '1.3rem', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
        Créer une partie
      </button>
    </div>
  )
}
