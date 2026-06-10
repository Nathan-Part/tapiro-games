import { z } from 'zod'

export const TapBatchSchema = z.object({ count: z.number().int().min(0) })
export const ScoreUpdateSchema = z.object({ score: z.number().int().min(0) })
export const LeaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().int().min(0),
})
export const LeaderboardUpdateSchema = z.object({
  players: z.array(LeaderboardEntrySchema),
})
export const GameStateUpdateSchema = z.object({
  phase: z.enum(['WAITING', 'COUNTDOWN', 'PLAYING', 'RESULTS']),
  countdown: z.number().int().optional(),
  timeLeft: z.number().int().optional(),
})

export type TapBatch = z.infer<typeof TapBatchSchema>
export type ScoreUpdate = z.infer<typeof ScoreUpdateSchema>
export type LeaderboardUpdate = z.infer<typeof LeaderboardUpdateSchema>
export type GameStateUpdate = z.infer<typeof GameStateUpdateSchema>

export const RejoinRoomSchema = z.object({
  code: z.string().min(1).max(10),
  token: z.string().uuid(),
})

export type RejoinRoom = z.infer<typeof RejoinRoomSchema>
