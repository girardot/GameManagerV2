import * as XLSX from 'xlsx'
import { SupabaseClient } from '@supabase/supabase-js'
import type { ExportReport, GameProgress } from '../types'

const PROGRESS_EXPORT: Record<GameProgress, string> = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  done: 'DONE',
  abandoned: 'ABANDONED',
}

const PROGRESSIONS_LIST = ['TODO', 'IN_PROGRESS', 'DONE', 'ABANDONED']

function isMissingPriorityColumn(message: string) {
  return message.includes('priority') || message.includes('schema cache')
}

type Relation<T> = T | T[] | null

type ConsoleRef = {
  name: string
}

type ConsoleRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

type TagRef = {
  id: string
  name: string
}

type GameTagRelation = {
  tags: Relation<TagRef>
}

type GameRow = {
  id: string
  user_id: string
  console_id: string
  title: string
  is_digital: boolean
  progress: GameProgress
  notes: string | null
  pegi: number | null
  rating: number | null
  created_at: string
  updated_at: string
  consoles: Relation<ConsoleRef>
  game_tags?: GameTagRelation[] | null
}

type BuyRow = {
  id: string
  user_id: string
  title: string
  console_id: string | null
  is_digital: boolean | null
  price: number | string | null
  notes: string | null
  pegi: number | null
  rating: number | null
  priority?: number | null
  created_at: string
  consoles: Relation<ConsoleRef>
}

type PlayQueueRow = {
  id: string
  user_id: string
  title: string
  console_id: string | null
  game_id: string | null
  priority: number
  notes: string | null
  pegi: number | null
  rating: number | null
  created_at: string
  consoles: Relation<ConsoleRef>
  games: Relation<{
    title: string
    progress: GameProgress
    pegi: number | null
    rating: number | null
  }>
}

type TagRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

function firstRelation<T>(relation: Relation<T> | undefined): T | null {
  if (!relation) return null
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

function consoleName(row: { consoles: Relation<ConsoleRef> }) {
  return firstRelation(row.consoles)?.name ?? ''
}

function gameTags(game: GameRow) {
  return (game.game_tags ?? [])
    .map((gameTag) => firstRelation(gameTag.tags)?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

function sortByConsoleThenTitle<
  T extends { title: string; consoles: Relation<ConsoleRef> },
>(rows: T[]) {
  return rows.sort((a, b) => {
    const byConsole = consoleName(a).localeCompare(consoleName(b), 'fr')
    if (byConsole !== 0) return byConsole
    return a.title.localeCompare(b.title, 'fr')
  })
}

export async function exportToExcel(
  supabase: SupabaseClient,
  userId: string
): Promise<ExportReport> {
  const [gamesRes, consolesRes, buyPrimary, playQueueRes, tagsRes] =
    await Promise.all([
      supabase
        .from('games')
        .select(
          [
            'id',
            'user_id',
            'console_id',
            'title',
            'is_digital',
            'progress',
            'notes',
            'pegi',
            'rating',
            'created_at',
            'updated_at',
            'consoles(name)',
            'game_tags(tags(id, name))',
          ].join(', ')
        )
        .eq('user_id', userId),
      supabase
        .from('consoles')
        .select('id, user_id, name, created_at')
        .eq('user_id', userId)
        .order('name'),
      supabase
        .from('buy_list')
        .select(
          [
            'id',
            'user_id',
            'title',
            'console_id',
            'is_digital',
            'price',
            'notes',
            'pegi',
            'rating',
            'priority',
            'created_at',
            'consoles(name)',
          ].join(', ')
        )
        .eq('user_id', userId)
        .order('priority'),
      supabase
        .from('play_queue')
        .select(
          [
            'id',
            'user_id',
            'title',
            'console_id',
            'game_id',
            'priority',
            'notes',
            'pegi',
            'rating',
            'created_at',
            'consoles(name)',
            'games(title, progress, pegi, rating)',
          ].join(', ')
        )
        .eq('user_id', userId)
        .order('priority'),
      supabase
        .from('tags')
        .select('id, user_id, name, created_at')
        .eq('user_id', userId)
        .order('name'),
    ])

  if (gamesRes.error) {
    return { gamesCount: 0, buyCount: 0, error: gamesRes.error.message }
  }
  if (consolesRes.error) {
    return { gamesCount: 0, buyCount: 0, error: consolesRes.error.message }
  }
  if (playQueueRes.error) {
    return { gamesCount: 0, buyCount: 0, error: playQueueRes.error.message }
  }
  if (tagsRes.error) {
    return { gamesCount: 0, buyCount: 0, error: tagsRes.error.message }
  }

  let buyItems: BuyRow[] = (buyPrimary.data as BuyRow[]) ?? []
  if (buyPrimary.error) {
    if (isMissingPriorityColumn(buyPrimary.error.message)) {
      const { data, error } = await supabase
        .from('buy_list')
        .select(
          [
            'id',
            'user_id',
            'title',
            'console_id',
            'is_digital',
            'price',
            'notes',
            'pegi',
            'rating',
            'created_at',
            'consoles(name)',
          ].join(', ')
        )
        .eq('user_id', userId)
        .order('created_at')
      if (error) {
        return { gamesCount: 0, buyCount: 0, error: error.message }
      }
      buyItems = (data as BuyRow[]) ?? []
    } else {
      return { gamesCount: 0, buyCount: 0, error: buyPrimary.error.message }
    }
  }

  const games = sortByConsoleThenTitle((gamesRes.data as GameRow[]) ?? [])
  const consoles = ((consolesRes.data as ConsoleRow[]) ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  )
  const playQueue = ((playQueueRes.data as PlayQueueRow[]) ?? []).sort(
    (a, b) => a.priority - b.priority
  )
  const tags = ((tagsRes.data as TagRow[]) ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  )

  buyItems.sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER
    if (priorityA !== priorityB) return priorityA - priorityB
    return a.created_at.localeCompare(b.created_at)
  })

  const gamesAoA: unknown[][] = [
    [
      'Console',
      'Titre',
      'Demat',
      'Progression',
      'Notes',
      'PEGI',
      'Note /20',
      'Tags',
      'ID',
      'User ID',
      'Console ID',
      'Créé le',
      'Modifié le',
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
    const currentConsoleName = game ? consoleName(game) : ''

    gamesAoA.push([
      currentConsoleName,
      game?.title ?? '',
      game ? game.is_digital : '',
      game ? PROGRESS_EXPORT[game.progress] : '',
      game?.notes ?? '',
      game?.pegi ?? '',
      game?.rating ?? '',
      game ? gameTags(game).join(', ') : '',
      game?.id ?? '',
      game?.user_id ?? '',
      game?.console_id ?? '',
      game?.created_at ?? '',
      game?.updated_at ?? '',
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
      'Notes',
      'PEGI',
      'Note /20',
      'Priorité',
      'ID',
      'User ID',
      'Console ID',
      'Créé le',
    ],
  ]

  for (const item of buyItems) {
    buyAoA.push([
      item.title,
      consoleName(item),
      item.is_digital ?? '',
      item.price ?? '',
      item.notes ?? '',
      item.pegi ?? '',
      item.rating ?? '',
      item.priority ?? '',
      item.id,
      item.user_id,
      item.console_id ?? '',
      item.created_at,
    ])
  }

  const consolesAoA: unknown[][] = [
    ['ID', 'User ID', 'Nom', 'Créé le'],
    ...consoles.map((consoleItem) => [
      consoleItem.id,
      consoleItem.user_id,
      consoleItem.name,
      consoleItem.created_at,
    ]),
  ]

  const playQueueAoA: unknown[][] = [
    [
      'Priorité',
      'Titre',
      'Console',
      'Jeu lié',
      'Statut du jeu lié',
      'Notes',
      'PEGI',
      'Note /20',
      'ID',
      'User ID',
      'Console ID',
      'Game ID',
      'Créé le',
    ],
  ]

  for (const item of playQueue) {
    const linkedGame = firstRelation(item.games)
    playQueueAoA.push([
      item.priority,
      item.title,
      consoleName(item),
      linkedGame?.title ?? '',
      linkedGame ? PROGRESS_EXPORT[linkedGame.progress] : '',
      item.notes ?? '',
      item.pegi ?? '',
      item.rating ?? '',
      item.id,
      item.user_id,
      item.console_id ?? '',
      item.game_id ?? '',
      item.created_at,
    ])
  }

  const tagsAoA: unknown[][] = [
    ['ID', 'User ID', 'Nom', 'Créé le'],
    ...tags.map((tag) => [tag.id, tag.user_id, tag.name, tag.created_at]),
  ]

  const gameTagsAoA: unknown[][] = [
    ['Game ID', 'Jeu', 'Console', 'Tag ID', 'Tag'],
  ]
  for (const game of games) {
    for (const gameTag of game.game_tags ?? []) {
      const tag = firstRelation(gameTag.tags)
      if (!tag) continue
      gameTagsAoA.push([
        game.id,
        game.title,
        consoleName(game),
        tag.id,
        tag.name,
      ])
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(consolesAoA),
    'Consoles'
  )
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
    'Play Queue'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(tagsAoA),
    'Tags'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(gameTagsAoA),
    'Game Tags'
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
    error: null,
  }
}
