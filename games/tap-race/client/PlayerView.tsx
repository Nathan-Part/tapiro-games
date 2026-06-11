import { useRef, useState } from 'react'
import type { PlayerViewState } from './types'
import PartyResultsPanel from './PartyResultsPanel'
import TapButton from './fx/TapButton'
import Confetti from './fx/Confetti'
import { useCountUp } from './fx/useCountUp'
import './tap-race.css'

interface Props {
  state: PlayerViewState
  onTap: () => void
  onViewGlobalLeaderboard?: () => void
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

export default function PlayerView({ state, onTap, onViewGlobalLeaderboard }: Props) {
  const offline = state.connected === false
  return (
    <>
      {offline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: 'rgba(255,56,96,0.92)', color: '#fff',
          textAlign: 'center', padding: '0.5rem 1rem', fontSize: '0.85rem',
          fontFamily: 'var(--tr-term)', letterSpacing: '0.06em',
        }}>
          ⚠ Reconnexion en cours…
        </div>
      )}
      <PlayerViewInner state={state} onTap={onTap} onViewGlobalLeaderboard={onViewGlobalLeaderboard} />
    </>
  )
}

function PlayerViewInner({ state, onTap, onViewGlobalLeaderboard }: Props) {
  if (state.phase === 'WAITING') {
    return <WaitingScreen state={state} />
  }

  if (state.phase === 'COUNTDOWN') {
    return (
      <div className="tr-screen">
        <div className="tr-ambient" aria-hidden="true" />
        {state.totalRounds && state.totalRounds > 1 && (
          <p className="tr-round-badge">Manche {state.currentRound ?? 1}/{state.totalRounds}</p>
        )}
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
            {players.map((p, i) => {
              const team = state.teams?.find(t => t.id === p.teamId)
              const me = p.name === state.playerName
              return (
                <li
                  key={p.id}
                  className={`tr-chip${me ? ' tr-chip--me' : ''}`}
                  style={{
                    animationDelay: `${Math.min(i * 40, 600)}ms`,
                    ...(team ? { border: `2px solid ${team.color}`, boxShadow: `0 0 10px ${team.color}40`, ...(me ? {} : { background: `${team.color}14` }) } : {}),
                  }}
                >
                  {p.name}
                </li>
              )
            })}
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
  const gameDuration = state.gameDuration ?? 60
  const danger = state.timeLeft <= 10
  const teams = state.teams && state.teams.length >= 2 ? state.teams : null
  const teamTotal = teams ? teams.reduce((sum, t) => sum + t.score, 0) : 0
  const showRope = teams !== null && state.ropePosition !== undefined
  const frenzy = state.frenzy ?? false
  const eliminated = state.eliminated ?? false

  function handleTap() {
    if (eliminated) return
    onTap()
    navigator.vibrate?.(8)
    const el = scoreRef.current
    if (el) {
      el.classList.remove('tr-score--pop')
      void el.offsetWidth
      el.classList.add('tr-score--pop')
    }
  }

  return (
    <div
      className="tr-screen"
      data-danger={danger && !frenzy ? 'true' : 'false'}
      data-frenzy={frenzy ? 'true' : 'false'}
      style={{ justifyContent: 'space-between' }}
    >
      <div className={`tr-ambient${frenzy ? ' tr-ambient--frenzy' : danger ? ' tr-ambient--danger' : ''}`} aria-hidden="true" />

      {frenzy && (
        <div className="tr-frenzy-banner" aria-live="polite">
          ⚡ GOLDEN TAP ×2 ⚡
        </div>
      )}

      <div className="tr-timerzone" style={{ paddingTop: '0.4rem' }}>
        {state.totalRounds && state.totalRounds > 1 && (
          <p className="tr-round-badge" style={{ marginBottom: '0.3rem' }}>
            Manche {state.currentRound ?? 1}/{state.totalRounds}
          </p>
        )}
        <p className={`tr-timer${frenzy ? ' tr-timer--frenzy' : ''}`}>{state.timeLeft}s</p>
        <div className="tr-timerbar">
          <div
            className={`tr-timerbar__fill${frenzy ? ' tr-timerbar__fill--frenzy' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, (state.timeLeft / gameDuration) * 100))}%` }}
          />
        </div>
      </div>

      {teams && !showRope && (
        <div style={{ display: 'flex', gap: '0.6rem', width: '100%', maxWidth: 340, alignItems: 'stretch' }}>
          {teams.map(t => {
            const share = teamTotal > 0 ? t.score / teamTotal : 1 / teams.length
            const grow = Math.min(0.7, Math.max(0.3, share))
            return (
              <div key={t.id} style={{
                flexGrow: grow, flexBasis: 0, minWidth: 0, textAlign: 'center', padding: '0.4rem 0.6rem', borderRadius: 8,
                background: t.id === state.teamId ? `${t.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${t.id === state.teamId ? t.color : 'rgba(255,255,255,0.1)'}`,
                transition: 'flex-grow 0.35s ease',
              }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: t.id === state.teamId ? t.color : '#666', fontFamily: 'monospace' }}>{t.name}</p>
                <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', color: t.id === state.teamId ? t.color : '#888' }}>{t.score}</p>
              </div>
            )
          })}
        </div>
      )}
      {showRope && <PlayerTugRope teams={teams!} ropePosition={state.ropePosition!} />}

      {eliminated ? (
        <div className="tr-eliminated-overlay">
          <p className="tr-eliminated-text">ÉLIMINÉ</p>
          <p className="tr-hint" style={{ marginTop: '0.5rem' }}>Score final : {state.score}</p>
        </div>
      ) : (
        <div className="tr-scorezone">
          <p className="tr-label">Score{frenzy ? ' ×2' : ''}</p>
          <p ref={scoreRef} className={`tr-score${frenzy ? ' tr-score--frenzy' : ''}`}>{displayed}</p>
        </div>
      )}

      <div style={{ paddingBottom: '1.2rem', opacity: eliminated ? 0.3 : 1 }}>
        <TapButton onTap={handleTap} />
      </div>
    </div>
  )
}

function PlayerTugRope({ teams, ropePosition }: { teams: { id: string; name: string; color: string; score: number }[]; ropePosition: number }) {
  const [teamA, teamB] = teams
  const flagPos = Math.max(5, Math.min(95, ropePosition * 100))
  const aLeads = ropePosition < 0.5
  return (
    <div className="tr-tugrope" style={{ width: '100%', maxWidth: 340 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 'bold', color: aLeads ? teamA.color : '#555' }}>{teamA.name} {teamA.score}</span>
        <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 'bold', color: !aLeads ? teamB.color : '#555' }}>{teamB.score} {teamB.name}</span>
      </div>
      <div className="tr-tugrope__track">
        <div className="tr-tugrope__fill--a" style={{ width: `${flagPos}%`, background: teamA.color }} />
        <div className="tr-tugrope__flag" style={{ left: `${flagPos}%`, borderColor: aLeads ? teamA.color : teamB.color }}>⚑</div>
        <div className="tr-tugrope__fill--b" style={{ width: `${100 - flagPos}%`, background: teamB.color }} />
      </div>
    </div>
  )
}

function ResultsScreen({ state, onViewGlobalLeaderboard }: { state: PlayerViewState; onViewGlobalLeaderboard?: () => void }) {
  const [showParty, setShowParty] = useState(false)
  const isLastRound = !state.totalRounds || !state.currentRound || state.currentRound >= state.totalRounds
  const hasMoreRounds = state.totalRounds && state.currentRound && state.currentRound < state.totalRounds
  const displayScore = isLastRound && state.totalScore !== undefined ? state.totalScore : state.score
  const displayed = useCountUp(displayScore, 900)
  const winner = state.teams?.length ? state.teams.reduce((a, b) => a.score >= b.score ? a : b) : null
  const myTeam = state.teams?.find(t => t.id === state.teamId)
  const iWin = winner && myTeam && winner.id === myTeam.id

  if (showParty && state.roundSnapshots) {
    return (
      <PartyResultsPanel
        snapshots={state.roundSnapshots}
        finalLeaderboard={state.roundSnapshots[state.roundSnapshots.length - 1]?.players ?? []}
        onClose={() => setShowParty(false)}
      />
    )
  }

  return (
    <div className="tr-screen">
      <div className="tr-ambient" aria-hidden="true" />
      {isLastRound && <Confetti />}
      <p className="tr-kicker tr-rise">/// {hasMoreRounds ? `fin manche ${state.currentRound}` : 'course terminée'} ///</p>
      {winner ? (
        <h2 className="tr-logo tr-rise" style={{ ...delay(100), fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', color: iWin ? winner.color : '#888' }}>
          {iWin ? `🏆 ${winner.name} gagne !` : `${winner.name} gagne…`}
        </h2>
      ) : (
        <h2 className="tr-logo tr-rise" style={{ ...delay(100), fontSize: 'clamp(1.9rem, 8vw, 2.8rem)' }}>
          {hasMoreRounds ? `Manche ${state.currentRound}/${state.totalRounds}` : 'Terminé !'}
        </h2>
      )}
      <p className="tr-final tr-rise" style={delay(250)}>{displayed}</p>
      <p className="tr-label tr-rise" style={delay(400)}>taps</p>
      {hasMoreRounds && (
        <p className="tr-hint tr-rise" style={delay(500)}>Prochaine manche dans quelques secondes…</p>
      )}
      {isLastRound && state.roundSnapshots && state.roundSnapshots.length > 0 && (
        <button className="tr-ghostbtn tr-rise" style={delay(500)} onClick={() => setShowParty(true)}>
          Score de la partie
        </button>
      )}
      {isLastRound && onViewGlobalLeaderboard && (
        <button className="tr-ghostbtn tr-rise" style={delay(620)} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
    </div>
  )
}
