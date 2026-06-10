import { useNavigate } from 'react-router-dom'

interface Props {
  message?: string
}

export default function NotFoundPage({ message = 'Cette page n\'existe pas.' }: Props) {
  const navigate = useNavigate()
  return (
    <div className="arc-screen">
      <div className="arc-ambient" aria-hidden="true" />
      <main className="arc-content" style={s.content}>
        <h1 className="arc-glitch arc-rise" style={s.code} data-text="404">
          404
        </h1>
        <p className="arc-hint arc-rise" style={{ ...s.msg, '--d': '120ms' } as React.CSSProperties}>
          {message}
        </p>
        <button
          className="arc-btn arc-btn-ghost arc-rise"
          style={{ '--d': '240ms' } as React.CSSProperties}
          onClick={() => navigate('/')}
        >
          ← Retour à l'accueil
        </button>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  content: { gap: '1.4rem' },
  code: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: 'clamp(5rem, 18vw, 9rem)',
    lineHeight: 1,
  },
  msg: { fontSize: '1.05rem' },
}
