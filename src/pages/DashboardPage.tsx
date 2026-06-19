import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { friendProfile, useFriendships } from '../hooks/useFriendships'
import { profileLabel } from '../lib/profile'
import { Card, Badge, Button } from '../components/ui'
import { GameMetaBadges } from '../components/GameMetaBadges'
import { PROGRESS_LABELS, type GameProgress, type PegiRating } from '../types'

type NextToPlayItem = {
  title: string
  consoleName: string | null
  pegi: PegiRating | null
  rating: number | null
}

type NextToBuyItem = {
  title: string
  consoleName: string | null
  price: number | null
  pegi: PegiRating | null
  rating: number | null
}

type GameMeta = {
  pegi: PegiRating | null
  rating: number | null
}

function resolveQueueMeta(
  item: {
    title: string
    console_id: string | null
    game_id: string | null
    pegi: PegiRating | null
    rating: number | null
    games?: { pegi: PegiRating | null; rating: number | null } | Array<{
      pegi: PegiRating | null
      rating: number | null
    }> | null
  },
  gameMetaById: Map<string, GameMeta>,
  gameMetaByKey: Map<string, GameMeta>
): GameMeta {
  const joined = item.games
  const joinedGame = Array.isArray(joined) ? joined[0] : joined
  const matched =
    (item.game_id ? gameMetaById.get(item.game_id) : undefined) ??
    (item.console_id
      ? gameMetaByKey.get(`${item.console_id}:${item.title}`)
      : undefined)
  return {
    pegi: joinedGame?.pegi ?? matched?.pegi ?? item.pegi ?? null,
    rating: joinedGame?.rating ?? matched?.rating ?? item.rating ?? null,
  }
}

function consoleNameFromJoin(
  c: { name: string } | { name: string }[] | null | undefined
): string | null {
  const consoleName = Array.isArray(c) ? c[0]?.name : c?.name
  return consoleName ?? null
}

export function DashboardPage() {
  const { user } = useAuth()
  const {
    incomingPending,
    outgoingPending,
    loading: friendshipsLoading,
    acceptRequest,
    rejectRequest,
  } = useFriendships()
  const [actingId, setActingId] = useState<string | null>(null)
  const [nextToPlay, setNextToPlay] = useState<NextToPlayItem[]>([])
  const [nextToBuy, setNextToBuy] = useState<NextToBuyItem[]>([])
  const [stats, setStats] = useState({
    total: 0,
    byProgress: {} as Record<GameProgress, number>,
    consoles: 0,
    playQueue: 0,
    buyList: 0,
    buyTotal: 0,
  })

  useEffect(() => {
    if (!supabase || !user) return

    async function load() {
      const [gamesRes, consolesRes, queueRes, buyListRes, queueListRes] =
        await Promise.all([
          supabase!.from('games').select('id, title, console_id, progress, pegi, rating').eq('user_id', user!.id),
          supabase!
            .from('consoles')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user!.id),
          supabase!
            .from('play_queue')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user!.id),
          supabase!
            .from('buy_list')
            .select('title, price, pegi, rating, consoles(name)')
            .eq('user_id', user!.id)
            .order('priority'),
          supabase!
            .from('play_queue')
            .select(
              'title, console_id, game_id, pegi, rating, consoles(name), games(pegi, rating)'
            )
            .eq('user_id', user!.id)
            .order('priority'),
        ])

      const byProgress: Record<GameProgress, number> = {
        todo: 0,
        in_progress: 0,
        done: 0,
        abandoned: 0,
      }
      for (const g of gamesRes.data ?? []) {
        const p = g.progress as GameProgress
        if (p in byProgress) byProgress[p]++
      }

      const buyItems = buyListRes.data ?? []
      const buyTotal = buyItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0),
        0
      )

      setStats({
        total: gamesRes.data?.length ?? 0,
        byProgress,
        consoles: consolesRes.count ?? 0,
        playQueue: queueRes.count ?? 0,
        buyList: buyItems.length,
        buyTotal,
      })

      const abandonedGames = (gamesRes.data ?? []).filter(
        (g) => g.progress === 'abandoned'
      )
      const abandonedIds = new Set(abandonedGames.map((g) => g.id))
      const abandonedKeys = new Set(
        abandonedGames.map((g) => `${g.console_id}:${g.title}`)
      )

      const gameMetaById = new Map<string, GameMeta>()
      const gameMetaByKey = new Map<string, GameMeta>()
      for (const g of gamesRes.data ?? []) {
        const meta: GameMeta = {
          pegi: g.pegi as PegiRating | null,
          rating: g.rating,
        }
        gameMetaById.set(g.id, meta)
        gameMetaByKey.set(`${g.console_id}:${g.title}`, meta)
      }

      const nextItems = (queueListRes.data ?? [])
        .filter(
          (item: {
            game_id: string | null
            console_id: string | null
            title: string
          }) => {
            if (item.game_id && abandonedIds.has(item.game_id)) return false
            if (
              item.console_id &&
              abandonedKeys.has(`${item.console_id}:${item.title}`)
            ) {
              return false
            }
            return true
          }
        )
        .slice(0, 3)
        .map((item) => {
          const consoleName = consoleNameFromJoin(
            item.consoles as
              | { name: string }
              | { name: string }[]
              | null
              | undefined
          )
          const { pegi, rating } = resolveQueueMeta(
            item as Parameters<typeof resolveQueueMeta>[0],
            gameMetaById,
            gameMetaByKey
          )
          return {
            title: item.title,
            consoleName: consoleName ?? null,
            pegi,
            rating,
          }
        })

      setNextToPlay(nextItems)

      setNextToBuy(
        buyItems.slice(0, 3).map((item) => ({
          title: item.title,
          consoleName: consoleNameFromJoin(
            item.consoles as
              | { name: string }
              | { name: string }[]
              | null
              | undefined
          ),
          price: item.price != null ? Number(item.price) : null,
          pegi: item.pegi as PegiRating | null,
          rating: item.rating,
        }))
      )
    }

    load()
  }, [user])

  const runFriendAction = async (
    id: string,
    action: () => Promise<{ error: string | null }>
  ) => {
    setActingId(id)
    await action()
    setActingId(null)
  }

  const hasPendingFriendships =
    incomingPending.length > 0 || outgoingPending.length > 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {(nextToPlay.length > 0 || nextToBuy.length > 0) && (
        <div
          className={`grid gap-4 ${
            nextToPlay.length > 0 && nextToBuy.length > 0
              ? 'md:grid-cols-2'
              : ''
          }`}
        >
          {nextToPlay.length > 0 && (
            <Link
              to="/a-jouer"
              className="block h-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 transition hover:border-yellow-500/50"
            >
              <p className="text-sm font-medium text-yellow-300">
                {nextToPlay.length === 1
                  ? 'Prochain à jouer'
                  : 'Prochains à jouer'}
              </p>
              <ol className="mt-2 space-y-3">
                {nextToPlay.map((game, idx) => (
                  <li key={`${game.title}-${idx}`} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-sm font-bold text-yellow-300">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-tight">
                        {game.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {game.consoleName && (
                          <span className="text-sm text-slate-400">
                            {game.consoleName}
                          </span>
                        )}
                        <GameMetaBadges pegi={game.pegi} rating={game.rating} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Link>
          )}

          {nextToBuy.length > 0 && (
            <Link
              to="/a-acheter"
              className="block h-full rounded-xl border border-green-500/30 bg-green-500/10 p-5 transition hover:border-green-500/50"
            >
              <p className="text-sm font-medium text-green-300">
                {nextToBuy.length === 1
                  ? 'Prochain à acheter'
                  : 'Prochains à acheter'}
              </p>
              <ol className="mt-2 space-y-3">
                {nextToBuy.map((game, idx) => (
                  <li key={`buy-${game.title}-${idx}`} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-300">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-tight">
                        {game.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {game.consoleName && (
                          <span className="text-sm text-slate-400">
                            {game.consoleName}
                          </span>
                        )}
                        {game.price != null && (
                          <span className="text-sm font-semibold text-green-300">
                            {game.price.toFixed(2)} €
                          </span>
                        )}
                        <GameMetaBadges pegi={game.pegi} rating={game.rating} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Link>
          )}
        </div>
      )}

      {hasPendingFriendships && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-200">
              Demandes d&apos;amis
            </h2>
            <Link
              to="/amis"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Voir tout
            </Link>
          </div>

          {friendshipsLoading ? (
            <p className="text-sm text-slate-400">Chargement…</p>
          ) : (
            <div
              className={`grid gap-4 ${
                incomingPending.length > 0 && outgoingPending.length > 0
                  ? 'md:grid-cols-2'
                  : ''
              }`}
            >
              {incomingPending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-400">Reçues</p>
                  <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                    {incomingPending.map((f) => {
                      const profile = friendProfile(f, user!.id)
                      return (
                        <li
                          key={f.id}
                          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
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
                                runFriendAction(f.id, () => acceptRequest(f.id))
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
                                runFriendAction(f.id, () => rejectRequest(f.id))
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
                </div>
              )}

              {outgoingPending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-400">Envoyées</p>
                  <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                    {outgoingPending.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 p-3 text-sm text-slate-200"
                      >
                        <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                        <span className="min-w-0 truncate">
                          {profileLabel(
                            f.addressee?.email ?? '…',
                            f.addressee?.display_name
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          En attente
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          to="/collection"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-indigo-500"
        >
          <p className="text-2xl font-bold text-indigo-400">{stats.total}</p>
          <p className="text-sm text-slate-400">Jeux</p>
        </Link>
        <Link
          to="/collection"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-indigo-500"
        >
          <p className="text-2xl font-bold">{stats.consoles}</p>
          <p className="text-sm text-slate-400">Consoles</p>
        </Link>
        <Link
          to="/a-jouer"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-indigo-500"
        >
          <p className="text-2xl font-bold text-yellow-400">{stats.playQueue}</p>
          <p className="text-sm text-slate-400">À jouer</p>
        </Link>
        <Link
          to="/a-acheter"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-indigo-500"
        >
          <p className="text-2xl font-bold text-green-400">{stats.buyList}</p>
          <p className="text-sm text-slate-400">À acheter</p>
        </Link>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Progression</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROGRESS_LABELS) as GameProgress[]).map((p) => (
            <Badge
              key={p}
              color={
                p === 'done'
                  ? 'green'
                  : p === 'in_progress'
                    ? 'yellow'
                    : p === 'abandoned'
                      ? 'red'
                      : 'indigo'
              }
            >
              {PROGRESS_LABELS[p]}: {stats.byProgress[p]}
            </Badge>
          ))}
        </div>
      </Card>

      {stats.buyTotal > 0 && (
        <Card>
          <p className="text-sm text-slate-400">Budget à acheter (prix renseignés)</p>
          <p className="text-xl font-bold text-green-400">
            {stats.buyTotal.toFixed(2)} €
          </p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/collection"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-indigo-500 transition"
        >
          <p className="font-medium">Collection</p>
          <p className="text-sm text-slate-400">Voir et modifier vos jeux</p>
        </Link>
        <Link
          to="/a-jouer"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-indigo-500 transition"
        >
          <p className="font-medium">À jouer</p>
          <p className="text-sm text-slate-400">File priorisée</p>
        </Link>
        <Link
          to="/a-acheter"
          className="rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-indigo-500 transition"
        >
          <p className="font-medium">À acheter</p>
          <p className="text-sm text-slate-400">Liste d’achats</p>
        </Link>
      </div>
    </div>
  )
}
