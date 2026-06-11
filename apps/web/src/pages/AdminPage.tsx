/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000'

export default function AdminPage() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [rooms, setRooms] = useState<{ code: string; phase: string; playerCount: number; mode: string }[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newMode, setNewMode] = useState<'solo' | 'team'>('solo')
  const [teamNames, setTeamNames] = useState(['Équipe Rouge', 'Équipe Bleue'])

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-token')
    if (saved) tryLogin(saved)
  }, [])

  async function tryLogin(t: string) {
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.status === 401) { setError('Mot de passe incorrect'); return }
      const data = await res.json() as { rooms: { code: string; phase: string; playerCount: number; mode: string; hostToken?: string }[] }
      for (const r of data.rooms) if (r.hostToken) sessionStorage.setItem(`host-token-${r.code}`, r.hostToken)
      setToken(t)
      setRooms(data.rooms)
      setLoggedIn(true)
      sessionStorage.setItem('admin-token', t)
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
      const data = await res.json() as { rooms: { code: string; phase: string; playerCount: number; mode: string; hostToken?: string }[] }
      for (const r of data.rooms) if (r.hostToken) sessionStorage.setItem(`host-token-${r.code}`, r.hostToken)
      setRooms(data.rooms)
    } catch {}
  }

  async function createRoom() {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setShowCreateForm(false)
    const config = newMode === 'team'
      ? { mode: 'team' as const, teams: [
          { id: 'red', name: teamNames[0] || 'Équipe 1', color: '#dc2626' },
          { id: 'blue', name: teamNames[1] || 'Équipe 2', color: '#2563eb' },
        ]}
      : { mode: 'solo' as const, teams: [] }
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json() as { code: string; hostToken?: string }
      if (data.hostToken) sessionStorage.setItem(`host-token-${data.code}`, data.hostToken)
      setRooms(prev => [...prev, { code: data.code, phase: 'WAITING', playerCount: 0, mode: newMode }])
    } finally {
      creatingRef.current = false
      setCreating(false)
      setNewMode('solo')
      setTeamNames(['Équipe Rouge', 'Équipe Bleue'])
    }
  }

  async function deleteRoom(code: string) {
    await fetch(`${API}/api/admin/rooms/${code}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setRooms(prev => prev.filter(r => r.code !== code))
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  function logout() {
    sessionStorage.removeItem('admin-token')
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('host-token-')) sessionStorage.removeItem(key)
    }
    setLoggedIn(false)
    setToken('')
    setRooms([])
    setPassword('')
  }

  if (!loggedIn) {
    return (
      <div className="arc-screen">
        <div className="arc-ambient" aria-hidden="true" />
        <main className="arc-content" style={{ gap: '1.2rem' }}>
          <p className="arc-kicker arc-rise">/// zone restreinte ///</p>
          <h1 className="arc-logo arc-rise" style={{ ...s.title, '--d': '80ms' } as React.CSSProperties}>
            Admin
          </h1>
          <form
            className="arc-card arc-rise"
            style={{ ...s.loginForm, '--d': '180ms' } as React.CSSProperties}
            onSubmit={e => { e.preventDefault(); tryLogin(password) }}
          >
            <p className="arc-label">Authentification</p>
            <input
              className="arc-input"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="arc-btn arc-btn-primary" style={{ width: '100%' }}>
              Se connecter
            </button>
            {error && <p className="arc-error">{error}</p>}
          </form>
        </main>
      </div>
    )
  }

  return (
    <div className="arc-screen arc-screen--top">
      <div className="arc-ambient" aria-hidden="true" />
      <main className="arc-content" style={{ gap: '1.5rem', maxWidth: 560, paddingTop: '1.5rem' }}>
        <div className="arc-rise" style={s.topBar}>
          <h1 className="arc-logo" style={s.title}>Admin</h1>
          <button className="arc-btn arc-btn-ghost arc-btn--sm" onClick={logout}>
            Déconnexion
          </button>
        </div>

        <section className="arc-rise" style={{ ...s.section, '--d': '120ms' } as React.CSSProperties}>
          <div style={s.sectionHeader}>
            <h2 className="arc-label" style={{ fontSize: '0.9rem' }}>
              Rooms actives <span style={s.count}>{rooms.length}</span>
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="arc-btn arc-btn-ghost arc-btn--sm" onClick={() => loadRooms()}>↻</button>
              <button className="arc-btn arc-btn-primary arc-btn--sm" onClick={() => setShowCreateForm(v => !v)} disabled={creating}>
                {creating ? '…' : '+ Créer'}
              </button>
            </div>
          </div>
          {showCreateForm && (
            <div style={s.createForm}>
              <p className="arc-label" style={{ marginBottom: '0.6rem' }}>Type de partie</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {(['solo', 'team'] as const).map(m => (
                  <button
                    key={m}
                    style={{ ...s.modeBtn, ...(newMode === m ? s.modeBtnActive : {}) }}
                    onClick={() => setNewMode(m)}
                  >
                    {m === 'solo' ? 'Solo' : 'Équipes'}
                  </button>
                ))}
              </div>
              {newMode === 'team' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {[0, 1].map(i => (
                    <input
                      key={i}
                      className="arc-input"
                      style={{ flex: 1, borderLeft: `3px solid ${i === 0 ? '#dc2626' : '#2563eb'}` }}
                      value={teamNames[i]}
                      onChange={e => setTeamNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                      placeholder={`Équipe ${i + 1}`}
                    />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="arc-btn arc-btn-primary arc-btn--sm" onClick={createRoom}>Créer</button>
                <button className="arc-btn arc-btn-ghost arc-btn--sm" onClick={() => setShowCreateForm(false)}>Annuler</button>
              </div>
            </div>
          )}
          {rooms.length === 0
            ? <p className="arc-hint" style={{ marginTop: '1.2rem' }}>Aucune room active</p>
            : (
              <ul style={s.list}>
                {rooms.map((room, i) => (
                  <li
                    key={room.code}
                    className="arc-row arc-row--click arc-rise"
                    style={{ '--d': `${i * 60}ms` } as React.CSSProperties}
                    onClick={() => navigate(`/host/${room.code}`)}
                  >
                    <span style={s.code}>{room.code}</span>
                    <span style={{ ...s.badge, ...(room.phase !== 'WAITING' ? s.badgeLive : {}) }}>
                      {room.phase === 'WAITING' && `${room.playerCount} joueur${room.playerCount > 1 ? 's' : ''}`}
                      {room.phase === 'COUNTDOWN' && '⏳ Démarrage'}
                      {room.phase === 'PLAYING' && `▶ En cours · ${room.playerCount}p`}
                      {room.phase === 'RESULTS' && '✓ Terminée'}
                    </span>
                    {room.mode === 'team' && <span style={s.badgeTeam}>👥 Équipes</span>}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
                      <button
                        className="arc-btn arc-btn-ghost arc-btn--sm"
                        onClick={e => { e.stopPropagation(); copyCode(room.code) }}
                      >
                        {copied === room.code ? '✓' : '⎘ Copier'}
                      </button>
                      <button
                        className="arc-btn arc-btn-danger arc-btn--sm"
                        onClick={e => { e.stopPropagation(); deleteRoom(room.code) }}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </section>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%',
  },
  title: { fontSize: '1.8rem' },
  loginForm: { maxWidth: 360 },
  section: { width: '100%' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' },
  count: {
    display: 'inline-block', minWidth: '1.6em', textAlign: 'center',
    marginLeft: '0.4em', padding: '0.1em 0.4em', borderRadius: 99,
    background: 'rgba(0, 245, 255, 0.1)', border: '1px solid rgba(0, 245, 255, 0.3)',
    color: 'var(--cyan)', fontFamily: 'var(--font-term)',
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  code: {
    fontSize: '1.45rem', fontFamily: 'var(--font-display)', fontWeight: 700,
    color: 'var(--cyan)', letterSpacing: '0.22em',
    textShadow: '0 0 12px rgba(0, 245, 255, 0.5)',
  },
  badge: {
    fontSize: '0.75rem', padding: '0.2em 0.6em', borderRadius: 99,
    background: 'rgba(255,255,255,0.07)', color: '#888',
    fontFamily: 'monospace', whiteSpace: 'nowrap' as const,
  },
  badgeTeam: {
    fontSize: '0.75rem', padding: '0.2em 0.5em', borderRadius: 99,
    background: 'rgba(250,204,21,0.1)', color: '#facc15',
    fontFamily: 'monospace', whiteSpace: 'nowrap' as const,
  },
  createForm: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '1rem', marginBottom: '0.85rem',
  },
  modeBtn: {
    flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.9rem',
  },
  modeBtnActive: {
    background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.4)', color: '#00f5ff',
  },
  badgeLive: {
    background: 'rgba(74,222,128,0.15)', color: '#4ade80',
    border: '1px solid rgba(74,222,128,0.3)',
  },
}
