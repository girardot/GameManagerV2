export type GameProgress = 'todo' | 'in_progress' | 'done' | 'abandoned'

export type PegiRating = 3 | 7 | 12 | 16 | 18

export const PEGI_OPTIONS: PegiRating[] = [3, 7, 12, 16, 18]

export interface Console {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Game {
  id: string
  user_id: string
  console_id: string
  title: string
  is_digital: boolean
  progress: GameProgress
  notes: string | null
  pegi: PegiRating | null
  rating: number | null
  created_at: string
  updated_at: string
  consoles?: { name: string }
  tags?: Tag[]
}

export interface PlayQueueItem {
  id: string
  user_id: string
  title: string
  console_id: string | null
  game_id: string | null
  priority: number
  notes: string | null
  pegi: PegiRating | null
  rating: number | null
  created_at: string
  consoles?: { name: string } | null
  games?: {
    progress: GameProgress
    pegi: PegiRating | null
    rating: number | null
  } | null
}

/** Statut affiché sur la file « à jouer » (jeux non terminés / non abandonnés). */
export type PlayQueueStatus = 'todo' | 'in_progress'

export const PLAY_QUEUE_STATUS_LABELS: Record<PlayQueueStatus, string> = {
  todo: 'À jouer',
  in_progress: 'En cours',
}

export interface BuyListItem {
  id: string
  user_id: string
  title: string
  console_id: string | null
  is_digital: boolean | null
  price: number | null
  priority?: number
  notes: string | null
  pegi: PegiRating | null
  rating: number | null
  created_at: string
  consoles?: { name: string } | null
}

export function parseRating(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 20) return null
  return n
}

export const PROGRESS_LABELS: Record<GameProgress, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  abandoned: 'Abandonné',
}

export const PROGRESS_OPTIONS: GameProgress[] = [
  'todo',
  'in_progress',
  'done',
  'abandoned',
]

export interface ImportReport {
  consolesCreated: number
  gamesCreated: number
  gamesSkipped: number
  buyCreated: number
  buySkipped: number
  playQueueCreated: number
  errors: string[]
}

export interface ExportReport {
  gamesCount: number
  buyCount: number
  error: string | null
}
