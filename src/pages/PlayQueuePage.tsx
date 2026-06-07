import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Play,
  Check,
  Ban,
  Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { applyPriorityOrder, persistPriorityOrder } from '../lib/reorder-priority'
import { useAuth } from '../hooks/useAuth'
import { useConsoles } from '../hooks/useConsoles'
import { Button, Input, Select, Label, Card, Modal, Badge } from '../components/ui'
import { SortablePriorityList } from '../components/SortablePriorityList'
import { GameMetaBadges } from '../components/GameMetaBadges'
import {
  GameListCard,
  GameListActionButton,
  ListToolbar,
} from '../components/GameListCard'
import type { PlayQueueItem, PlayQueueStatus, PegiRating } from '../types'
import { PLAY_QUEUE_STATUS_LABELS, PEGI_OPTIONS, parseRating } from '../types'

const playQueueStatusColor: Record<PlayQueueStatus, 'indigo' | 'yellow'> = {
  todo: 'indigo',
  in_progress: 'yellow',
}

function resolvePlayStatus(item: PlayQueueItem): PlayQueueStatus {
  const progress = item.games?.progress
  return progress === 'in_progress' ? 'in_progress' : 'todo'
}

function resolvePegi(item: PlayQueueItem): PegiRating | null {
  const joined = item.games?.pegi
  if (joined != null) return joined
  return item.pegi
}

function resolveRating(item: PlayQueueItem): number | null {
  const joined = item.games?.rating
  if (joined != null) return joined
  return item.rating
}

type PlayQueueSort = 'priority' | 'rating_asc' | 'rating_desc'

function sortPlayQueueItems(
  items: PlayQueueItem[],
  sort: PlayQueueSort
): PlayQueueItem[] {
  const copy = [...items]
  const byPriority = (a: PlayQueueItem, b: PlayQueueItem) =>
    a.priority - b.priority

  if (sort === 'priority') {
    return copy.sort(byPriority)
  }
  if (sort === 'rating_asc') {
    return copy.sort((a, b) => {
      const ra = resolveRating(a)
      const rb = resolveRating(b)
      if (ra == null && rb == null) return byPriority(a, b)
      if (ra == null) return 1
      if (rb == null) return -1
      if (ra !== rb) return ra - rb
      return byPriority(a, b)
    })
  }
  return copy.sort((a, b) => {
    const ra = resolveRating(a)
    const rb = resolveRating(b)
    if (ra == null && rb == null) return byPriority(a, b)
    if (ra == null) return 1
    if (rb == null) return -1
    if (ra !== rb) return rb - ra
    return byPriority(a, b)
  })
}

export function PlayQueuePage() {
  const { user } = useAuth()
  const { consoles } = useConsoles()
  const [items, setItems] = useState<PlayQueueItem[]>([])
  const [sortBy, setSortBy] = useState<PlayQueueSort>('priority')
  const [games, setGames] = useState<
    { id: string; title: string; console_id: string; consoles?: { name: string } }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<PlayQueueItem | null>(null)
  const [form, setForm] = useState({
    title: '',
    console_id: '',
    game_id: '',
    notes: '',
    pegi: '' as '' | string,
    rating: '',
  })
  const [editForm, setEditForm] = useState({
    notes: '',
    pegi: '' as '' | string,
    rating: '',
  })

  const fetchItems = useCallback(async () => {
    const client = supabase
    if (!client || !user) return
    setLoading(true)
    const [queueRes, gamesRes] = await Promise.all([
      client
        .from('play_queue')
        .select('*, consoles(name), games(progress, pegi, rating)')
        .eq('user_id', user.id)
        .order('priority'),
      client
        .from('games')
        .select('id, title, console_id, progress, pegi, rating')
        .eq('user_id', user.id)
        .in('progress', ['todo', 'in_progress', 'abandoned']),
    ])

    type GameMeta = {
      id: string
      progress: string
      pegi: PegiRating | null
      rating: number | null
    }

    const gameMetaById = new Map<string, GameMeta>()
    const gameMetaByKey = new Map<string, GameMeta>()
    for (const g of gamesRes.data ?? []) {
      const meta: GameMeta = {
        id: g.id,
        progress: g.progress,
        pegi: g.pegi as PegiRating | null,
        rating: g.rating,
      }
      gameMetaById.set(g.id, meta)
      gameMetaByKey.set(`${g.console_id}:${g.title}`, meta)
    }

    const abandonedIds = new Set(
      (gamesRes.data ?? [])
        .filter((g) => g.progress === 'abandoned')
        .map((g) => g.id)
    )
    const abandonedKeys = new Set(
      (gamesRes.data ?? [])
        .filter((g) => g.progress === 'abandoned')
        .map((g) => `${g.console_id}:${g.title}`)
    )

    const progressByKey = new Map<string, PlayQueueStatus>()
    for (const g of gamesRes.data ?? []) {
      if (g.progress === 'abandoned') continue
      const status: PlayQueueStatus =
        g.progress === 'in_progress' ? 'in_progress' : 'todo'
      progressByKey.set(`${g.console_id}:${g.title}`, status)
      progressByKey.set(g.id, status)
    }

    const allQueue = (queueRes.data as PlayQueueItem[]) ?? []

    const hiddenIds = allQueue
      .filter((item) => {
        if (item.game_id && abandonedIds.has(item.game_id)) return true
        if (
          item.console_id &&
          abandonedKeys.has(`${item.console_id}:${item.title}`)
        ) {
          return true
        }
        return false
      })
      .map((item) => item.id)

    if (hiddenIds.length > 0) {
      await client.from('play_queue').delete().in('id', hiddenIds)
    }

    const visible = allQueue
      .filter((item) => !hiddenIds.includes(item.id))
      .map((item) => {
        const joined = item.games
        const joinedGame = Array.isArray(joined) ? joined[0] : joined
        const metaFromId = item.game_id
          ? gameMetaById.get(item.game_id)
          : undefined
        const metaFromKey =
          item.console_id != null
            ? gameMetaByKey.get(`${item.console_id}:${item.title}`)
            : undefined
        const matchedGame = metaFromId ?? metaFromKey

        const joinedProgress = joinedGame?.progress ?? matchedGame?.progress
        let progress = joinedProgress as PlayQueueStatus | undefined
        if (!progress && item.game_id) {
          progress = progressByKey.get(item.game_id)
        }
        if (!progress && item.console_id) {
          progress = progressByKey.get(`${item.console_id}:${item.title}`)
        }
        const resolvedProgress: PlayQueueStatus =
          progress === 'in_progress' ? 'in_progress' : 'todo'

        const pegi =
          joinedGame?.pegi ??
          matchedGame?.pegi ??
          item.pegi ??
          null
        const rating =
          joinedGame?.rating ??
          matchedGame?.rating ??
          item.rating ??
          null

        return {
          ...item,
          game_id: item.game_id ?? matchedGame?.id ?? null,
          pegi,
          rating,
          games: {
            progress: resolvedProgress,
            pegi,
            rating,
          },
        }
      })

    const needsCompact = visible.some((item, i) => item.priority !== i + 1)
    if (needsCompact) {
      await Promise.all(
        visible.map((item, i) =>
          client
            .from('play_queue')
            .update({ priority: i + 1 })
            .eq('id', item.id)
        )
      )
      visible.forEach((item, i) => {
        item.priority = i + 1
      })
    }

    setItems(visible)
    setLoading(false)
  }, [user])

  const fetchGames = useCallback(async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('games')
      .select('id, title, console_id, consoles(name)')
      .eq('user_id', user.id)
      .in('progress', ['todo', 'in_progress'])
      .order('title')
    setGames(
      (data ?? []).map((g) => ({
        id: g.id,
        title: g.title,
        console_id: g.console_id,
        consoles: Array.isArray(g.consoles) ? g.consoles[0] : g.consoles,
      }))
    )
  }, [user])

  useEffect(() => {
    fetchItems()
    fetchGames()
  }, [fetchItems, fetchGames])

  const getNextPriority = () =>
    items.length > 0 ? Math.max(...items.map((i) => i.priority)) + 1 : 1

  const addItem = async () => {
    if (!supabase || !user || !form.title.trim()) return
    await supabase.from('play_queue').insert({
      user_id: user.id,
      title: form.title.trim(),
      console_id: form.console_id || null,
      game_id: form.game_id || null,
      notes: form.notes || null,
      pegi: form.pegi ? (Number(form.pegi) as PegiRating) : null,
      rating: parseRating(form.rating),
      priority: getNextPriority(),
    })
    setModalOpen(false)
    setForm({
      title: '',
      console_id: '',
      game_id: '',
      notes: '',
      pegi: '',
      rating: '',
    })
    fetchItems()
  }

  const deleteItem = async (id: string) => {
    if (!supabase) return
    await supabase.from('play_queue').delete().eq('id', id)
    await reorderAfterDelete()
  }

  const reorderAfterDelete = async () => {
    await fetchItems()
    if (!supabase || !user) return
    const { data } = await supabase
      .from('play_queue')
      .select('id')
      .eq('user_id', user.id)
      .order('priority')
    if (!data) return
    for (let i = 0; i < data.length; i++) {
      await supabase
        .from('play_queue')
        .update({ priority: i + 1 })
        .eq('id', data[i].id)
    }
    fetchItems()
  }

  const sortedItems = sortPlayQueueItems(items, sortBy)
  const canReorder = sortBy === 'priority'

  const reorderItems = async (reordered: PlayQueueItem[]) => {
    const orderedIds = reordered.map((item) => item.id)
    setItems(applyPriorityOrder(items, orderedIds))
    const client = supabase
    if (!client) return
    await persistPriorityOrder(client, 'play_queue', orderedIds)
  }

  const resolveGameId = async (item: PlayQueueItem): Promise<string | null> => {
    if (item.game_id) return item.game_id
    if (!supabase || !user || !item.console_id) return null
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('user_id', user.id)
      .eq('console_id', item.console_id)
      .eq('title', item.title)
      .maybeSingle()
    return data?.id ?? null
  }

  const markInProgress = async (item: PlayQueueItem) => {
    if (!supabase) return
    const gameId = await resolveGameId(item)
    if (!gameId) {
      alert('Jeu introuvable dans la collection.')
      return
    }
    await supabase
      .from('games')
      .update({ progress: 'in_progress' })
      .eq('id', gameId)
    fetchGames()
  }

  const markAsDone = async (item: PlayQueueItem) => {
    if (!supabase) return
    const gameId = await resolveGameId(item)
    if (!gameId) {
      alert('Jeu introuvable dans la collection.')
      return
    }
    await supabase
      .from('games')
      .update({ progress: 'done' })
      .eq('id', gameId)
    await supabase.from('play_queue').delete().eq('id', item.id)
    await reorderAfterDelete()
    fetchGames()
  }

  const markAsAbandoned = async (item: PlayQueueItem) => {
    if (!supabase) return
    const gameId = await resolveGameId(item)
    if (!gameId) {
      alert('Jeu introuvable dans la collection.')
      return
    }
    await supabase
      .from('games')
      .update({ progress: 'abandoned' })
      .eq('id', gameId)
    await supabase.from('play_queue').delete().eq('id', item.id)
    await reorderAfterDelete()
    fetchGames()
  }

  const openEdit = (item: PlayQueueItem) => {
    const pegi = resolvePegi(item)
    const rating = resolveRating(item)
    setEditing(item)
    setEditForm({
      notes: item.notes ?? '',
      pegi: pegi != null ? String(pegi) : '',
      rating: rating != null ? String(rating) : '',
    })
    setEditModalOpen(true)
  }

  const saveEdit = async () => {
    if (!supabase || !editing) return
    const pegi = editForm.pegi
      ? (Number(editForm.pegi) as PegiRating)
      : null
    const rating = parseRating(editForm.rating)
    const notes = editForm.notes || null

    if (editing.game_id) {
      await supabase
        .from('games')
        .update({ pegi, rating })
        .eq('id', editing.game_id)
      await supabase
        .from('play_queue')
        .update({ notes, pegi: null, rating: null })
        .eq('id', editing.id)
    } else {
      const gameId = await resolveGameId(editing)
      if (gameId) {
        await supabase.from('games').update({ pegi, rating }).eq('id', gameId)
        await supabase
          .from('play_queue')
          .update({
            notes,
            pegi: null,
            rating: null,
            game_id: gameId,
          })
          .eq('id', editing.id)
      } else {
        await supabase
          .from('play_queue')
          .update({ notes, pegi, rating })
          .eq('id', editing.id)
      }
    }
    setEditModalOpen(false)
    setEditing(null)
    fetchItems()
  }

  const selectFromCollection = (gameId: string) => {
    const game = games.find((g) => g.id === gameId)
    if (game) {
      setForm({
        title: game.title,
        console_id: game.console_id,
        game_id: game.id,
        notes: '',
        pegi: '',
        rating: '',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">À jouer</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <ListToolbar
        summary={
          <>
            {canReorder && 'Glissez ⠿ pour réordonner. Priorité 1 = le plus urgent. '}
            {sortedItems.length} jeu{sortedItems.length !== 1 ? 'x' : ''}
            {loading && ' — chargement…'}
          </>
        }
        sortControl={
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as PlayQueueSort)}
            className="min-w-0 flex-1 sm:w-auto sm:min-w-[10rem]"
          >
            <option value="priority">Priorité</option>
            <option value="rating_asc">Note croissante</option>
            <option value="rating_desc">Note décroissante</option>
          </Select>
        }
      />

      <SortablePriorityList
        items={sortedItems}
        enabled={canReorder}
        onReorder={reorderItems}
        className="space-y-3 sm:space-y-2"
        emptyState={
          !loading ? (
            <Card>
              <p className="text-sm text-slate-400">
                Aucun jeu en file. Ajoutez des jeux à jouer avec une priorité.
              </p>
            </Card>
          ) : null
        }
        renderItem={(item, idx, dragHandle) => (
          <GameListCard
            dragHandle={dragHandle}
            rank={idx + 1}
            showRank={canReorder}
            rankColor="indigo"
            title={item.title}
            badges={
              <>
                <Badge color={playQueueStatusColor[resolvePlayStatus(item)]}>
                  {PLAY_QUEUE_STATUS_LABELS[resolvePlayStatus(item)]}
                </Badge>
                <GameMetaBadges
                  pegi={resolvePegi(item)}
                  rating={resolveRating(item)}
                />
              </>
            }
            meta={
              item.consoles?.name || item.notes
                ? [item.consoles?.name ?? null, item.notes || null]
                    .filter(Boolean)
                    .join(' · ')
                : undefined
            }
            actions={
              <>
                <GameListActionButton
                  label="Modifier"
                  onClick={() => openEdit(item)}
                  className="hover:text-indigo-400"
                >
                  <Pencil className="h-4 w-4" />
                </GameListActionButton>
                <GameListActionButton
                  label="En cours"
                  onClick={() => markInProgress(item)}
                  className="hover:text-yellow-400"
                >
                  <Play className="h-4 w-4" />
                </GameListActionButton>
                <GameListActionButton
                  label="Terminé"
                  onClick={() => markAsDone(item)}
                  className="hover:text-green-400"
                >
                  <Check className="h-4 w-4" />
                </GameListActionButton>
                <GameListActionButton
                  label="Abandon"
                  onClick={() => markAsAbandoned(item)}
                  className="hover:text-red-400"
                >
                  <Ban className="h-4 w-4" />
                </GameListActionButton>
                <GameListActionButton
                  label="Suppr."
                  onClick={() => deleteItem(item.id)}
                  className="hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </GameListActionButton>
              </>
            }
          />
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajouter à la file"
      >
        <div className="space-y-4">
          {games.length > 0 && (
            <div>
              <Label>Depuis la collection</Label>
              <Select
                value={form.game_id}
                onChange={(e) => selectFromCollection(e.target.value)}
              >
                <option value="">— Saisie libre —</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.consoles?.name})
                  </option>
                ))}
              </Select>
            </div>
          )}
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
              <option value="">—</option>
              {consoles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
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
            <Label>Note (/20)</Label>
            <Input
              type="number"
              min="0"
              max="20"
              step="1"
              placeholder="0–20"
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <Button className="w-full" onClick={addItem}>
            Ajouter en fin de file
          </Button>
        </div>
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Modifier"
      >
        <div className="space-y-4">
          <div>
            <Label>PEGI</Label>
            <Select
              value={editForm.pegi}
              onChange={(e) =>
                setEditForm({ ...editForm, pegi: e.target.value })
              }
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
            <Label>Note (/20)</Label>
            <Input
              type="number"
              min="0"
              max="20"
              step="1"
              placeholder="0–20"
              value={editForm.rating}
              onChange={(e) =>
                setEditForm({ ...editForm, rating: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
            />
          </div>
          <Button className="w-full" onClick={saveEdit}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
