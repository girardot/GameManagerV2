import * as XLSX from 'xlsx'
import { SupabaseClient } from '@supabase/supabase-js'
import type { GameProgress, ImportReport } from '../types'

function mapProgress(value: unknown): GameProgress {
  const v = String(value ?? '').toUpperCase().trim()
  if (v === 'IN_PROGRESS') return 'in_progress'
  if (v === 'DONE') return 'done'
  if (v === 'ABANDONED') return 'abandoned'
  return 'todo'
}

function parsePrice(value: unknown): number | null {
  if (value == null || value === '' || value === '?') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseBool(value: unknown): boolean {
  return value === true || value === 'TRUE' || value === 1
}

export async function importFromExcel(
  file: File,
  supabase: SupabaseClient,
  userId: string,
  addTodoToPlayQueue: boolean
): Promise<ImportReport> {
  const report: ImportReport = {
    consolesCreated: 0,
    gamesCreated: 0,
    gamesSkipped: 0,
    buyCreated: 0,
    buySkipped: 0,
    playQueueCreated: 0,
    errors: [],
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const { data: existingConsoles, error: consolesSelectError } = await supabase
    .from('consoles')
    .select('id, name')
    .eq('user_id', userId)

  if (consolesSelectError) {
    const msg = String(consolesSelectError.message ?? consolesSelectError)
    const looksLikeMissingTable =
      consolesSelectError.code === '42P01' ||
      msg.includes("Could not find the table 'public.consoles'") ||
      msg.includes('public.consoles') ||
      msg.includes('relation "public.consoles" does not exist')

    if (looksLikeMissingTable) {
      report.errors.push(
        `Table(s) Supabase manquante(s) : 'public.consoles'.` +
          `\nExécute la migration SQL [` +
          `supabase/migrations/001_initial.sql](/home/julien/git/GameManagerV2/supabase/migrations/001_initial.sql) dans le SQL Editor Supabase (et vérifie que les tables 'consoles', 'games', 'play_queue', 'buy_list' existent dans le schéma public).` +
          `\nUne fois fait, relance l’import.`
      )
      return report
    }

    report.errors.push(`Erreur lors de la récupération des consoles : ${msg}`)
    // On continue quand même : l'utilisateur verra la liste complète d'erreurs.
  }

  const consoleMap = new Map<string, string>()
  for (const c of existingConsoles ?? []) {
    consoleMap.set(c.name.toUpperCase(), c.id)
  }

  async function getOrCreateConsole(name: string): Promise<string | null> {
    const trimmed = name?.trim()
    if (!trimmed) return null
    const key = trimmed.toUpperCase()
    if (consoleMap.has(key)) return consoleMap.get(key)!

    const { data, error } = await supabase
      .from('consoles')
      .insert({ user_id: userId, name: trimmed })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: found } = await supabase
          .from('consoles')
          .select('id')
          .eq('user_id', userId)
          .eq('name', trimmed)
          .single()
        if (found) {
          consoleMap.set(key, found.id)
          return found.id
        }
      }
      report.errors.push(`Console "${trimmed}": ${error.message}`)
      return null
    }
    consoleMap.set(key, data.id)
    report.consolesCreated++
    return data.id
  }

  // Games sheet
  const gamesSheet = workbook.Sheets['Games']
  if (gamesSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(gamesSheet, {
      header: ['console', 'title', 'demat', 'progress'],
      range: 1,
    })

    let maxPriority = 0
    if (addTodoToPlayQueue) {
      const { data: queue } = await supabase
        .from('play_queue')
        .select('priority')
        .eq('user_id', userId)
        .order('priority', { ascending: false })
        .limit(1)
      maxPriority = queue?.[0]?.priority ?? 0
    }

    for (const row of rows) {
      const title = String(row.title ?? '').trim()
      const consoleName = String(row.console ?? '').trim()
      if (!title || !consoleName || title === 'Titre') continue

      const consoleId = await getOrCreateConsole(consoleName)
      if (!consoleId) continue

      const progress = mapProgress(row.progress)
      const is_digital = parseBool(row.demat)

      const { error } = await supabase.from('games').insert({
        user_id: userId,
        console_id: consoleId,
        title,
        is_digital,
        progress,
      })

      if (error) {
        if (error.code === '23505') report.gamesSkipped++
        else report.errors.push(`Jeu "${title}": ${error.message}`)
        continue
      }
      report.gamesCreated++

      if (
        addTodoToPlayQueue &&
        (progress === 'todo' || progress === 'in_progress')
      ) {
        maxPriority++
        const { error: qErr } = await supabase.from('play_queue').insert({
          user_id: userId,
          title,
          console_id: consoleId,
          priority: maxPriority,
        })
        if (!qErr) report.playQueueCreated++
      }
    }
  }

  // To Buy sheet
  const buySheet = workbook.Sheets['To Buy']
  if (buySheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(buySheet, {
      header: ['title', 'console', 'demat', 'price'],
      range: 1,
    })

    let maxBuyPriority = 0
    const { data: existingBuy } = await supabase
      .from('buy_list')
      .select('priority')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .limit(1)
    maxBuyPriority = existingBuy?.[0]?.priority ?? 0

    for (const row of rows) {
      const title = String(row.title ?? '').trim()
      if (!title || title === 'To Buy') continue

      const consoleName = String(row.console ?? '').trim()
      const consoleId = consoleName
        ? await getOrCreateConsole(consoleName)
        : null

      const dematVal = row.demat
      const is_digital =
        dematVal === null || dematVal === undefined || dematVal === ''
          ? null
          : parseBool(dematVal)

      maxBuyPriority++
      const { error } = await supabase.from('buy_list').insert({
        user_id: userId,
        title,
        console_id: consoleId,
        is_digital,
        price: parsePrice(row.price),
        priority: maxBuyPriority,
      })

      if (error) {
        report.buySkipped++
        report.errors.push(`À acheter "${title}": ${error.message}`)
      } else {
        report.buyCreated++
      }
    }
  }

  return report
}
