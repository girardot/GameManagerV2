import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateTag(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const { data: existing } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name: trimmed })
    .select('id')
    .single()

  if (error?.code === '23505') {
    const { data: found } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', trimmed)
      .single()
    return found?.id ?? null
  }

  return error ? null : data.id
}

export async function syncGameTags(
  supabase: SupabaseClient,
  userId: string,
  gameId: string,
  tagNames: string[]
): Promise<void> {
  await supabase.from('game_tags').delete().eq('game_id', gameId)

  const unique = [
    ...new Set(tagNames.map((n) => n.trim()).filter(Boolean)),
  ]

  for (const name of unique) {
    const tagId = await getOrCreateTag(supabase, userId, name)
    if (tagId) {
      await supabase.from('game_tags').insert({
        game_id: gameId,
        tag_id: tagId,
      })
    }
  }
}
