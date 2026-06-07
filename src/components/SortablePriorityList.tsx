import type { ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortablePriorityListProps<T extends { id: string }> {
  items: T[]
  enabled: boolean
  onReorder: (items: T[]) => void | Promise<void>
  renderItem: (
    item: T,
    index: number,
    dragHandle: ReactNode | null
  ) => ReactNode
  className?: string
  emptyState?: ReactNode
}

function SortableRow({
  id,
  enabled,
  children,
}: {
  id: string
  enabled: boolean
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragHandle = enabled ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="cursor-grab touch-none rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 active:cursor-grabbing sm:hover:bg-transparent"
      aria-label="Glisser pour réordonner"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  ) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'relative z-10 scale-[1.02] opacity-95 shadow-lg shadow-black/30' : undefined}
    >
      {children(dragHandle)}
    </div>
  )
}

export function SortablePriorityList<T extends { id: string }>({
  items,
  enabled,
  onReorder,
  renderItem,
  className = 'space-y-2',
  emptyState = null,
}: SortablePriorityListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    void onReorder(arrayMove(items, oldIndex, newIndex))
  }

  if (items.length === 0) {
    return emptyState
  }

  if (!enabled) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id}>{renderItem(item, index, null)}</div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} enabled={enabled}>
              {(dragHandle) => renderItem(item, index, dragHandle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
