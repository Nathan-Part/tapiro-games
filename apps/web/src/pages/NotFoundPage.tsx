import { useNavigate } from 'react-router-dom'

interface Props {
  message?: string
}

export default function NotFoundPage({ message = 'Cette page n\'existe pas.' }: Props) {
  const navigate = useNavigate()
  return (
    <div style={s.screen}>
      <h1 style={s.code}>404</h1>
      <p style={s.msg}>{message}</p>
      <button style={s.btn} onClick={() => navigate('/')}>← Retour à l'accueil</button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh', gap: '1rem',
    fontFamily: 'monospace', background: '#0f0f0f', color: '#fff',
  },
  code: { fontSize: '5rem', margin: 0, color: '#facc15' },
  msg: { color: '#aaa', fontSize: '1.1rem', margin: 0 },
  btn: {
    marginTop: '0.5rem', padding: '0.75rem 2rem', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '1rem',
  },
}
