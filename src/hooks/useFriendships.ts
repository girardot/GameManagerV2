import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Friendship, Profile } from '../types'

function mapFriendship(
  row: Record<string, unknown>,
  profiles: Map<string, Profile>
): Friendship {
  const f = row as unknown as Friendship
  return {
    ...f,
    requester: profiles.get(f.requester_id),
    addressee: profiles.get(f.addressee_id),
  }
}

async function loadProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const map = new Map<string, Profile>()
  if (!supabase || ids.length === 0) return map
  const unique = [...new Set(ids)]
  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', unique)
  for (const p of data ?? []) {
    map.set(p.id, p as Profile)
  }
  return map
}

export function useFriendships() {
  const { user } = useAuth()
  const [outgoingPending, setOutgoingPending] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOutgoingPending = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const rows = data ?? []
    const profiles = await loadProfiles(rows.map((r) => r.addressee_id))
    setOutgoingPending(
      rows.map((row) =>
        mapFriendship(row as Record<string, unknown>, profiles)
      )
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchOutgoingPending()
  }, [fetchOutgoingPending])

  const sendFriendRequest = async (email: string) => {
    if (!supabase || !user) return { error: 'Non connecté' }
    const trimmed = email.trim()
    if (!trimmed) return { error: 'Indiquez une adresse e-mail' }

    const { data: found, error: findError } = await supabase.rpc(
      'find_profile_by_email',
      { search_email: trimmed }
    )
    if (findError) return { error: findError.message }
    const profile = (found as Profile[] | null)?.[0]
    if (!profile) {
      return { error: 'Aucun utilisateur trouvé avec cet e-mail' }
    }

    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: profile.id,
      status: 'pending',
    })
    if (error) {
      if (error.code === '23505') {
        return { error: 'Une demande existe déjà avec cet utilisateur' }
      }
      return { error: error.message }
    }
    await fetchOutgoingPending()
    return { error: null }
  }

  const cancelOutgoing = async (id: string) => {
    if (!supabase) return { error: 'Non configuré' }
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (!error) await fetchOutgoingPending()
    return { error: error?.message ?? null }
  }

  return {
    outgoingPending,
    loading,
    sendFriendRequest,
    cancelOutgoing,
    refresh: fetchOutgoingPending,
  }
}
