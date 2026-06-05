import { createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
