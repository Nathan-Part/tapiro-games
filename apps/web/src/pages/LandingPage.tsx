import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROOM_CODE_LENGTH } from '@arcade/shared'
import ParticleField from '../components/ParticleField'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

export default function LandingPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const isAdmin = !!sessionStorage.getItem('admin-token')

  function joinRoom() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    navigate(`/play/${trimmed}`)
  }

  return (
    <div className="arc-screen">
      <div className="arc-ambient" aria-hidden="true" />
      <ParticleField />

      {isAdmin && (
        <button className="arc-btn arc-btn-ghost arc-btn--sm" style={s.adminBtn} onClick={() => navigate('/admin')}>
          ⚙ Admin
        </button>
      )}

      <main className="arc-content" style={s.content}>
        <p className="arc-kicker arc-rise">/// multiplayer arcade ///</p>
        <h1 className="arc-logo arc-logo--breathe arc-rise" style={{ ...delay(100), ...s.logo }}>
          Tap&nbsp;Race
        </h1>
        <p className="arc-hint arc-rise" style={{ ...delay(200), ...s.tagline }}>
          60 secondes. Un bouton. Zéro pitié.
        </p>

        <div className="arc-card arc-rise" style={delay(300)}>
          <p className="arc-label">Rejoindre une partie</p>
          <div style={s.row}>
            <input
              className="arc-input arc-input--code"
              style={{ flex: 1 }}
              placeholder="CODE"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              maxLength={ROOM_CODE_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="arc-btn arc-btn-primary" onClick={joinRoom}>
              Rejoindre
            </button>
          </div>
          <p className="arc-hint">Scanne le QR code sur l'écran hôte, ou entre le code de la room.</p>
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  content: { gap: '1.1rem' },
  logo: { fontSize: 'clamp(2.6rem, 9vw, 5rem)', textAlign: 'center' },
  tagline: { fontSize: '0.95rem', letterSpacing: '0.06em', marginBottom: '0.8rem' },
  row: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
  adminBtn: { position: 'fixed', top: '1rem', right: '1rem', zIndex: 5 },
}
