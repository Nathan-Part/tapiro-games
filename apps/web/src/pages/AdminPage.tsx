/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'

export default function AdminPage() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('admin-token')
    if (saved) tryLogin(saved)
  }, [])

  async function tryLogin(t: string) {
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.status === 401) { setError('Mot de passe incorrect'); return }
      const data = await res.json() as { rooms: string[] }
      setToken(t)
      setRooms(data.rooms)
      setLoggedIn(true)
      localStorage.setItem('admin-token', t)
    } catch {
      setError('Impossible de contacter le serveur')
    }
  }

  async function loadRooms(t = token) {
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return
      const data = await res.json() as { rooms: string[] }
      setRooms(data.rooms)
    } catch {}
  }

  async function createRoom() {
    setCreating(true)
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json() as { code: string }
      setRooms(prev => [...prev, data.code])
    } finally {
      setCreating(false)
    }
  }

  async function deleteRoom(code: string) {
    await fetch(`${API}/api/admin/rooms/${code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setRooms(prev => prev.filter(r => r !== code))
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  function logout() {
    localStorage.removeItem('admin-token')
    setLoggedIn(false)
    setToken('')
    setRooms([])
    setPassword('')
  }

  if (!loggedIn) {
    return (
      <div style={s.screen}>
        <h1 style={s.title}>Admin</h1>
        <form
          style={s.loginForm}
          onSubmit={e => { e.preventDefault(); tryLogin(password) }}
        >
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={s.input}
            autoFocus
          />
          <button type="submit" style={s.btn}>Se connecter</button>
        </form>
        {error && <p style={s.error}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={s.screen}>
      <div style={s.topBar}>
        <h1 style={s.title}>Admin</h1>
        <button style={s.logoutBtn} onClick={logout}>Déconnexion</button>
      </div>

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.subtitle}>Rooms actives ({rooms.length})</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={s.refreshBtn} onClick={() => loadRooms()}>↻</button>
            <button style={s.createBtn} onClick={createRoom} disabled={creating}>
              {creating ? '…' : '+ Créer'}
            </button>
          </div>
        </div>
        {rooms.length === 0
          ? <p style={s.empty}>Aucune room active</p>
          : (
            <ul style={s.list}>
              {rooms.map(code => (
                <li key={code} style={s.roomRow} onClick={() => navigate(`/host/${code}`)}>
                  <span style={s.code}>{code}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button style={s.copyBtn} onClick={e => { e.stopPropagation(); copyCode(code) }}>
                      {copied === code ? '✓' : '⎘ Copier'}
                    </button>
                    <button style={s.deleteBtn} onClick={e => { e.stopPropagation(); deleteRoom(code) }}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minHeight: '100dvh', fontFamily: 'monospace', background: '#0f0f0f',
    color: '#fff', padding: '2rem', gap: '1.5rem', boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', maxWidth: '500px',
  },
  title: { fontSize: '2rem', margin: 0 },
  loginForm: { display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px' },
  input: {
    padding: '0.75rem 1rem', fontSize: '1rem', borderRadius: 8,
    border: '1px solid #333', background: '#1a1a1a', color: '#fff',
  },
  btn: {
    padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '1rem',
  },
  logoutBtn: {
    padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #444',
    background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.85rem',
  },
  error: { color: '#f87171', margin: 0 },
  section: { width: '100%', maxWidth: '500px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  subtitle: { fontSize: '1.2rem', margin: 0 },
  refreshBtn: {
    padding: '0.4rem 0.7rem', borderRadius: 6, border: '1px solid #333',
    background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '1rem',
  },
  createBtn: {
    padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
    background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.9rem',
  },
  empty: { color: '#555', margin: '1rem 0 0' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  roomRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1rem', background: '#1a1a1a', borderRadius: 8,
  },
  code: { fontSize: '1.5rem', fontWeight: 'bold', color: '#facc15', letterSpacing: '0.1em', cursor: 'pointer' },
  copyBtn: {
    padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #333',
    background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem',
  },
  deleteBtn: {
    padding: '0.3rem 0.6rem', borderRadius: 6, border: 'none',
    background: '#7f1d1d', color: '#f87171', cursor: 'pointer', fontSize: '0.9rem',
  },
}
