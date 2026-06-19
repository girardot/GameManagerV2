import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Clock, X, Check, UserMinus, Users, Library } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  friendProfile,
  useFriendships,
} from '../hooks/useFriendships'
import { Button, Input, Card } from '../components/ui'

function profileLabel(email: string, displayName: string | null | undefined) {
  if (displayName && displayName !== email.split('@')[0]) {
    return `${displayName} (${email})`
  }
  return email
}

export function FriendsPage() {
  const {
    outgoingPending,
    incomingPending,
    acceptedFriends,
    loading,
    sendFriendRequest,
    cancelOutgoing,
    acceptRequest,
    rejectRequest,
    removeFriend,
  } = useFriendships()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    setSuccess(null)
    const { error: err } = await sendFriendRequest(email)
    if (err) setError(err)
    else {
      setSuccess('Demande envoyée')
      setEmail('')
    }
    setSending(false)
  }

  const runAction = async (id: string, action: () => Promise<{ error: string | null }>) => {
    setActingId(id)
    await action()
    setActingId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Amis</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envoyez une demande d&apos;ami par e-mail pour voir la collection
          d&apos;un autre utilisateur.
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">
          Ajouter un ami
        </h2>
        <form onSubmit={handleSend} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="adresse@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={sending}>
            <UserPlus className="h-4 w-4" />
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}
      </Card>

      {incomingPending.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">
            Demandes reçues
          </h2>
          <ul className="divide-y divide-slate-800">
            {incomingPending.map((f) => {
              const profile = friendProfile(f, user!.id)
              return (
                <li
                  key={f.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="truncate text-sm text-slate-200">
                    {profileLabel(
                      profile?.email ?? '…',
                      profile?.display_name
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={actingId === f.id}
                      onClick={() =>
                        runAction(f.id, () => acceptRequest(f.id))
                      }
                    >
                      <Check className="h-4 w-4" />
                      Accepter
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={actingId === f.id}
                      onClick={() =>
                        runAction(f.id, () => rejectRequest(f.id))
                      }
                    >
                      <X className="h-4 w-4" />
                      Refuser
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">
          Demandes envoyées
        </h2>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : outgoingPending.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande en attente.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {outgoingPending.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="truncate text-sm text-slate-200">
                    {profileLabel(
                      f.addressee?.email ?? '…',
                      f.addressee?.display_name
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    En attente
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-slate-400 hover:text-red-400"
                  onClick={() => cancelOutgoing(f.id)}
                  title="Annuler la demande"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Mes amis</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : acceptedFriends.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun ami pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {acceptedFriends.map((f) => {
              const profile = friendProfile(f, user!.id)
              const friendId =
                f.requester_id === user!.id ? f.addressee_id : f.requester_id
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-indigo-400" />
                    <span className="truncate text-sm text-slate-200">
                      {profileLabel(
                        profile?.email ?? '…',
                        profile?.display_name
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link
                      to={`/amis/${friendId}/collection`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-transparent px-3 py-2.5 text-sm font-medium text-indigo-400 transition hover:bg-slate-800 min-h-[44px]"
                      title="Voir la collection"
                    >
                      <Library className="h-4 w-4" />
                      <span className="hidden sm:inline">Collection</span>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-400"
                      disabled={actingId === f.id}
                      onClick={() =>
                        runAction(f.id, () => removeFriend(f.id))
                      }
                      title="Retirer cet ami"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
