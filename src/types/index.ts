export type GameProgress = 'todo' | 'in_progress' | 'done' | 'abandoned'

export interface Console {
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
  created_at: string
  updated_at: string
  consoles?: { name: string }
}

export interface PlayQueueItem {
  id: string
  user_id: string
  title: string
  console_id: string | null
  game_id: string | null
  priority: number
  notes: string | null
  created_at: string
  consoles?: { name: string } | null
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
  created_at: string
  consoles?: { name: string } | null
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
