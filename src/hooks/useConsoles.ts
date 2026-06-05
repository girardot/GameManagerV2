import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Console } from '../types'

export function useConsoles() {
  const { user } = useAuth()
  const [consoles, setConsoles] = useState<Console[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConsoles = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('consoles')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setConsoles(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchConsoles()
  }, [fetchConsoles])

  const addConsole = async (name: string) => {
    if (!supabase || !user) return { error: 'Non connecté' }
    const { error } = await supabase
      .from('consoles')
      .insert({ user_id: user.id, name: name.trim() })
    if (!error) await fetchConsoles()
    return { error: error?.message ?? null }
  }

  const deleteConsole = async (id: string) => {
    if (!supabase) return { error: 'Non configuré' }
    const { error } = await supabase.from('consoles').delete().eq('id', id)
    if (!error) await fetchConsoles()
    return { error: error?.message ?? null }
  }

  return { consoles, loading, fetchConsoles, addConsole, deleteConsole }
}
