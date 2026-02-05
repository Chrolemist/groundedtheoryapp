import { Plus } from 'lucide-react'
import { SortableContext } from '@dnd-kit/sortable'
import { type Category, type Code } from '../types'
import { CodeChip } from './CodeChip'
import { CategoryCard } from './CategoryCard'

type AxialCodingPanelProps = {
  categories: Category[]
  codes: Code[]
  ungroupedCodes: Code[]
  onAddCategory: () => void
  onUpdateCategory: (categoryId: string, patch: Partial<Category>) => void
  onRemoveCategory: (categoryId: string) => void
  onRemoveCodeFromCategory: (categoryId: string, codeId: string) => void
  onRemoveCode: (codeId: string) => void
}

// Axial grouping UI for categories and ungrouped codes.
export function AxialCodingPanel({
  categories,
  codes,
  ungroupedCodes,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onRemoveCodeFromCategory,
  onRemoveCode,
}: AxialCodingPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Axial Categories</p>
          <p className="text-xs text-slate-500">Group codes into higher-level themes.</p>
        </div>
        <button
          onClick={onAddCategory}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New Category
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ungrouped Codes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SortableContext items={ungroupedCodes.map((code) => code.id)}>
            {ungroupedCodes.map((code) => (
              <CodeChip key={code.id} code={code} onRemove={onRemoveCode} />
            ))}
          </SortableContext>
        </div>
        {!ungroupedCodes.length && (
          <p className="mt-2 text-xs text-slate-400">All codes are grouped.</p>
        )}
      </div>

      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            codes={codes}
            onUpdate={onUpdateCategory}
            onRemove={onRemoveCategory}
            onRemoveCode={onRemoveCodeFromCategory}
          />
        ))}
      </div>
    </div>
  )
}
