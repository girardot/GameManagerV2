import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Filter,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
} from '../components/ui'
import { GameMetaBadges } from '../components/GameMetaBadges'
import {
  PROGRESS_LABELS,
  PROGRESS_OPTIONS,
  type Console,
  type Game,
  type GameProgress,
  type Profile,
  type Tag,
} from '../types'

const progressBadgeColor: Record<
  GameProgress,
  'indigo' | 'yellow' | 'green' | 'red'
> = {
  todo: 'indigo',
  in_progress: 'yellow',
  done: 'green',
  abandoned: 'red',
}

function parseGame(row: Record<string, unknown>): Game {
  const rawTags = row.game_tags as
    | Array<{ tags: Tag | Tag[] | null }>
    | undefined
  const tags = (rawTags ?? [])
    .map((gt) => (Array.isArray(gt.tags) ? gt.tags[0] : gt.tags))
    .filter((t): t is Tag => Boolean(t))
  const { game_tags: _gt, ...rest } = row
  return { ...(rest as unknown as Game), tags }
}

function profileTitle(profile: Profile | null) {
  if (!profile) return 'Collection'
  if (profile.display_name) return `Collection de ${profile.display_name}`
  return `Collection de ${profile.email}`
}

export function FriendCollectionPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [consoles, setConsoles] = useState<Console[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [filterConsole, setFilterConsole] = useState('')
  const [filterProgress, setFilterProgress] = useState('')
  const [filterDigital, setFilterDigital] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [collapsedConsoles, setCollapsedConsoles] = useState<Set<string>>(
    new Set()
  )

  const load = useCallback(async () => {
    if (!supabase || !user || !userId) return
    setLoading(true)

    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
      )
      .maybeSingle()

    if (!friendship) {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)

    const [profileRes, gamesRes, consolesRes, tagsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, display_name')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('games')
        .select(
          '*, consoles(name), game_tags(tags(id, name, user_id, created_at))'
        )
        .eq('user_id', userId)
        .order('title'),
      supabase.from('consoles').select('*').eq('user_id', userId).order('name'),
      supabase.from('tags').select('*').eq('user_id', userId).order('name'),
    ])

    setProfile((profileRes.data as Profile | null) ?? null)
    setGames(
      (gamesRes.data ?? []).map((row) =>
        parseGame(row as Record<string, unknown>)
      )
    )
    setConsoles((consolesRes.data as Console[]) ?? [])
    setTags((tagsRes.data as Tag[]) ?? [])
    setLoading(false)
  }, [user, userId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = games.filter((g) => {
    if (filterConsole && g.console_id !== filterConsole) return false
    if (filterProgress && g.progress !== filterProgress) return false
    if (filterDigital === 'digital' && !g.is_digital) return false
    if (filterDigital === 'physical' && g.is_digital) return false
    if (search && !g.title.toLowerCase().includes(search.toLowerCase()))
      return false
    if (filterTag && !g.tags?.some((t) => t.id === filterTag)) return false
    return true
  })

  const groupedByConsole = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; games: Game[] }>()
    for (const game of filtered) {
      const existing = groups.get(game.console_id)
      if (existing) {
        existing.games.push(game)
      } else {
        groups.set(game.console_id, {
          id: game.console_id,
          name: game.consoles?.name ?? 'Console inconnue',
          games: [game],
        })
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((group) => ({
        ...group,
        games: group.games.sort((a, b) =>
          a.title.localeCompare(b.title, 'fr')
        ),
      }))
  }, [filtered])

  const toggleConsole = (consoleId: string) => {
    setCollapsedConsoles((prev) => {
      const next = new Set(prev)
      if (next.has(consoleId)) next.delete(consoleId)
      else next.add(consoleId)
      return next
    })
  }

  const allCollapsed =
    groupedByConsole.length > 0 &&
    groupedByConsole.every((g) => collapsedConsoles.has(g.id))

  const toggleAllConsoles = () => {
    if (allCollapsed) {
      setCollapsedConsoles(new Set())
    } else {
      setCollapsedConsoles(new Set(groupedByConsole.map((g) => g.id)))
    }
  }

  if (allowed === false) {
    return (
      <div className="space-y-4">
        <Link
          to="/amis"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux amis
        </Link>
        <Card>
          <p className="text-sm text-slate-300">
            Vous n&apos;avez pas accès à cette collection. L&apos;amitié doit
            être acceptée.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        to="/amis"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux amis
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          {profileTitle(profile)}
        </h1>
        {profile?.display_name && (
          <p className="mt-1 text-sm text-slate-400">{profile.email}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">Lecture seule</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Console</Label>
            <Select
              value={filterConsole}
              onChange={(e) => setFilterConsole(e.target.value)}
            >
              <option value="">Toutes</option>
              {consoles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Progression</Label>
            <Select
              value={filterProgress}
              onChange={(e) => setFilterProgress(e.target.value)}
            >
              <option value="">Toutes</option>
              {PROGRESS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROGRESS_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Format</Label>
            <Select
              value={filterDigital}
              onChange={(e) => setFilterDigital(e.target.value)}
            >
              <option value="">Tous</option>
              <option value="physical">Physique</option>
              <option value="digital">Démat</option>
            </Select>
          </div>
          <div>
            <Label>Tag</Label>
            <Select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">Tous</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {filtered.length} jeu{filtered.length !== 1 ? 'x' : ''}
          {loading && ' — chargement…'}
        </p>
        {groupedByConsole.length > 0 && (
          <Button variant="ghost" onClick={toggleAllConsoles}>
            <ChevronsDownUp className="h-4 w-4" />
            {allCollapsed ? 'Tout déplier' : 'Tout replier'}
          </Button>
        )}
      </div>

      {!loading && groupedByConsole.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">Aucun jeu à afficher.</p>
        </Card>
      )}

      <div className="hidden md:block space-y-4">
        {groupedByConsole.map((group) => {
          const collapsed = collapsedConsoles.has(group.id)
          return (
            <div
              key={group.id}
              className="overflow-x-auto rounded-xl border border-slate-800"
            >
              <button
                type="button"
                onClick={() => toggleConsole(group.id)}
                className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-left hover:bg-slate-800/80 transition"
              >
                <span className="flex items-center gap-2">
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-semibold text-indigo-300">
                    {group.name}
                  </span>
                </span>
                <span className="text-sm text-slate-500">
                  {group.games.length} jeu{group.games.length !== 1 ? 'x' : ''}
                </span>
              </button>
              {!collapsed && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50 text-left text-slate-400">
                    <tr>
                      <th className="p-3">Titre</th>
                      <th className="p-3">Format</th>
                      <th className="p-3">PEGI / Note</th>
                      <th className="p-3">Progression</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.games.map((g) => (
                      <tr key={g.id} className="border-t border-slate-800">
                        <td className="p-3 font-medium">
                          <p>{g.title}</p>
                          {g.notes && (
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                              {g.notes}
                            </p>
                          )}
                          {g.tags && g.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {g.tags.map((t) => (
                                <Badge key={t.id} color="slate">
                                  {t.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {g.is_digital ? 'Démat' : 'Physique'}
                        </td>
                        <td className="p-3">
                          <GameMetaBadges pegi={g.pegi} rating={g.rating} />
                          {g.pegi == null && g.rating == null && '—'}
                        </td>
                        <td className="p-3">
                          <Badge color={progressBadgeColor[g.progress]}>
                            {PROGRESS_LABELS[g.progress]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

      <div className="md:hidden space-y-4">
        {groupedByConsole.map((group) => {
          const collapsed = collapsedConsoles.has(group.id)
          return (
            <div key={group.id} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleConsole(group.id)}
                className="flex w-full items-center justify-between rounded-lg bg-slate-900 px-3 py-2.5 text-left hover:bg-slate-800 transition"
              >
                <span className="flex items-center gap-2">
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-semibold text-indigo-300">
                    {group.name}
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  {group.games.length} jeu{group.games.length !== 1 ? 'x' : ''}
                </span>
              </button>
              {!collapsed &&
                group.games.map((g) => (
                  <Card key={g.id}>
                    <p className="font-medium">{g.title}</p>
                    {g.notes && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {g.notes}
                      </p>
                    )}
                    {g.tags && g.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.tags.map((t) => (
                          <Badge key={t.id} color="slate">
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-sm text-slate-400">
                      {g.is_digital ? 'Démat' : 'Physique'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <GameMetaBadges pegi={g.pegi} rating={g.rating} />
                      <Badge color={progressBadgeColor[g.progress]}>
                        {PROGRESS_LABELS[g.progress]}
                      </Badge>
                    </div>
                  </Card>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
