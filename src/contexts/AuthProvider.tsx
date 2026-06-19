import { useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/profile'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) void ensureProfile(session.user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) void ensureProfile(session.user)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase non configuré', needsEmailConfirmation: false }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      const msg = error.message
      const needsEmailConfirmation =
        msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('not confirmed')
      return { error: msg, needsEmailConfirmation }
    }
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
    }
    return { error: null, needsEmailConfirmation: false }
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase non configuré', needsEmailConfirmation: false }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    // Si confirmation email désactivée, session immédiate
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
      return { error: null, needsEmailConfirmation: false }
    }
    return {
      error: null,
      needsEmailConfirmation: !data.user?.email_confirmed_at,
    }
  }

  const signInWithGoogle = async () => {
    if (!supabase) return { error: 'Supabase non configuré' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
