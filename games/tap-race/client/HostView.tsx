import { useState } from 'react'
import type { HostViewState, LeaderboardEntry, TeamScore } from './types'
import PartyResultsPanel from './PartyResultsPanel'
import Confetti from './fx/Confetti'
import { useCountUp } from './fx/useCountUp'
import './tap-race.css'

interface Props {
  state: HostViewState
  qrUrl?: string
  onStart?: () => void
  onViewGlobalLeaderboard?: () => void
  onReturnHome?: () => void
}

const ROW_HEIGHT = 60
const ROW_STEP = 72
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

export default function HostView({ state, qrUrl, onStart, onViewGlobalLeaderboard, onReturnHome }: Props) {
  if (state.phase === 'WAITING') {
    return <WaitingScreen state={state} qrUrl={qrUrl} onStart={onStart} />
  }
  if (state.phase === 'COUNTDOWN') {
    return <CountdownScreen state={state} />
  }
  if (state.phase === 'PLAYING') {
    return <PlayingScreen state={state} />
  }
  return <ResultsScreen state={state} onViewGlobalLeaderboard={onViewGlobalLeaderboard} onReturnHome={onReturnHome} />
}

/* ---------- WAITING : QR géant + lobby ---------- */

function WaitingScreen({ state, qrUrl, onStart }: { state: HostViewState; qrUrl?: string; onStart?: () => void }) {
  const players = state.leaderboard
  return (
    <div className="tr-screen tr-screen--host" style={{ justifyContent: 'center', gap: '1.3rem' }}>
      <div className="tr-ambient" aria-hidden="true" />
      <div className="tr-gridfloor" aria-hidden="true" />

      <p className="tr-kicker tr-rise">/// scan &amp; play ///</p>
      <h1 className="tr-logo tr-logo--breathe tr-rise" style={{ ...delay(80), fontSize: 'clamp(2.6rem, 8vmin, 5.2rem)' }}>
        Tap&nbsp;Race
      </h1>

      {qrUrl && (
        <div className="tr-qr tr-rise" style={delay(180)}>
          <img className="tr-qr__img" src={qrUrl} alt="QR code" />
          <p className="tr-qr__code">{state.roomCode}</p>
          <p className="tr-qr__label">scannez pour rejoindre</p>
        </div>
      )}

      {state.totalRounds && state.totalRounds > 1 && (
        <p className="tr-round-badge tr-rise" style={delay(240)}>{state.totalRounds} manches</p>
      )}

      {onStart && (
        <button className="tr-start tr-rise" style={delay(280)} onClick={onStart}>
          Démarrer la partie
        </button>
      )}

      {players.length === 0 ? (
        <p className="tr-empty tr-rise" style={delay(360)}>En attente de joueurs…</p>
      ) : (
        <div className="tr-lobby tr-lobby--host tr-rise" style={delay(360)}>
          <p className="tr-lobby__count">
            {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
          </p>
          <ul className="tr-lobby__list">
            {players.map((p, i) => {
              const team = state.teams?.find(t => t.id === p.teamId)
              return (
                <li
                  key={p.id}
                  className="tr-chip"
                  style={{
                    animationDelay: `${Math.min(i * 40, 600)}ms`,
                    ...(team ? { border: `2px solid ${team.color}`, background: `${team.color}14`, boxShadow: `0 0 10px ${team.color}40` } : {}),
                  }}
                >
                  {p.name}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------- COUNTDOWN : chiffre explosif ---------- */

function CountdownScreen({ state }: { state: HostViewState }) {
  return (
    <div className="tr-screen">
      <div className="tr-ambient" aria-hidden="true" />
      {state.totalRounds && state.totalRounds > 1 && (
        <p className="tr-round-badge">Manche {state.currentRound ?? 1}/{state.totalRounds}</p>
      )}
      <p className="tr-label" style={{ fontSize: '1.3rem' }}>Prêt ?</p>
      <div className="tr-count">
        <span key={state.countdown} className="tr-count__ring" aria-hidden="true" />
        <p key={`d${state.countdown}`} className="tr-count__digit">{state.countdown}</p>
      </div>
      <p className="tr-hint" style={{ fontSize: '1rem' }}>
        {state.leaderboard.length} joueur{state.leaderboard.length > 1 ? 's' : ''} sur la grille de départ
      </p>
    </div>
  )
}

/* ---------- PLAYING : timer géant + classement live ---------- */

function PlayingScreen({ state }: { state: HostViewState }) {
  const gameDuration = state.gameDuration ?? 60
  const danger = state.timeLeft <= 10
  const frenzy = state.frenzy ?? false
  return (
    <div
      className="tr-screen tr-screen--host"
      data-danger={danger && !frenzy ? 'true' : 'false'}
      data-frenzy={frenzy ? 'true' : 'false'}
    >
      <div className={`tr-ambient${frenzy ? ' tr-ambient--frenzy' : danger ? ' tr-ambient--danger' : ''}`} aria-hidden="true" />

      {frenzy && (
        <div className="tr-frenzy-banner tr-frenzy-banner--host" aria-live="polite">
          ⚡ GOLDEN TAP ×2 ⚡
        </div>
      )}

      <div className="tr-timerzone" style={{ maxWidth: 700 }}>
        {state.totalRounds && state.totalRounds > 1 && (
          <p className="tr-round-badge" style={{ marginBottom: '0.4rem' }}>
            Manche {state.currentRound ?? 1}/{state.totalRounds}
          </p>
        )}
        <p className={`tr-htimer${frenzy ? ' tr-htimer--frenzy' : ''}`}>{state.timeLeft}s</p>
        <div className="tr-timerbar" style={{ height: 9 }}>
          <div
            className={`tr-timerbar__fill${frenzy ? ' tr-timerbar__fill--frenzy' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, (state.timeLeft / gameDuration) * 100))}%` }}
          />
        </div>
        <p className="tr-live">En jeu</p>
      </div>

      {state.teams && state.teams.length >= 2 && typeof state.ropePosition === 'number'
        ? <TugRope teams={state.teams} ropePosition={state.ropePosition} />
        : state.teams && state.teams.length >= 2
          ? <TeamBattle teams={state.teams} />
          : null
      }

      <RankedBoard entries={state.leaderboard} teams={state.teams} />
    </div>
  )
}

function TeamBattle({ teams }: { teams: TeamScore[] }) {
  const total = teams.reduce((sum, t) => sum + t.score, 0)
  const maxScore = Math.max(...teams.map(t => t.score))
  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: 700, alignItems: 'stretch' }}>
      {teams.map(t => {
        const share = total > 0 ? t.score / total : 1 / teams.length
        const grow = Math.min(0.8, Math.max(0.2, share))
        const leading = total > 0 && t.score === maxScore
        return (
          <div key={t.id} style={{
            flexGrow: grow, flexBasis: 0, minWidth: 0, textAlign: 'center', padding: '1rem', borderRadius: 12,
            background: `${t.color}18`, border: `2px solid ${t.color}`,
            boxShadow: leading ? `0 0 26px ${t.color}55` : 'none',
            transition: 'flex-grow 0.35s ease, box-shadow 0.35s ease',
          }}>
            <p style={{ margin: 0, fontSize: '1rem', color: t.color, fontFamily: 'monospace', fontWeight: 'bold' }}>{t.name}</p>
            <p style={{
              margin: 0, fontWeight: 'bold', color: '#fff',
              fontSize: `${(2 + grow * 1.8).toFixed(2)}rem`, transition: 'font-size 0.35s ease',
            }}>{t.score}</p>
          </div>
        )
      })}
    </div>
  )
}

function TugRope({ teams, ropePosition }: { teams: TeamScore[]; ropePosition: number }) {
  const [teamA, teamB] = teams
  const flagPos = Math.max(5, Math.min(95, ropePosition * 100))
  const aLeads = ropePosition < 0.5
  return (
    <div className="tr-tugrope" style={{ width: '100%', maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: aLeads ? teamA.color : '#555', fontSize: '1.1rem' }}>
          {teamA.name} {teamA.score}
        </span>
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: !aLeads ? teamB.color : '#555', fontSize: '1.1rem' }}>
          {teamB.score} {teamB.name}
        </span>
      </div>
      <div className="tr-tugrope__track">
        <div className="tr-tugrope__fill--a" style={{ width: `${flagPos}%`, background: teamA.color }} />
        <div className="tr-tugrope__flag" style={{ left: `${flagPos}%`, borderColor: aLeads ? teamA.color : teamB.color }}>
          ⚑
        </div>
        <div className="tr-tugrope__fill--b" style={{ width: `${100 - flagPos}%`, background: teamB.color }} />
      </div>
    </div>
  )
}

function RankedBoard({ entries, teams }: { entries: LeaderboardEntry[]; teams?: TeamScore[] }) {
  if (entries.length === 0) {
    return <p className="tr-empty">En attente de joueurs…</p>
  }
  const activeEntries = entries.filter(e => !e.eliminated)
  const eliminatedEntries = entries.filter(e => e.eliminated)
  const sorted = [...activeEntries, ...eliminatedEntries]
  const max = Math.max(1, ...sorted.map(e => e.score))
  return (
    <div className="tr-board" style={{ height: sorted.length * ROW_STEP - (ROW_STEP - ROW_HEIGHT) }}>
      {sorted.map((e, i) => {
        const team = teams?.find(t => t.id === e.teamId)
        const isElim = e.eliminated ?? false
        return (
          <div
            key={e.id}
            className={`tr-boardrow${i === 0 && e.score > 0 && !isElim ? ' tr-boardrow--lead' : ''}${isElim ? ' tr-boardrow--eliminated' : ''}`}
            style={{ transform: `translateY(${i * ROW_STEP}px)`, borderLeft: team ? `3px solid ${team.color}` : undefined }}
          >
            <div className="tr-boardrow__bar" style={{ width: `${(e.score / max) * 100}%` }} aria-hidden="true" />
            <span className={`tr-rank${!isElim && i < 3 ? ` tr-rank--${i + 1}` : ''}`}>{isElim ? '✕' : i + 1}</span>
            <span className="tr-boardrow__name">{e.name}</span>
            <AnimatedScore value={e.score} />
          </div>
        )
      })}
    </div>
  )
}

function AnimatedScore({ value }: { value: number }) {
  const displayed = useCountUp(value, 280)
  return <span className="tr-boardrow__score">{displayed}</span>
}

/* ---------- RESULTS : podium + confettis ---------- */

const PODIUM_HEIGHTS = ['clamp(160px, 26vh, 240px)', 'clamp(110px, 18vh, 170px)', 'clamp(85px, 14vh, 135px)']
const PODIUM_DELAYS = [850, 450, 100]

function ResultsScreen({ state, onViewGlobalLeaderboard, onReturnHome }: { state: HostViewState; onViewGlobalLeaderboard?: () => void; onReturnHome?: () => void }) {
  const [showParty, setShowParty] = useState(false)
  const medals = state.leaderboard.slice(0, 3)
  const rest = state.leaderboard.slice(3)
  const slots = [medals[1], medals[0], medals[2]]
  const ranks = [2, 1, 3]
  const isLastRound = state.isFinalResults || !state.totalRounds || !state.currentRound || state.currentRound >= state.totalRounds
  const hasMoreRounds = !state.isFinalResults && state.totalRounds && state.currentRound && state.currentRound < state.totalRounds
  const isSolo = !state.mode || state.mode === 'solo'
  const entryScore = (e: LeaderboardEntry) => state.isFinalResults ? (e.totalScore ?? e.score) : e.score
  const teamOf = (e: LeaderboardEntry) => state.teams?.find(t => t.id === e.teamId)

  if (showParty && state.roundSnapshots) {
    return (
      <PartyResultsPanel
        snapshots={state.roundSnapshots}
        finalLeaderboard={state.leaderboard}
        onClose={() => setShowParty(false)}
      />
    )
  }

  return (
    <div className="tr-screen tr-screen--host" style={{ justifyContent: 'center' }}>
      <div className="tr-ambient" aria-hidden="true" />
      <div className="tr-gridfloor" aria-hidden="true" />
      {isLastRound && <Confetti delay={1100} />}

      <p className="tr-kicker tr-rise">/// {hasMoreRounds ? `fin manche ${state.currentRound}` : 'course terminée'} ///</p>

      {state.teams && state.teams.length >= 2 ? (() => {
        const winner = state.teams!.reduce((a, b) => a.score >= b.score ? a : b)
        return (
          <div className="tr-rise" style={{ ...delay(80), textAlign: 'center' }}>
            {isLastRound && (
              <>
                <p style={{ margin: '0 0 0.3rem', fontSize: '1rem', color: '#aaa', fontFamily: 'monospace' }}>équipe gagnante</p>
                <h2 style={{ margin: 0, fontSize: 'clamp(2.2rem, 8vmin, 4rem)', fontWeight: 'bold', color: winner.color }}>
                  🏆 {winner.name}
                </h2>
              </>
            )}
            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', marginTop: '0.8rem' }}>
              {state.teams!.map(t => (
                <div key={t.id} style={{
                  textAlign: 'center', padding: '0.7rem 1.6rem', borderRadius: 12,
                  background: `${t.color}14`, border: `2px solid ${t.id === winner.id ? t.color : t.color + '44'}`,
                  boxShadow: t.id === winner.id ? `0 0 28px ${t.color}55` : 'none',
                  minWidth: 120, transition: 'box-shadow 0.4s',
                }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: t.color, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.08em' }}>{t.name}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: 'clamp(2rem, 5vmin, 3.2rem)', fontWeight: 'bold', color: t.id === winner.id ? t.color : '#999', fontFamily: 'var(--tr-display)' }}>{t.score}</p>
                  {t.id === winner.id && isLastRound && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: t.color }}>🏆 Victoire</p>}
                </div>
              ))}
            </div>
          </div>
        )
      })() : (
        <h2 className="tr-logo tr-rise" style={{ ...delay(80), fontSize: 'clamp(2rem, 6vmin, 3.6rem)' }}>
          {hasMoreRounds ? `Manche ${state.currentRound}/${state.totalRounds}` : 'Résultats finaux'}
        </h2>
      )}

      {medals.length === 0 ? (
        <p className="tr-empty">Aucun participant…</p>
      ) : (
        <div className="tr-podium">
          {slots.map((entry, i) =>
            entry ? (
              <div
                key={entry.id}
                className={`tr-podium__slot tr-podium__slot--${ranks[i]}`}
                style={delay(PODIUM_DELAYS[i])}
              >
                <p className="tr-podium__name">
                  {teamOf(entry) && <span style={{ display: 'inline-block', width: 3, height: '0.85em', borderRadius: 2, background: teamOf(entry)!.color, boxShadow: `0 0 6px ${teamOf(entry)!.color}`, marginRight: '0.35em', verticalAlign: 'middle' }} />}
                  {entry.name}
                </p>
                <p className="tr-podium__score">{entryScore(entry)}</p>
                <div className="tr-podium__col" style={{ height: PODIUM_HEIGHTS[ranks[i] - 1] }}>
                  {ranks[i]}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="tr-resultlist">
          {rest.map((e, i) => {
            const team = teamOf(e)
            return (
              <li key={e.id} className="tr-resultrow" style={{ ...delay(1100 + i * 90), borderLeft: team ? `3px solid ${team.color}` : undefined }}>
                <span className="tr-rank">{i + 4}</span>
                <span className="tr-resultrow__name">{e.name}</span>
                <span className="tr-resultrow__score">{entryScore(e)}</span>
              </li>
            )
          })}
        </ol>
      )}

      {hasMoreRounds && (
        <p className="tr-hint tr-rise" style={delay(500)}>
          Prochaine manche dans quelques secondes…
        </p>
      )}

      {isLastRound && state.roundSnapshots && state.roundSnapshots.length > 0 && (
        <button className="tr-ghostbtn tr-rise" style={delay(1300)} onClick={() => setShowParty(true)}>
          Score de la partie
        </button>
      )}
      {isLastRound && isSolo && onViewGlobalLeaderboard && (
        <button className="tr-ghostbtn tr-rise" style={delay(1450)} onClick={onViewGlobalLeaderboard}>
          Voir score global
        </button>
      )}
      {isLastRound && onReturnHome && (
        <button className="tr-ghostbtn tr-rise" style={delay(isSolo ? 1570 : 1450)} onClick={onReturnHome}>
          Retour au menu
        </button>
      )}
    </div>
  )
}
