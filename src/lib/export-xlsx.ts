import * as XLSX from 'xlsx'
import { SupabaseClient } from '@supabase/supabase-js'
import type { ExportReport, GameProgress, Tag } from '../types'

const PROGRESS_EXPORT: Record<GameProgress, string> = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  done: 'DONE',
  abandoned: 'ABANDONED',
}

const PROGRESSIONS_LIST = ['TODO', 'IN_PROGRESS', 'DONE', 'ABANDONED']

function isMissingPriorityColumn(message: string) {
  return message.includes('priority')
}

function consoleName(
  consoles: { name: string } | { name: string }[] | null | undefined
): string {
  if (!consoles) return ''
  return Array.isArray(consoles) ? (consoles[0]?.name ?? '') : (consoles.name ?? '')
}

function parseGameTags(row: Record<string, unknown>): string {
  const rawTags = row.game_tags as
    | Array<{ tags: Tag | Tag[] | null }>
    | undefined
  return (rawTags ?? [])
    .map((gt) => (Array.isArray(gt.tags) ? gt.tags[0] : gt.tags))
    .filter((t): t is Tag => Boolean(t))
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .join(', ')
}

type GameMeta = {
  pegi: number | null
  rating: number | null
  notes: string | null
}

function resolvePlayQueueFields(
  item: {
    title: string
    console_id: string | null
    game_id: string | null
    notes: string | null
    pegi: number | null
    rating: number | null
    games?:
      | { pegi: number | null; rating: number | null; notes: string | null }
      | Array<{
          pegi: number | null
          rating: number | null
          notes: string | null
        }>
      | null
  },
  gameMetaById: Map<string, GameMeta>,
  gameMetaByKey: Map<string, GameMeta>
) {
  const joined = item.games
  const joinedGame = Array.isArray(joined) ? joined[0] : joined
  const metaFromId = item.game_id ? gameMetaById.get(item.game_id) : undefined
  const metaFromKey =
    item.console_id != null
      ? gameMetaByKey.get(`${item.console_id}:${item.title}`)
      : undefined
  const matched = metaFromId ?? metaFromKey

  const pegi = joinedGame?.pegi ?? matched?.pegi ?? item.pegi
  const rating = joinedGame?.rating ?? matched?.rating ?? item.rating
  const notes = item.notes ?? joinedGame?.notes ?? matched?.notes

  return {
    pegi: pegi ?? '',
    rating: rating ?? '',
    notes: notes ?? '',
  }
}

export async function exportToExcel(
  supabase: SupabaseClient,
  userId: string
): Promise<ExportReport> {
  const [gamesRes, consolesRes, buyPrimary, playQueueRes] = await Promise.all([
    supabase
      .from('games')
      .select(
        'id, title, console_id, is_digital, progress, notes, pegi, rating, consoles(name), game_tags(tags(name))'
      )
      .eq('user_id', userId),
    supabase.from('consoles').select('name').eq('user_id', userId).order('name'),
    supabase
      .from('buy_list')
      .select(
        'title, is_digital, price, pegi, rating, notes, priority, consoles(name)'
      )
      .eq('user_id', userId)
      .order('priority'),
    supabase
      .from('play_queue')
      .select(
        'title, priority, notes, pegi, rating, console_id, game_id, consoles(name), games(pegi, rating, notes)'
      )
      .eq('user_id', userId)
      .order('priority'),
  ])

  if (gamesRes.error) {
    return {
      gamesCount: 0,
      buyCount: 0,
      playQueueCount: 0,
      error: gamesRes.error.message,
    }
  }
  if (consolesRes.error) {
    return {
      gamesCount: 0,
      buyCount: 0,
      playQueueCount: 0,
      error: consolesRes.error.message,
    }
  }
  if (playQueueRes.error) {
    return {
      gamesCount: 0,
      buyCount: 0,
      playQueueCount: 0,
      error: playQueueRes.error.message,
    }
  }

  type BuyRow = {
    title: string
    is_digital: boolean | null
    price: number | null
    pegi: number | null
    rating: number | null
    notes: string | null
    priority?: number
    consoles: { name: string } | { name: string }[] | null
  }

  let buyItems: BuyRow[] = (buyPrimary.data as BuyRow[]) ?? []
  if (buyPrimary.error) {
    if (isMissingPriorityColumn(buyPrimary.error.message)) {
      const { data, error } = await supabase
        .from('buy_list')
        .select(
          'title, is_digital, price, pegi, rating, notes, consoles(name)'
        )
        .eq('user_id', userId)
        .order('created_at')
      if (error) {
        return {
          gamesCount: 0,
          buyCount: 0,
          playQueueCount: 0,
          error: error.message,
        }
      }
      buyItems = ((data as BuyRow[]) ?? []).map((item, i) => ({
        ...item,
        priority: i + 1,
      }))
    } else {
      return {
        gamesCount: 0,
        buyCount: 0,
        playQueueCount: 0,
        error: buyPrimary.error.message,
      }
    }
  }

  type GameRow = {
    id: string
    title: string
    console_id: string
    is_digital: boolean
    progress: GameProgress
    notes: string | null
    pegi: number | null
    rating: number | null
    consoles: { name: string } | { name: string }[] | null
    game_tags?: Array<{ tags: Tag | Tag[] | null }>
  }

  const gameRows = (gamesRes.data as GameRow[]) ?? []

  const gameMetaById = new Map<string, GameMeta>()
  const gameMetaByKey = new Map<string, GameMeta>()
  for (const g of gameRows) {
    const meta: GameMeta = {
      pegi: g.pegi,
      rating: g.rating,
      notes: g.notes,
    }
    gameMetaById.set(g.id, meta)
    gameMetaByKey.set(`${g.console_id}:${g.title}`, meta)
  }

  const games = [...gameRows].sort((a, b) => {
    const byConsole = consoleName(a.consoles).localeCompare(
      consoleName(b.consoles),
      'fr'
    )
    if (byConsole !== 0) return byConsole
    return a.title.localeCompare(b.title, 'fr')
  })

  type PlayQueueRow = {
    title: string
    priority: number
    notes: string | null
    pegi: number | null
    rating: number | null
    console_id: string | null
    game_id: string | null
    consoles: { name: string } | { name: string }[] | null
    games?:
      | { pegi: number | null; rating: number | null; notes: string | null }
      | Array<{
          pegi: number | null
          rating: number | null
          notes: string | null
        }>
      | null
  }

  const playQueue = (playQueueRes.data as PlayQueueRow[]) ?? []

  const consoles = consolesRes.data ?? []

  const gamesAoA: unknown[][] = [
    [
      'Console',
      'Titre',
      'Demat',
      'Progression',
      'Notes',
      'PEGI',
      'Note',
      'Tags',
      '',
      'Progressions',
      'Consoles',
    ],
  ]

  const maxGameRows = Math.max(
    games.length,
    PROGRESSIONS_LIST.length,
    consoles.length
  )

  for (let i = 0; i < maxGameRows; i++) {
    const game = games[i]
    const tags = game ? parseGameTags(game as Record<string, unknown>) : ''

    gamesAoA.push([
      game ? consoleName(game.consoles) : '',
      game?.title ?? '',
      game ? game.is_digital : '',
      game ? PROGRESS_EXPORT[game.progress] : '',
      game?.notes ?? '',
      game?.pegi ?? '',
      game?.rating ?? '',
      tags,
      '',
      PROGRESSIONS_LIST[i] ?? '',
      consoles[i]?.name ?? '',
    ])
  }

  const buyAoA: unknown[][] = [
    [
      'To Buy',
      'Console',
      'demate',
      'Prix',
      'PEGI',
      'Note',
      'Notes',
      'Priorité',
    ],
  ]

  for (const item of buyItems) {
    buyAoA.push([
      item.title,
      consoleName(item.consoles) || '',
      item.is_digital ?? '',
      item.price ?? '',
      item.pegi ?? '',
      item.rating ?? '',
      item.notes ?? '',
      item.priority ?? '',
    ])
  }

  const playQueueAoA: unknown[][] = [
    ['Priorité', 'Titre', 'Console', 'Notes', 'PEGI', 'Note'],
  ]

  for (const item of playQueue) {
    const fields = resolvePlayQueueFields(item, gameMetaById, gameMetaByKey)
    playQueueAoA.push([
      item.priority,
      item.title,
      consoleName(item.consoles) || '',
      fields.notes,
      fields.pegi,
      fields.rating,
    ])
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(gamesAoA),
    'Games'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(buyAoA),
    'To Buy'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(playQueueAoA),
    'To Play'
  )

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Games.xlsx'
  link.click()
  URL.revokeObjectURL(url)

  return {
    gamesCount: games.length,
    buyCount: buyItems.length,
    playQueueCount: playQueue.length,
    error: null,
  }
}
