import { useDroppable } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Category, type Code } from '../data/mockData'
import { CodeChip } from './CodeChip'

export function CategoryCard({
  category,
  codes,
  onUpdate,
  onRemove,
  onRemoveCode,
}: {
  category: Category
  codes: Code[]
  onUpdate: (categoryId: string, patch: Partial<Category>) => void
  onRemove: (categoryId: string) => void
  onRemoveCode: (categoryId: string, codeId: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: category.id,
  })

  const assignedCodes = category.codeIds
    .map((codeId) => codes.find((code) => code.id === codeId))
    .filter((code): code is Code => Boolean(code))

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition',
        isOver && 'border-slate-400 bg-slate-50',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={category.name}
          onChange={(event) => onUpdate(category.id, { name: event.target.value })}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {assignedCodes.length} codes
          </span>
          <button
            type="button"
            onClick={() => onRemove(category.id)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
            title="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {assignedCodes.length ? (
          <SortableContext items={assignedCodes.map((code) => code.id)}>
            {assignedCodes.map((code) => (
              <CodeChip
                key={code.id}
                code={code}
                onRemove={(codeId) => onRemoveCode(category.id, codeId)}
              />
            ))}
          </SortableContext>
        ) : (
          <span className="text-xs text-slate-400">Drop codes here</span>
        )}
      </div>
    </div>
  )
}
