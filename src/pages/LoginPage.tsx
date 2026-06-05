import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabaseConfigError } from '../lib/supabase'
import { Button, Input, Label, Card } from '../components/ui'

export function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">Chargement…</p>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    const result = isRegister
      ? await signUp(email, password)
      : await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else if (result.needsEmailConfirmation) {
      setMessage(
        'Compte créé. Un email de confirmation vous a été envoyé : cliquez sur le lien avant de vous connecter. Vérifiez aussi les spams.'
      )
      setIsRegister(false)
    } else if (isRegister) {
      setMessage('Compte créé. Vous pouvez vous connecter.')
      setIsRegister(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md space-y-4">
          <h1 className="text-xl font-bold text-indigo-400">Game Manager</h1>
          <p className="text-sm text-red-400 font-medium">
            {supabaseConfigError ?? 'Configuration Supabase manquante'}
          </p>
          <div className="text-sm text-slate-400 space-y-2">
            <p>
              1. Créez un projet sur{' '}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline"
              >
                supabase.com
              </a>
            </p>
            <p>
              2. Ouvrez <strong>Settings → API Keys</strong> et copiez l’URL du
              projet et la <strong>Publishable key</strong>{' '}
              (<code className="text-indigo-300">sb_publishable_…</code>)
            </p>
            <p>
              3. Collez-les dans <code className="text-indigo-300">.env</code>{' '}
              à la racine du projet
            </p>
            <p>
              4. Exécutez le SQL de{' '}
              <code className="text-indigo-300">
                supabase/migrations/001_initial.sql
              </code>{' '}
              dans le SQL Editor Supabase
            </p>
            <p>5. Redémarrez le serveur : <code className="text-indigo-300">npm run dev</code></p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-indigo-400">Game Manager</h1>
        <p className="mb-6 text-sm text-slate-400">
          Gérez votre collection de jeux vidéo
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              <p>{error}</p>
              {(error.toLowerCase().includes('invalid') ||
                error.toLowerCase().includes('credentials')) && (
                <p className="mt-2 text-slate-400">
                  Vérifiez email et mot de passe. Si vous venez de vous inscrire,
                  confirmez d’abord votre email (lien reçu par mail).
                </p>
              )}
            </div>
          )}
          {message && (
            <p className="text-sm text-green-400 rounded-lg bg-green-500/10 p-3">
              {message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? '…'
              : isRegister
                ? 'Créer un compte'
                : 'Se connecter'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          type="button"
          onClick={async () => {
            setError(null)
            const { error: err } = await signInWithGoogle()
            if (err) setError(err)
          }}
        >
          Google
        </Button>
        <p className="mt-2 text-xs text-slate-500 text-center">
          Google nécessite la configuration OAuth dans Supabase (Authentication →
          Providers) et l’URL de redirection :{' '}
          <code className="text-indigo-300">{window.location.origin}</code>
        </p>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-indigo-400"
          onClick={() => {
            setIsRegister(!isRegister)
            setError(null)
            setMessage(null)
          }}
        >
          {isRegister
            ? 'Déjà un compte ? Se connecter'
            : 'Pas de compte ? S’inscrire'}
        </button>
      </Card>
    </div>
  )
}
