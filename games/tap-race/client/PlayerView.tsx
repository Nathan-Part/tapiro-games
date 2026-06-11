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
  onReturnHome?: () => void
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties
const PODIUM_HEIGHTS = ['clamp(160px, 26vh, 240px)', 'clamp(110px, 18vh, 170px)', 'clamp(85px, 14vh, 135px)']

export default function PlayerView({ state, onTap, onViewGlobalLeaderboard, onReturnHome }: Props) {
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
      <PlayerViewInner state={state} onTap={onTap} onViewGlobalLeaderboard={onViewGlobalLeaderboard} onReturnHome={onReturnHome} />
    </>
  )
}

function PlayerViewInner({ state, onTap, onViewGlobalLeaderboard, onReturnHome }: Props) {
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

  return <ResultsScreen state={state} onViewGlobalLeaderboard={onViewGlobalLeaderboard} onReturnHome={onReturnHome} />
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

function ResultsScreen({ state, onViewGlobalLeaderboard, onReturnHome }: { state: PlayerViewState; onViewGlobalLeaderboard?: () => void; onReturnHome?: () => void }) {
  const [showParty, setShowParty] = useState(false)
  const isLastRound = !state.totalRounds || !state.currentRound || state.currentRound >= state.totalRounds
  const hasMoreRounds = state.totalRounds && state.currentRound && state.currentRound < state.totalRounds
  const isSolo = !state.mode || state.mode === 'solo'

  const snapshots = state.roundSnapshots ?? []
  const latestPlayers = snapshots[snapshots.length - 1]?.players ?? []
  const entryScore = (e: { score: number; totalScore?: number }) => isLastRound ? (e.totalScore ?? e.score) : e.score
  const teamOf = (e: { teamId?: string }) => state.teams?.find(t => t.id === e.teamId)
  const isMe = (e: { name: string }) => e.name === state.playerName

  const medals = latestPlayers.slice(0, 3)
  const rest = latestPlayers.slice(3)
  const myRank = latestPlayers.findIndex(e => e.name === state.playerName) + 1
  const myEntry = latestPlayers.find(e => e.name === state.playerName)
  const myScore = isLastRound ? (state.totalScore ?? state.score) : state.score

  const winner = state.teams?.length ? state.teams.reduce((a, b) => a.score >= b.score ? a : b) : null
  const myTeam = state.teams?.find(t => t.id === state.teamId)
  const iWin = winner && myTeam && winner.id === myTeam.id
  const displayedScore = useCountUp(myScore, 900)

  if (showParty && state.roundSnapshots) {
    return (
      <PartyResultsPanel
        snapshots={state.roundSnapshots}
        finalLeaderboard={snapshots[snapshots.length - 1]?.players ?? []}
        onClose={() => setShowParty(false)}
      />
    )
  }

  return (
    <div className="tr-screen" style={{ overflowY: 'auto', justifyContent: 'flex-start', paddingTop: '1rem', gap: '0.8rem' }}>
      <div className="tr-ambient" aria-hidden="true" />
      {isLastRound && <Confetti />}
      <p className="tr-kicker tr-rise">/// {hasMoreRounds ? `fin manche ${state.currentRound}` : 'course terminée'} ///</p>

      {winner ? (
        <div className="tr-rise" style={{ ...delay(80), textAlign: 'center' }}>
          {isLastRound && (
            <>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.8rem', color: '#aaa', fontFamily: 'var(--tr-term)' }}>équipe gagnante</p>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', fontWeight: 'bold', color: iWin ? winner.color : '#888' }}>
                🏆 {winner.name}
              </h2>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', marginTop: '0.6rem' }}>
            {state.teams!.map(t => (
              <div key={t.id} style={{
                textAlign: 'center', padding: '0.5rem 1rem', borderRadius: 10,
                background: `${t.color}14`, border: `2px solid ${t.id === winner?.id ? t.color : t.color + '44'}`,
                boxShadow: t.id === winner?.id ? `0 0 16px ${t.color}44` : 'none',
                minWidth: 80,
              }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: t.color, fontFamily: 'var(--tr-term)' }}>{t.name}</p>
                <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 'bold', color: t.id === winner?.id ? t.color : '#888', fontFamily: 'var(--tr-display)' }}>{t.score}</p>
                {t.id === winner?.id && isLastRound && <p style={{ margin: 0, fontSize: '0.65rem', color: t.color }}>🏆</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <h2 className="tr-logo tr-rise" style={{ ...delay(80), fontSize: 'clamp(1.6rem, 7vw, 2.2rem)' }}>
          {hasMoreRounds ? `Manche ${state.currentRound}/${state.totalRounds}` : 'Terminé !'}
        </h2>
      )}

      {medals.length > 0 ? (
        <>
          <div className="tr-podium">
            {([medals[1], medals[0], medals[2]] as typeof medals).map((entry, i) => {
              if (!entry) return null
              const rank = [2, 1, 3][i]
              const me = isMe(entry)
              const team = teamOf(entry)
              return (
                <div
                  key={entry.id}
                  className={`tr-podium__slot tr-podium__slot--${rank}`}
                  style={delay([450, 850, 100][i])}
                >
                  <p className="tr-podium__name" style={me ? { color: 'var(--cyan)', textShadow: '0 0 14px rgba(0,245,255,0.8)' } : undefined}>{entry.name}</p>
                  <p className="tr-podium__score" style={me ? { color: 'var(--cyan)' } : undefined}>{entryScore(entry)}</p>
                  <div className="tr-podium__col" style={{ height: PODIUM_HEIGHTS[rank - 1], ...(team ? { borderLeft: `4px solid ${team.color}`, boxShadow: `inset 4px 0 10px ${team.color}40` } : {}) }}>
                    {rank}
                  </div>
                </div>
              )
            })}
          </div>

          {rest.length > 0 && (
            <ol className="tr-resultlist">
              {rest.map((e, i) => {
                const me = isMe(e)
                const team = teamOf(e)
                return (
                  <li key={e.id} className="tr-resultrow tr-rise" style={{ ...delay(1100 + i * 60), borderLeft: team ? `3px solid ${team.color}` : undefined }}>
                    <span className="tr-rank">{i + 4}</span>
                    <span className="tr-resultrow__name" style={me ? { color: 'var(--cyan)', fontWeight: 700 } : undefined}>{e.name}</span>
                    <span className="tr-resultrow__score" style={me ? { color: 'var(--cyan)' } : undefined}>{entryScore(e)}</span>
                  </li>
                )
              })}
            </ol>
          )}

          {(myRank === 0 || myRank > latestPlayers.length) && (
            <div style={{ width: '100%', maxWidth: 340, padding: '0.5rem 0.8rem', borderRadius: 9, background: 'rgba(0,245,255,0.08)', border: '1px solid var(--cyan)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--cyan)', fontFamily: 'var(--tr-term)', minWidth: '2rem' }}>Vous</span>
              <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--cyan)', fontWeight: 700 }}>{state.playerName}</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--cyan)', fontFamily: 'var(--tr-term)' }}>{myScore}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="tr-final tr-rise" style={delay(250)}>{displayedScore}</p>
          <p className="tr-label tr-rise" style={delay(400)}>taps</p>
        </>
      )}

      {myEntry && myRank > 0 && myRank <= latestPlayers.length && (
        <div className="tr-rise" style={{ ...delay(1200), textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#666', fontFamily: 'var(--tr-term)' }}>Votre classement</p>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--cyan)', textShadow: '0 0 16px rgba(0,245,255,0.8), 0 0 4px rgba(0,245,255,0.5)' }}>
            #{myRank} — {myScore} taps
          </p>
        </div>
      )}

      {hasMoreRounds && (
        <p className="tr-hint tr-rise" style={delay(500)}>Prochaine manche dans quelques secondes…</p>
      )}

      {isLastRound && state.roundSnapshots && state.roundSnapshots.length > 0 && (
        <button className="tr-ghostbtn tr-rise" style={delay(1300)} onClick={() => setShowParty(true)}>
          Score de la partie
        </button>
      )}
      {isLastRound && isSolo && onViewGlobalLeaderboard && (
        <button className="tr-ghostbtn tr-rise" style={delay(1420)} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
      {isLastRound && onReturnHome && (
        <button className="tr-ghostbtn tr-rise" style={delay(isSolo ? 1540 : 1420)} onClick={onReturnHome}>
          Retour au menu
        </button>
      )}
    </div>
  )
}
