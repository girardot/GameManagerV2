import type { SupabaseClient } from '@supabase/supabase-js'

type PriorityTable = 'play_queue' | 'buy_list'

export async function persistPriorityOrder(
  client: SupabaseClient,
  table: PriorityTable,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      client.from(table).update({ priority: index + 1 }).eq('id', id)
    )
  )
}

export function applyPriorityOrder<T extends { id: string; priority?: number }>(
  items: T[],
  orderedIds: string[]
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return orderedIds.map((id, index) => {
    const item = byId.get(id)!
    return { ...item, priority: index + 1 }
  })
}
