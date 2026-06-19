import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function friendProfile(f: Friendship, userId: string): Profile | undefined {
  return f.requester_id === userId ? f.addressee : f.requester
}

export function useFriendships() {
  const { user } = useAuth()
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    const rows = data ?? []
    const profileIds = rows.flatMap((r) => [r.requester_id, r.addressee_id])
    const profiles = await loadProfiles(profileIds)
    setFriendships(
      rows.map((row) =>
        mapFriendship(row as Record<string, unknown>, profiles)
      )
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const outgoingPending = useMemo(
    () =>
      friendships.filter(
        (f) => f.requester_id === user?.id && f.status === 'pending'
      ),
    [friendships, user?.id]
  )

  const incomingPending = useMemo(
    () =>
      friendships.filter(
        (f) => f.addressee_id === user?.id && f.status === 'pending'
      ),
    [friendships, user?.id]
  )

  const acceptedFriends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  )

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
    await refresh()
    return { error: null }
  }

  const cancelOutgoing = async (id: string) => {
    if (!supabase) return { error: 'Non configuré' }
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  const respondToRequest = async (
    id: string,
    status: 'accepted' | 'rejected'
  ) => {
    if (!supabase) return { error: 'Non configuré' }
    const { error } = await supabase
      .from('friendships')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  const removeFriend = async (id: string) => {
    if (!supabase) return { error: 'Non configuré' }
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  return {
    friendships,
    outgoingPending,
    incomingPending,
    acceptedFriends,
    loading,
    sendFriendRequest,
    cancelOutgoing,
    acceptRequest: (id: string) => respondToRequest(id, 'accepted'),
    rejectRequest: (id: string) => respondToRequest(id, 'rejected'),
    removeFriend,
    refresh,
  }
}
