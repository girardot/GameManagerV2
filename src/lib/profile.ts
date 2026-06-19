import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Ensure a profile row exists (for users created before migration 007). */
export async function ensureProfile(user: User) {
  if (!supabase || !user.email) return
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('profiles')
      .update({ email: user.email })
      .eq('id', user.id)
    return
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email.split('@')[0]
  await supabase.from('profiles').insert({
    id: user.id,
    email: user.email,
    display_name: displayName,
  })
}

export async function fetchProfile(userId: string) {
  if (!supabase) return { profile: null, error: 'Non configuré' }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) return { profile: null, error: error.message }
  return { profile: data, error: null }
}

export async function updateDisplayName(userId: string, displayName: string) {
  if (!supabase) return { error: 'Non configuré' }
  const trimmed = displayName.trim()
  if (!trimmed) return { error: 'Le pseudo ne peut pas être vide' }
  if (trimmed.length > 50) {
    return { error: 'Le pseudo ne peut pas dépasser 50 caractères' }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
  return { error: error?.message ?? null }
}

export function profileLabel(
  email: string,
  displayName: string | null | undefined
) {
  if (displayName && displayName !== email.split('@')[0]) {
    return `${displayName} (${email})`
  }
  return email
}
