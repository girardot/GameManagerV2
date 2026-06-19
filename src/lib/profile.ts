import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Ensure a profile row exists (for users created before migration 007). */
export async function ensureProfile(user: User) {
  if (!supabase || !user.email) return
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email.split('@')[0]
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      display_name: displayName,
    },
    { onConflict: 'id' }
  )
}
