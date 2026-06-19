import { useCallback, useEffect, useState } from 'react'
import { fetchProfile, updateDisplayName } from '../lib/profile'
import { useAuth } from './useAuth'
import type { Profile } from '../types'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { profile: data } = await fetchProfile(user.id)
    setProfile(data as Profile | null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveDisplayName = async (displayName: string) => {
    if (!user) return { error: 'Non connecté' }
    const { error } = await updateDisplayName(user.id, displayName)
    if (!error) await refresh()
    return { error }
  }

  return { profile, loading, saveDisplayName, refresh }
}
