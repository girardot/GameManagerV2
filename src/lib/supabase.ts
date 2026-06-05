import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const PLACEHOLDER_PATTERNS = [
  'your-project',
  'your-anon-key',
  'example.com',
  'xxx',
]

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true
  const lower = value.toLowerCase()
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p))
}

export const supabaseConfigError: string | null = (() => {
  if (!url || !key) {
    return 'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes dans .env'
  }
  if (isPlaceholder(url) || isPlaceholder(key)) {
    return 'Le fichier .env contient encore les valeurs d’exemple. Copiez vos vraies clés depuis Supabase → Settings → API.'
  }
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return 'VITE_SUPABASE_URL doit ressembler à https://xxxxx.supabase.co'
  }
  const isPublishableKey = key.startsWith('sb_publishable_')
  const isLegacyAnonKey = key.startsWith('eyJ')
  if (!isPublishableKey && !isLegacyAnonKey) {
    return 'VITE_SUPABASE_ANON_KEY invalide. Utilisez la Publishable key (sb_publishable_…) ou l’ancienne anon key (eyJ…) depuis Supabase → Settings → API Keys.'
  }
  if (isLegacyAnonKey && key.length < 100) {
    return 'La clé anon (JWT) semble tronquée. Recopiez-la entièrement depuis Supabase.'
  }
  return null
})()

export const isSupabaseConfigured = supabaseConfigError === null

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
