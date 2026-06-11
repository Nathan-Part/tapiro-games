import { z } from 'zod'

export const MessageTypeSchema = z.enum(['INFRA', 'GAME'])

export const InfraEventSchema = z.enum(['JOIN', 'LEAVE', 'START', 'END'])

export const SocketMessageSchema = z.object({
  type: MessageTypeSchema,
  event: z.string(),
  roomCode: z.string().length(4),
  payload: z.unknown().optional(),
})

export type MessageType = z.infer<typeof MessageTypeSchema>
export type InfraEvent = z.infer<typeof InfraEventSchema>
export type SocketMessage = z.infer<typeof SocketMessageSchema>

/** Longueur des codes de room générés. 32^6 ≈ 1,07 milliard de combinaisons. */
export const ROOM_CODE_LENGTH = 6

/** Code de room normalisé (trim + majuscules), tolérant 4 à 10 caractères. */
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,10}$/)

export const JoinRoomSchema = z.object({
  code: RoomCodeSchema,
  name: z.string().trim().min(1).max(20),
  teamId: z.string().max(32).optional(),
})
export const HostRoomSchema = z.object({ code: RoomCodeSchema, token: z.string().min(1) })
export const StartGameSchema = z.object({ code: RoomCodeSchema, token: z.string().min(1) })
export const LeaveRoomSchema = z.object({ code: RoomCodeSchema })
export const RejoinRoomSchema = z.object({ code: RoomCodeSchema, token: z.string().uuid() })

export type JoinRoom = z.infer<typeof JoinRoomSchema>
export type HostRoom = z.infer<typeof HostRoomSchema>
export type StartGame = z.infer<typeof StartGameSchema>
export type LeaveRoom = z.infer<typeof LeaveRoomSchema>
export type RejoinRoom = z.infer<typeof RejoinRoomSchema>
