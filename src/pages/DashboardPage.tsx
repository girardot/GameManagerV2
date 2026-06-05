import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Badge } from '../components/ui'
import { PROGRESS_LABELS, type GameProgress } from '../types'

export function DashboardPage() {
  const { user } = useAuth()
  const [nextToPlay, setNextToPlay] = useState<{
    title: string
    consoleName: string | null
  } | null>(null)
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
      const [gamesRes, consolesRes, queueRes, buyRes, nextRes] =
        await Promise.all([
          supabase!.from('games').select('progress').eq('user_id', user!.id),
          supabase!
            .from('consoles')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user!.id),
          supabase!
            .from('play_queue')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user!.id),
          supabase!.from('buy_list').select('price').eq('user_id', user!.id),
          supabase!
            .from('play_queue')
            .select('title, consoles(name)')
            .eq('user_id', user!.id)
            .order('priority')
            .limit(1)
            .maybeSingle(),
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

      const buyTotal = (buyRes.data ?? []).reduce(
        (sum, item) => sum + (Number(item.price) || 0),
        0
      )

      setStats({
        total: gamesRes.data?.length ?? 0,
        byProgress,
        consoles: consolesRes.count ?? 0,
        playQueue: queueRes.count ?? 0,
        buyList: buyRes.data?.length ?? 0,
        buyTotal,
      })

      if (nextRes.data) {
        const c = nextRes.data.consoles as
          | { name: string }
          | { name: string }[]
          | null
        const consoleName = Array.isArray(c) ? c[0]?.name : c?.name
        setNextToPlay({
          title: nextRes.data.title,
          consoleName: consoleName ?? null,
        })
      } else {
        setNextToPlay(null)
      }
    }

    load()
  }, [user])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {nextToPlay && (
        <Link
          to="/a-jouer"
          className="block rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 transition hover:border-yellow-500/50"
        >
          <p className="text-sm font-medium text-yellow-300">Prochain à jouer</p>
          <p className="mt-1 text-xl font-bold">{nextToPlay.title}</p>
          {nextToPlay.consoleName && (
            <p className="mt-1 text-sm text-slate-400">{nextToPlay.consoleName}</p>
          )}
        </Link>
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
