import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const isAdmin = !!localStorage.getItem('admin-token')

  function joinRoom() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    navigate(`/play/${trimmed}`)
  }

  return (
    <div style={s.screen}>
      {isAdmin && (
        <button style={s.adminBtn} onClick={() => navigate('/admin')}>⚙ Admin</button>
      )}
      <h1 style={s.title}>Tap Race</h1>

      <div style={s.card}>
        <p style={s.label}>Rejoindre une partie</p>
        <div style={s.row}>
          <input
            placeholder="Code de la room"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            maxLength={4}
            style={s.codeInput}
          />
          <button onClick={joinRoom} style={s.joinBtn}>Rejoindre</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh', gap: '1.5rem',
    fontFamily: 'monospace', background: '#0f0f0f', color: '#fff',
  },
  title: { fontSize: '3rem', margin: 0 },
  card: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    background: '#1a1a1a', padding: '1.5rem', borderRadius: 12,
    width: '100%', maxWidth: '480px', boxSizing: 'border-box',
  },
  label: { margin: 0, color: '#aaa', fontSize: '0.9rem' },
  row: { display: 'flex', gap: '0.5rem' },
  codeInput: {
    flex: 1, minWidth: 0, padding: '0.75rem 1rem', fontSize: '1.3rem', fontFamily: 'monospace',
    borderRadius: 8, border: '1px solid #333', background: '#0f0f0f', color: '#facc15',
    textAlign: 'center', letterSpacing: '0.2em', textTransform: 'uppercase',
  },
  adminBtn: {
    position: 'fixed' as const, top: '1rem', right: '1rem',
    padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #333',
    background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'monospace',
  },
  joinBtn: {
    padding: '0.75rem 1.2rem', borderRadius: 8, border: 'none',
    background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontFamily: 'monospace',
  },
}
