import { Plus } from 'lucide-react'
import type { Doc } from 'yjs'
import { type Category, type Code, type Memo } from '../types'
import { CodeChip } from './CodeChip'
import { CategoryCard } from './CategoryCard'

type AxialCodingPanelProps = {
  categories: Category[]
  codes: Code[]
  ungroupedCodes: Code[]
  memos: Memo[]
  showMemos: boolean
  ydoc: Doc | null
  onAddCategory: () => void
  onUpdateCategory: (categoryId: string, patch: Partial<Category>) => void
  onRemoveCategory: (categoryId: string) => void
  onRemoveCodeFromCategory: (categoryId: string, codeId: string) => void
  onRemoveCode: (codeId: string) => void
  onAddCategoryMemo: (categoryId: string, categoryName?: string) => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  onMoveCode: (codeId: string, targetId: string) => void
}

// Axial grouping UI for categories and ungrouped codes.
// Uses native HTML5 drag-and-drop for guaranteed single-update-on-drop reliability.
export function AxialCodingPanel({
  categories,
  codes,
  ungroupedCodes,
  memos,
  showMemos,
  ydoc,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onRemoveCodeFromCategory,
  onRemoveCode,
  onAddCategoryMemo,
  onUpdateMemo,
  onRemoveMemo,
  onMoveCode,
}: AxialCodingPanelProps) {
  const handleUngroupedDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('application/x-code-id')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleUngroupedDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const codeId = event.dataTransfer.getData('application/x-code-id')
    if (!codeId) return
    onMoveCode(codeId, 'ungrouped')
  }

  return (
    <div id="axial-coding-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Axial Categories</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Group codes into higher-level themes.</p>
        </div>
        <button
          onClick={onAddCategory}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Category
        </button>
      </div>

      <div
        onDragOver={handleUngroupedDragOver}
        onDrop={handleUngroupedDrop}
        className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Ungrouped Codes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ungroupedCodes.map((code) => (
            <CodeChip key={code.id} code={code} onRemove={onRemoveCode} />
          ))}
        </div>
        {!ungroupedCodes.length && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">All codes are grouped.</p>
        )}
      </div>

      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            ydoc={ydoc}
            category={category}
            codes={codes}
            memos={memos}
            showMemos={showMemos}
            onUpdate={onUpdateCategory}
            onRemove={onRemoveCategory}
            onRemoveCode={onRemoveCodeFromCategory}
            onAddMemo={onAddCategoryMemo}
            onUpdateMemo={onUpdateMemo}
            onRemoveMemo={onRemoveMemo}
            onMoveCode={onMoveCode}
          />
        ))}
      </div>
    </div>
  )
}
