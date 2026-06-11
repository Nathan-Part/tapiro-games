import { useState } from 'react'
import type { LeaderboardEntry } from './types'
import './tap-race.css'

export interface RoundSnapshot { round: number; players: LeaderboardEntry[] }

interface Props {
  snapshots: RoundSnapshot[]
  finalLeaderboard: LeaderboardEntry[]
  onClose: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

export default function PartyResultsPanel({ snapshots, finalLeaderboard, onClose }: Props) {
  const hasMany = snapshots.length > 1
  const [selected, setSelected] = useState<number | 'final'>(hasMany ? 'final' : (snapshots[0]?.round ?? 1))

  const entries = selected === 'final'
    ? finalLeaderboard
    : (snapshots.find(s => s.round === selected)?.players ?? [])

  const scoreOf = (e: LeaderboardEntry) =>
    selected === 'final' ? (e.totalScore ?? e.score) : e.score

  return (
    <div className="tr-party-panel">
      <div className="tr-party-panel__head">
        <p className="tr-kicker">/// score de la partie ///</p>
        <button className="tr-ghostbtn" style={{ padding: '0.3rem 0.9rem', fontSize: '0.85rem' }} onClick={onClose}>
          ✕ Fermer
        </button>
      </div>

      {snapshots.length > 0 && (
        <div className="tr-party-panel__tabs">
          {snapshots.map(s => (
            <button
              key={s.round}
              className={`tr-round-tab${selected === s.round ? ' tr-round-tab--active' : ''}`}
              onClick={() => setSelected(s.round)}
            >
              Manche {s.round}
            </button>
          ))}
          {hasMany && (
            <button
              className={`tr-round-tab tr-round-tab--final${selected === 'final' ? ' tr-round-tab--active' : ''}`}
              onClick={() => setSelected('final')}
            >
              Résultat final
            </button>
          )}
        </div>
      )}

      <ol className="tr-party-panel__list">
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={`tr-resultrow tr-rise${e.eliminated ? ' tr-boardrow--eliminated' : ''}`}
            style={delay(i * 50)}
          >
            <span
              className="tr-rank"
              style={{ color: i < 3 ? ['var(--tr-gold)', 'var(--tr-silver)', 'var(--tr-bronze)'][i] : 'var(--tr-ink-faint)' }}
            >
              {i < 3 ? MEDALS[i] : `#${i + 1}`}
            </span>
            <span className="tr-resultrow__name">{e.name}</span>
            <span className="tr-resultrow__score">{scoreOf(e)}</span>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="tr-hint" style={{ padding: '1.5rem 0', textAlign: 'center' }}>Aucun participant</li>
        )}
      </ol>
    </div>
  )
}
