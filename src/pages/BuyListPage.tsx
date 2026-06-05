import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useConsoles } from '../hooks/useConsoles'
import { Button, Input, Select, Label, Card, Modal } from '../components/ui'
import type { BuyListItem } from '../types'

export function BuyListPage() {
  const { user } = useAuth()
  const { consoles } = useConsoles()
  const [items, setItems] = useState<BuyListItem[]>([])
  const [loading, setLoading] = useState(true)
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
    const { data } = await supabase
      .from('buy_list')
      .select('*, consoles(name)')
      .eq('user_id', user.id)
      .order('title')
    setItems((data as BuyListItem[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0)

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
      await supabase.from('buy_list').insert({ user_id: user.id, ...payload })
    }
    setModalOpen(false)
    fetchItems()
  }

  const deleteItem = async (id: string) => {
    if (!supabase || !confirm('Supprimer ?')) return
    await supabase.from('buy_list').delete().eq('id', id)
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

      {total > 0 && (
        <Card>
          <p className="text-sm text-slate-400">Total (prix renseignés)</p>
          <p className="text-xl font-bold text-green-400">{total.toFixed(2)} €</p>
        </Card>
      )}

      <p className="text-sm text-slate-500">
        {items.length} jeu{items.length !== 1 ? 'x' : ''}
        {loading && ' — chargement…'}
      </p>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="flex justify-between gap-2">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-slate-400">
                {item.consoles?.name ?? 'Console ?'}
                {item.is_digital != null &&
                  ` · ${item.is_digital ? 'Démat' : 'Physique'}`}
                {item.price != null && ` · ${Number(item.price).toFixed(2)} €`}
              </p>
            </div>
            <div className="flex gap-1">
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
