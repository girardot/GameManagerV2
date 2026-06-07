import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingBag,
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
import type { BuyListItem } from '../types'
import { PEGI_OPTIONS, parseRating } from '../types'

type BuyListSort =
  | 'priority'
  | 'price_asc'
  | 'price_desc'
  | 'rating_asc'
  | 'rating_desc'

function sortBuyItems(items: BuyListItem[], sort: BuyListSort): BuyListItem[] {
  const copy = [...items]
  const byPriority = (a: BuyListItem, b: BuyListItem) =>
    (a.priority ?? 0) - (b.priority ?? 0)

  if (sort === 'priority') {
    return copy.sort(byPriority)
  }
  if (sort === 'price_asc') {
    return copy.sort((a, b) => {
      const pa = a.price
      const pb = b.price
      if (pa == null && pb == null) return byPriority(a, b)
      if (pa == null) return 1
      if (pb == null) return -1
      if (pa !== pb) return pa - pb
      return byPriority(a, b)
    })
  }
  if (sort === 'price_desc') {
    return copy.sort((a, b) => {
      const pa = a.price
      const pb = b.price
      if (pa == null && pb == null) return byPriority(a, b)
      if (pa == null) return 1
      if (pb == null) return -1
      if (pa !== pb) return pb - pa
      return byPriority(a, b)
    })
  }
  if (sort === 'rating_asc') {
    return copy.sort((a, b) => {
      const ra = a.rating
      const rb = b.rating
      if (ra == null && rb == null) return byPriority(a, b)
      if (ra == null) return 1
      if (rb == null) return -1
      if (ra !== rb) return ra - rb
      return byPriority(a, b)
    })
  }
  return copy.sort((a, b) => {
    const ra = a.rating
    const rb = b.rating
    if (ra == null && rb == null) return byPriority(a, b)
    if (ra == null) return 1
    if (rb == null) return -1
    if (ra !== rb) return rb - ra
    return byPriority(a, b)
  })
}

function isMissingPriorityColumn(message: string) {
  return (
    message.includes('priority') ||
    message.includes('schema cache')
  )
}

export function BuyListPage() {
  const { user } = useAuth()
  const { consoles } = useConsoles()
  const [items, setItems] = useState<BuyListItem[]>([])
  const [sortBy, setSortBy] = useState<BuyListSort>('priority')
  const [loading, setLoading] = useState(true)
  const [prioritySupported, setPrioritySupported] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BuyListItem | null>(null)
  const [form, setForm] = useState({
    title: '',
    console_id: '',
    is_digital: '' as '' | 'true' | 'false',
    price: '',
    pegi: '' as '' | string,
    rating: '',
    notes: '',
  })

  const fetchItems = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setFetchError(null)

    const primary = await supabase
      .from('buy_list')
      .select('*, consoles(name)')
      .eq('user_id', user.id)
      .order('priority')

    if (!primary.error) {
      setPrioritySupported(true)
      setItems((primary.data as BuyListItem[]) ?? [])
      setLoading(false)
      return
    }

    if (isMissingPriorityColumn(primary.error.message)) {
      const fallback = await supabase
        .from('buy_list')
        .select('*, consoles(name)')
        .eq('user_id', user.id)
        .order('created_at')

      if (fallback.error) {
        setFetchError(fallback.error.message)
        setItems([])
      } else {
        setPrioritySupported(false)
        setItems(
          ((fallback.data as BuyListItem[]) ?? []).map((item, i) => ({
            ...item,
            priority: i + 1,
          }))
        )
        setFetchError(
          'Le tri par priorité nécessite la migration 002_buy_list_priority.sql dans Supabase. Vos jeux sont toujours en base — ils s’affichent ici en attendant.'
        )
      }
      setLoading(false)
      return
    }

    setFetchError(primary.error.message)
    setItems([])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const sortedItems = sortBuyItems(items, sortBy)
  const canReorder = prioritySupported && sortBy === 'priority'

  const reorderItems = async (reordered: BuyListItem[]) => {
    const orderedIds = reordered.map((item) => item.id)
    setItems(applyPriorityOrder(items, orderedIds))
    const client = supabase
    if (!client) return
    await persistPriorityOrder(client, 'buy_list', orderedIds)
  }

  const total = sortedItems.reduce((s, i) => s + (Number(i.price) || 0), 0)

  const getNextPriority = () =>
    items.length > 0 ? Math.max(...items.map((i) => i.priority ?? 0)) + 1 : 1

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      console_id: consoles[0]?.id ?? '',
      is_digital: '',
      price: '',
      pegi: '',
      rating: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (item: BuyListItem) => {
    setEditing(item)
    setForm({
      title: item.title,
      console_id: item.console_id ?? '',
      is_digital:
        item.is_digital === null
          ? ''
          : item.is_digital
            ? 'true'
            : 'false',
      price: item.price != null ? String(item.price) : '',
      pegi: item.pegi != null ? String(item.pegi) : '',
      rating: item.rating != null ? String(item.rating) : '',
      notes: item.notes ?? '',
    })
    setModalOpen(true)
  }

  const saveItem = async () => {
    if (!supabase || !user || !form.title.trim()) return
    const payload = {
      title: form.title.trim(),
      console_id: form.console_id || null,
      is_digital:
        form.is_digital === ''
          ? null
          : form.is_digital === 'true',
      price: form.price ? parseFloat(form.price) : null,
      pegi: form.pegi ? (Number(form.pegi) as BuyListItem['pegi']) : null,
      rating: parseRating(form.rating),
      notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('buy_list').update(payload).eq('id', editing.id)
    } else {
      const withPriority = {
        user_id: user.id,
        ...payload,
        priority: getNextPriority(),
      }
      const { error } = await supabase.from('buy_list').insert(withPriority)
      if (error && isMissingPriorityColumn(error.message)) {
        await supabase.from('buy_list').insert({ user_id: user.id, ...payload })
      }
    }
    setModalOpen(false)
    fetchItems()
  }

  const deleteItem = async (id: string) => {
    if (!supabase || !confirm('Supprimer ?')) return
    await supabase.from('buy_list').delete().eq('id', id)
    if (prioritySupported) await reorderAfterDelete()
    else fetchItems()
  }

  const reorderAfterDelete = async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('buy_list')
      .select('id')
      .eq('user_id', user.id)
      .order('priority')
    if (!data) return
    for (let i = 0; i < data.length; i++) {
      await supabase
        .from('buy_list')
        .update({ priority: i + 1 })
        .eq('id', data[i].id)
    }
    fetchItems()
  }

  const markAsPurchased = async (item: BuyListItem) => {
    if (!supabase || !user) return
    if (!item.console_id) {
      alert('Renseignez une console avant d’ajouter à la collection.')
      return
    }
    const { error } = await supabase.from('games').insert({
      user_id: user.id,
      title: item.title,
      console_id: item.console_id,
      is_digital: item.is_digital ?? false,
      progress: 'todo',
      pegi: item.pegi,
      rating: item.rating,
    })
    if (error) {
      if (error.code === '23505') {
        alert('Ce jeu est déjà dans la collection.')
      } else {
        alert(error.message)
      }
      return
    }
    await supabase.from('buy_list').delete().eq('id', item.id)
    if (prioritySupported) await reorderAfterDelete()
    else fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">À acheter</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {fetchError && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <p className="text-sm text-yellow-200">{fetchError}</p>
        </Card>
      )}

      {total > 0 && (
        <Card>
          <p className="text-sm text-slate-400">Total (prix renseignés)</p>
          <p className="text-xl font-bold text-green-400">{total.toFixed(2)} €</p>
        </Card>
      )}

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
            onChange={(e) => setSortBy(e.target.value as BuyListSort)}
            className="min-w-0 flex-1 sm:w-auto sm:min-w-[10rem]"
          >
            <option value="priority">Priorité</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
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
          !loading && !fetchError ? (
            <Card>
              <p className="text-sm text-slate-400">
                Aucun jeu à acheter. Ajoutez des jeux ou réimportez votre Excel.
              </p>
            </Card>
          ) : null
        }
        renderItem={(item, idx, dragHandle) => (
          <GameListCard
            dragHandle={dragHandle}
            rank={idx + 1}
            showRank={canReorder}
            rankColor="green"
            title={item.title}
            badges={
              <>
                <GameMetaBadges pegi={item.pegi} rating={item.rating} />
                {item.price != null && (
                  <Badge color="green">
                    <span className="tabular-nums font-semibold">
                      {Number(item.price).toFixed(2)} €
                    </span>
                  </Badge>
                )}
              </>
            }
            meta={[
              item.consoles?.name ?? 'Console ?',
              item.is_digital != null
                ? item.is_digital
                  ? 'Démat'
                  : 'Physique'
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            actions={
              <>
                <GameListActionButton
                  label="Collection"
                  onClick={() => markAsPurchased(item)}
                  className="hover:text-green-400"
                >
                  <ShoppingBag className="h-4 w-4" />
                </GameListActionButton>
                <GameListActionButton
                  label="Modifier"
                  onClick={() => openEdit(item)}
                  className="hover:text-indigo-400"
                >
                  <Pencil className="h-4 w-4" />
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
        title={editing ? 'Modifier' : 'Jeu à acheter'}
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
              <option value="">—</option>
              {consoles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Format</Label>
            <Select
              value={form.is_digital}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_digital: e.target.value as '' | 'true' | 'false',
                })
              }
            >
              <option value="">Non précisé</option>
              <option value="false">Physique</option>
              <option value="true">Dématérialisé</option>
            </Select>
          </div>
          <div>
            <Label>Prix (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
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
          <Button className="w-full" onClick={saveItem}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
