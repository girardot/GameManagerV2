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
  return message.includes('priority')
}

export async function exportToExcel(
  supabase: SupabaseClient,
  userId: string
): Promise<ExportReport> {
  const [gamesRes, consolesRes, buyPrimary] = await Promise.all([
    supabase
      .from('games')
      .select('title, is_digital, progress, consoles(name)')
      .eq('user_id', userId),
    supabase.from('consoles').select('name').eq('user_id', userId).order('name'),
    supabase
      .from('buy_list')
      .select('title, is_digital, price, consoles(name)')
      .eq('user_id', userId)
      .order('priority'),
  ])

  if (gamesRes.error) {
    return { gamesCount: 0, buyCount: 0, error: gamesRes.error.message }
  }
  if (consolesRes.error) {
    return { gamesCount: 0, buyCount: 0, error: consolesRes.error.message }
  }

  type BuyRow = {
    title: string
    is_digital: boolean | null
    price: number | null
    consoles: { name: string } | { name: string }[] | null
  }

  let buyItems: BuyRow[] = (buyPrimary.data as BuyRow[]) ?? []
  if (buyPrimary.error) {
    if (isMissingPriorityColumn(buyPrimary.error.message)) {
      const { data, error } = await supabase
        .from('buy_list')
        .select('title, is_digital, price, consoles(name)')
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

  type GameRow = {
    title: string
    is_digital: boolean
    progress: GameProgress
    consoles: { name: string } | { name: string }[] | null
  }

  const games = (gamesRes.data as GameRow[] ?? []).sort((a, b) => {
    const consoleA =
      (Array.isArray(a.consoles) ? a.consoles[0]?.name : a.consoles?.name) ?? ''
    const consoleB =
      (Array.isArray(b.consoles) ? b.consoles[0]?.name : b.consoles?.name) ?? ''
    const byConsole = consoleA.localeCompare(consoleB, 'fr')
    if (byConsole !== 0) return byConsole
    return a.title.localeCompare(b.title, 'fr')
  })

  const consoles = consolesRes.data ?? []

  const gamesAoA: unknown[][] = [
    ['Console', 'Titre', 'Demat', 'Progression', '', 'Progressions', 'Consoles'],
  ]

  const maxGameRows = Math.max(
    games.length,
    PROGRESSIONS_LIST.length,
    consoles.length
  )

  for (let i = 0; i < maxGameRows; i++) {
    const game = games[i]
    const consoleName = game
      ? (Array.isArray(game.consoles)
          ? game.consoles[0]?.name
          : game.consoles?.name) ?? ''
      : ''

    gamesAoA.push([
      consoleName,
      game?.title ?? '',
      game ? game.is_digital : '',
      game ? PROGRESS_EXPORT[game.progress] : '',
      '',
      PROGRESSIONS_LIST[i] ?? '',
      consoles[i]?.name ?? '',
    ])
  }

  const buyAoA: unknown[][] = [
    ['To Buy', 'Console', 'demate', 'Prix'],
  ]

  for (const item of buyItems) {
    const c = item.consoles
    const consoleName = Array.isArray(c) ? c[0]?.name : c?.name
    buyAoA.push([
      item.title,
      consoleName ?? '',
      item.is_digital ?? '',
      item.price ?? '',
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
