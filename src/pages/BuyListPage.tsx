import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useConsoles } from '../hooks/useConsoles'
import { Button, Input, Select, Label, Card, Modal } from '../components/ui'
import type { BuyListItem } from '../types'

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

  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0)

  const getNextPriority = () =>
    items.length > 0 ? Math.max(...items.map((i) => i.priority ?? 0)) + 1 : 1

  const openCreate = () => {
    setEditing(null)
    setForm({
      title: '',
      console_id: consoles[0]?.id ?? '',
      is_digital: '',
      price: '',
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

  const moveItem = async (id: string, direction: 'up' | 'down') => {
    if (!prioritySupported) return
    const idx = items.findIndex((i) => i.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= items.length) return

    if (!supabase) return
    const a = items[idx]
    const b = items[swapIdx]
    await Promise.all([
      supabase.from('buy_list').update({ priority: b.priority }).eq('id', a.id),
      supabase.from('buy_list').update({ priority: a.priority }).eq('id', b.id),
    ])
    fetchItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">À acheter</h1>
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

      <p className="text-sm text-slate-500">
        {prioritySupported && 'Priorité 1 = le plus urgent. '}
        {items.length} jeu{items.length !== 1 ? 'x' : ''}
        {loading && ' — chargement…'}
      </p>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <Card key={item.id} className="flex items-center gap-3">
            {prioritySupported && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-300">
                {item.priority ?? idx + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{item.title}</p>
              <p className="text-sm text-slate-400">
                {item.consoles?.name ?? 'Console ?'}
                {item.is_digital != null &&
                  ` · ${item.is_digital ? 'Démat' : 'Physique'}`}
                {item.price != null && ` · ${Number(item.price).toFixed(2)} €`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {prioritySupported && (
                <>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(item.id, 'up')}
                    className="p-2 text-slate-400 hover:text-indigo-400 disabled:opacity-30"
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => moveItem(item.id, 'down')}
                    className="p-2 text-slate-400 hover:text-indigo-400 disabled:opacity-30"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="p-2 text-slate-400 hover:text-indigo-400"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                className="p-2 text-slate-400 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
        {!loading && items.length === 0 && !fetchError && (
          <Card>
            <p className="text-sm text-slate-400">
              Aucun jeu à acheter. Ajoutez des jeux ou réimportez votre Excel.
            </p>
          </Card>
        )}
      </div>

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
