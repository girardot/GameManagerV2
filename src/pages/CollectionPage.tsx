import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Play,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useConsoles } from '../hooks/useConsoles'
import { useTags } from '../hooks/useTags'
import { syncGameTags } from '../lib/tags'
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  Badge,
  Modal,
  Textarea,
} from '../components/ui'
import {
  PROGRESS_LABELS,
  PROGRESS_OPTIONS,
  PEGI_OPTIONS,
  type Game,
  type GameProgress,
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

export function CollectionPage() {
  const { user } = useAuth()
  const { consoles } = useConsoles()
  const { tags: allTags, fetchTags } = useTags()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [filterConsole, setFilterConsole] = useState('')
  const [filterProgress, setFilterProgress] = useState('')
  const [filterDigital, setFilterDigital] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [search, setSearch] = useState('')
  const [newTagInput, setNewTagInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [collapsedConsoles, setCollapsedConsoles] = useState<Set<string>>(
    new Set()
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Game | null>(null)
  const [form, setForm] = useState({
    title: '',
    console_id: '',
    is_digital: false,
    progress: 'todo' as GameProgress,
    notes: '',
    pegi: '' as '' | string,
    tagNames: [] as string[],
  })

  const fetchGames = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*, consoles(name), game_tags(tags(id, name, user_id, created_at))')
      .eq('user_id', user.id)
      .order('title')
    setGames((data ?? []).map((row) => parseGame(row as Record<string, unknown>)))
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

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

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      console_id: consoles[0]?.id ?? '',
      is_digital: false,
      progress: 'todo',
      notes: '',
      pegi: '',
      tagNames: [],
    })
    setNewTagInput('')
    setModalOpen(true)
  }

  const openEdit = (game: Game) => {
    setEditing(game)
    setForm({
      title: game.title,
      console_id: game.console_id,
      is_digital: game.is_digital,
      progress: game.progress,
      notes: game.notes ?? '',
      pegi: game.pegi != null ? String(game.pegi) : '',
      tagNames: game.tags?.map((t) => t.name) ?? [],
    })
    setNewTagInput('')
    setModalOpen(true)
  }

  const addTagName = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || form.tagNames.includes(trimmed)) return
    setForm({ ...form, tagNames: [...form.tagNames, trimmed] })
    setNewTagInput('')
  }

  const removeTagName = (name: string) => {
    setForm({
      ...form,
      tagNames: form.tagNames.filter((n) => n !== name),
    })
  }

  const saveGame = async () => {
    if (!supabase || !user || !form.title || !form.console_id) return
    const payload = {
      title: form.title.trim(),
      console_id: form.console_id,
      is_digital: form.is_digital,
      progress: form.progress,
      notes: form.notes.trim() || null,
      pegi: form.pegi ? (Number(form.pegi) as Game['pegi']) : null,
    }

    if (editing) {
      await supabase.from('games').update(payload).eq('id', editing.id)
      await syncGameTags(supabase, user.id, editing.id, form.tagNames)
    } else {
      const { data } = await supabase
        .from('games')
        .insert({ user_id: user.id, ...payload })
        .select('id')
        .single()
      if (data) await syncGameTags(supabase, user.id, data.id, form.tagNames)
    }
    setModalOpen(false)
    await Promise.all([fetchGames(), fetchTags()])
  }

  const deleteGame = async (id: string) => {
    if (!supabase || !confirm('Supprimer ce jeu ?')) return
    await supabase.from('games').delete().eq('id', id)
    fetchGames()
  }

  const markInProgress = async (id: string) => {
    if (!supabase) return
    await supabase
      .from('games')
      .update({ progress: 'in_progress' })
      .eq('id', id)
    fetchGames()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Collection</h1>
        <Button onClick={openCreate} disabled={consoles.length === 0}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {consoles.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">
            Ajoutez d’abord une console dans{' '}
            <a href="/parametres" className="text-indigo-400 underline">
              Paramètres
            </a>{' '}
            ou importez votre fichier Excel.
          </p>
        </Card>
      )}

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
              <option value="digital">Dématérialisé</option>
            </Select>
          </div>
          <div>
            <Label>Tag</Label>
            <Select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">Tous</option>
              {allTags.map((t) => (
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
                      <th className="p-3">PEGI</th>
                      <th className="p-3">Progression</th>
                      <th className="p-3 w-24" />
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
                          {g.pegi != null ? `PEGI ${g.pegi}` : '—'}
                        </td>
                        <td className="p-3">
                          <Badge color={progressBadgeColor[g.progress]}>
                            {PROGRESS_LABELS[g.progress]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {g.progress !== 'in_progress' && g.progress !== 'done' && (
                              <button
                                type="button"
                                onClick={() => markInProgress(g.id)}
                                title="Marquer en cours"
                                className="p-2 text-slate-400 hover:text-yellow-400"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(g)}
                              className="p-2 text-slate-400 hover:text-indigo-400"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteGame(g.id)}
                              className="p-2 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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
                  <Card key={g.id} className="flex justify-between gap-2">
                    <div>
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
                      <p className="text-sm text-slate-400">
                        {g.is_digital ? 'Démat' : 'Physique'}
                        {g.pegi != null && ` · PEGI ${g.pegi}`}
                      </p>
                      <div className="mt-2">
                        <Badge color={progressBadgeColor[g.progress]}>
                          {PROGRESS_LABELS[g.progress]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {g.progress !== 'in_progress' && g.progress !== 'done' && (
                        <button
                          type="button"
                          onClick={() => markInProgress(g.id)}
                          title="Marquer en cours"
                          className="p-2 text-slate-400 hover:text-yellow-400"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="p-2 text-slate-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGame(g.id)}
                        className="p-2 text-slate-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                ))}
            </div>
          )
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le jeu' : 'Nouveau jeu'}
      >
        <div className="space-y-4">
          <div>
            <Label>Titre</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Console</Label>
            <Select
              value={form.console_id}
              onChange={(e) =>
                setForm({ ...form, console_id: e.target.value })
              }
            >
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
              value={form.progress}
              onChange={(e) =>
                setForm({
                  ...form,
                  progress: e.target.value as GameProgress,
                })
              }
            >
              {PROGRESS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PROGRESS_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_digital}
              onChange={(e) =>
                setForm({ ...form, is_digital: e.target.checked })
              }
              className="h-4 w-4 rounded"
            />
            Dématérialisé
          </label>
          <div>
            <Label>PEGI</Label>
            <Select
              value={form.pegi}
              onChange={(e) => setForm({ ...form, pegi: e.target.value })}
            >
              <option value="">Non renseigné</option>
              {PEGI_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  PEGI {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              placeholder="Où j’en suis, à finir avant le DLC…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <Label>Tags</Label>
            {form.tagNames.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {form.tagNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => removeTagName(name)}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-600"
                  >
                    {name}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="RPG, Multijoueur, Court…"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagName(newTagInput)
                  }
                }}
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => addTagName(newTagInput)}
              >
                Ajouter
              </Button>
            </div>
            {allTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {allTags
                  .filter((t) => !form.tagNames.includes(t.name))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addTagName(t.name)}
                      className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    >
                      + {t.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <Button className="w-full" onClick={saveGame}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
