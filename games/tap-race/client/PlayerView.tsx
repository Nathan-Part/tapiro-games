import { useRef } from 'react'
import type { PlayerViewState } from './types'
import TapButton from './fx/TapButton'
import Confetti from './fx/Confetti'
import { useCountUp } from './fx/useCountUp'
import './tap-race.css'

interface Props {
  state: PlayerViewState
  onTap: () => void
  onViewGlobalLeaderboard?: () => void
}

const GAME_DURATION = 60
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

export default function PlayerView({ state, onTap, onViewGlobalLeaderboard }: Props) {
  if (state.phase === 'WAITING') {
    return <WaitingScreen state={state} />
  }

  if (state.phase === 'COUNTDOWN') {
    return (
      <div className="tr-screen">
        <div className="tr-ambient" aria-hidden="true" />
        <p className="tr-label" style={{ fontSize: '1rem' }}>Prêt ?</p>
        <div className="tr-count">
          <span key={state.countdown} className="tr-count__ring" aria-hidden="true" />
          <p key={`d${state.countdown}`} className="tr-count__digit">{state.countdown}</p>
        </div>
      </div>
    )
  }

  if (state.phase === 'PLAYING') {
    return <PlayingScreen state={state} onTap={onTap} />
  }

  return <ResultsScreen state={state} onViewGlobalLeaderboard={onViewGlobalLeaderboard} />
}

function WaitingScreen({ state }: { state: PlayerViewState }) {
  const players = state.waitingPlayers ?? []
  const total = state.totalPlayers ?? players.length
  return (
    <div className="tr-screen">
      <div className="tr-ambient" aria-hidden="true" />
      <h2 className="tr-logo tr-rise" style={{ fontSize: 'clamp(1.7rem, 7vw, 2.4rem)' }}>Tap Race</h2>
      <div className="tr-standby tr-rise" style={delay(80)} aria-hidden="true" />
      <p className="tr-label tr-rise" style={delay(140)}>En attente du départ…</p>
      <p className="tr-playername tr-rise" style={delay(200)}>{state.playerName}</p>

      {total > 0 && (
        <div className="tr-lobby tr-rise" style={delay(280)}>
          <p className="tr-lobby__count">
            {total} joueur{total > 1 ? 's' : ''} connecté{total > 1 ? 's' : ''}
          </p>
          <ul className="tr-lobby__list">
            {players.map((p, i) => (
              <li
                key={p.id}
                className={`tr-chip${p.name === state.playerName ? ' tr-chip--me' : ''}`}
                style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="tr-hint tr-rise" style={delay(360)}>Échauffe ton pouce. Ça va taper fort.</p>
    </div>
  )
}

function PlayingScreen({ state, onTap }: { state: PlayerViewState; onTap: () => void }) {
  const scoreRef = useRef<HTMLParagraphElement>(null)
  const displayed = useCountUp(state.score)
  const danger = state.timeLeft <= 10

  function handleTap() {
    onTap()
    const el = scoreRef.current
    if (el) {
      el.classList.remove('tr-score--pop')
      void el.offsetWidth
      el.classList.add('tr-score--pop')
    }
  }

  return (
    <div className="tr-screen" data-danger={danger ? 'true' : 'false'} style={{ justifyContent: 'space-between' }}>
      <div className={`tr-ambient${danger ? ' tr-ambient--danger' : ''}`} aria-hidden="true" />

      <div className="tr-timerzone" style={{ paddingTop: '0.4rem' }}>
        <p className="tr-timer">{state.timeLeft}s</p>
        <div className="tr-timerbar">
          <div
            className="tr-timerbar__fill"
            style={{ width: `${Math.max(0, Math.min(100, (state.timeLeft / GAME_DURATION) * 100))}%` }}
          />
        </div>
      </div>

      <div className="tr-scorezone">
        <p className="tr-label">Score</p>
        <p ref={scoreRef} className="tr-score">{displayed}</p>
      </div>

      <div style={{ paddingBottom: '1.2rem' }}>
        <TapButton onTap={handleTap} />
      </div>
    </div>
  )
}

function ResultsScreen({ state, onViewGlobalLeaderboard }: { state: PlayerViewState; onViewGlobalLeaderboard?: () => void }) {
  const displayed = useCountUp(state.score, 900)
  return (
    <div className="tr-screen">
      <div className="tr-ambient" aria-hidden="true" />
      <Confetti />
      <p className="tr-kicker tr-rise">/// course terminée ///</p>
      <h2 className="tr-logo tr-rise" style={{ ...delay(100), fontSize: 'clamp(1.9rem, 8vw, 2.8rem)' }}>
        Terminé !
      </h2>
      <p className="tr-final tr-rise" style={delay(250)}>{displayed}</p>
      <p className="tr-label tr-rise" style={delay(400)}>taps</p>
      {onViewGlobalLeaderboard && (
        <button className="tr-ghostbtn tr-rise" style={delay(550)} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
    </div>
  )
}
