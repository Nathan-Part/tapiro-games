import type { Phase } from './game'
import type { RoundSnapshot } from './PartyResultsPanel'
export type { RoundSnapshot }

export interface TeamScore {
  id: string
  name: string
  color: string
  score: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  totalScore?: number
  teamId?: string
  eliminated?: boolean
}

export interface PlayerViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  score: number
  totalScore?: number
  playerName: string
  teamId?: string
  teams?: TeamScore[]
  waitingPlayers?: { id: string; name: string; teamId?: string }[]
  totalPlayers?: number
  frenzy?: boolean
  eliminated?: boolean
  currentRound?: number
  totalRounds?: number
  gameDuration?: number
  ropePosition?: number
  connected?: boolean
  roundSnapshots?: RoundSnapshot[]
  mode?: string
}

export interface HostViewState {
  phase: Phase
  countdown: number
  timeLeft: number
  leaderboard: LeaderboardEntry[]
  roomCode?: string
  teams?: TeamScore[]
  frenzy?: boolean
  currentRound?: number
  totalRounds?: number
  ropePosition?: number
  isFinalResults?: boolean
  gameDuration?: number
  roundSnapshots?: RoundSnapshot[]
  mode?: string
}
