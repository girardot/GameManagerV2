import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useConsoles } from '../hooks/useConsoles'
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  Badge,
  Modal,
} from '../components/ui'
import {
  PROGRESS_LABELS,
  PROGRESS_OPTIONS,
  type Game,
  type GameProgress,
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

export function CollectionPage() {
  const { user } = useAuth()
  const { consoles } = useConsoles()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [filterConsole, setFilterConsole] = useState('')
  const [filterProgress, setFilterProgress] = useState('')
  const [filterDigital, setFilterDigital] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Game | null>(null)
  const [form, setForm] = useState({
    title: '',
    console_id: '',
    is_digital: false,
    progress: 'todo' as GameProgress,
  })

  const fetchGames = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*, consoles(name)')
      .eq('user_id', user.id)
      .order('title')
    setGames((data as Game[]) ?? [])
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
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      console_id: consoles[0]?.id ?? '',
      is_digital: false,
      progress: 'todo',
    })
    setModalOpen(true)
  }

  const openEdit = (game: Game) => {
    setEditing(game)
    setForm({
      title: game.title,
      console_id: game.console_id,
      is_digital: game.is_digital,
      progress: game.progress,
    })
    setModalOpen(true)
  }

  const saveGame = async () => {
    if (!supabase || !user || !form.title || !form.console_id) return
    if (editing) {
      await supabase
        .from('games')
        .update({
          title: form.title.trim(),
          console_id: form.console_id,
          is_digital: form.is_digital,
          progress: form.progress,
        })
        .eq('id', editing.id)
    } else {
      await supabase.from('games').insert({
        user_id: user.id,
        title: form.title.trim(),
        console_id: form.console_id,
        is_digital: form.is_digital,
        progress: form.progress,
      })
    }
    setModalOpen(false)
    fetchGames()
  }

  const deleteGame = async (id: string) => {
    if (!supabase || !confirm('Supprimer ce jeu ?')) return
    await supabase.from('games').delete().eq('id', id)
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
        <Card className="grid gap-3 sm:grid-cols-3">
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
        </Card>
      )}

      <p className="text-sm text-slate-500">
        {filtered.length} jeu{filtered.length !== 1 ? 'x' : ''}
        {loading && ' — chargement…'}
      </p>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="p-3">Titre</th>
              <th className="p-3">Console</th>
              <th className="p-3">Format</th>
              <th className="p-3">Progression</th>
              <th className="p-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-t border-slate-800">
                <td className="p-3 font-medium">{g.title}</td>
                <td className="p-3 text-slate-400">{g.consoles?.name}</td>
                <td className="p-3">{g.is_digital ? 'Démat' : 'Physique'}</td>
                <td className="p-3">
                  <Badge color={progressBadgeColor[g.progress]}>
                    {PROGRESS_LABELS[g.progress]}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
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
      </div>

      <div className="md:hidden space-y-2">
        {filtered.map((g) => (
          <Card key={g.id} className="flex justify-between gap-2">
            <div>
              <p className="font-medium">{g.title}</p>
              <p className="text-sm text-slate-400">
                {g.consoles?.name} · {g.is_digital ? 'Démat' : 'Physique'}
              </p>
              <div className="mt-2">
              <Badge color={progressBadgeColor[g.progress]}>
                {PROGRESS_LABELS[g.progress]}
              </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-1">
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
          <Button className="w-full" onClick={saveGame}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
