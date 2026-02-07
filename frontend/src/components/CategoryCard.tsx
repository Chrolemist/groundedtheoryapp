import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Plus, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Category, type Code, type Memo } from '../types'
import { CodeChip } from './CodeChip'
import { MemoList } from './MemoList'

export function CategoryCard({
  category,
  codes,
  memos,
  showMemos,
  onUpdate,
  onRemove,
  onRemoveCode,
  onAddMemo,
  onUpdateMemo,
  onRemoveMemo,
  onMoveCode,
}: {
  category: Category
  codes: Code[]
  memos: Memo[]
  showMemos: boolean
  onUpdate: (categoryId: string, patch: Partial<Category>) => void
  onRemove: (categoryId: string) => void
  onRemoveCode: (categoryId: string, codeId: string) => void
  onAddMemo: (categoryId: string, categoryName?: string) => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  onMoveCode: (codeId: string, targetId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('application/x-code-id')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const codeId = event.dataTransfer.getData('application/x-code-id')
    if (!codeId) return
    onMoveCode(codeId, category.id)
  }

  const assignedCodes = category.codeIds
    .map((codeId) => codes.find((code) => code.id === codeId))
    .filter((code): code is Code => Boolean(code))
  const categoryMemos = memos.filter(
    (memo) => memo.type === 'category' && memo.refId === category.id,
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          id={`category-name-${category.id}`}
          name={`category-name-${category.id}`}
          value={category.name}
          onChange={(event) => onUpdate(category.id, { name: event.target.value })}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {assignedCodes.length} codes
          </span>
          {showMemos ? (
            <button
              type="button"
              onClick={() => {
                onAddMemo(category.id, category.name)
                setIsExpanded(true)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileText className="h-3 w-3" />
              Memo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Edit Logic
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
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
          assignedCodes.map((code) => (
            <CodeChip
              key={code.id}
              code={code}
              onRemove={(codeId) => onRemoveCode(category.id, codeId)}
            />
          ))
        ) : (
          <span className="text-xs text-slate-400">Drop codes here</span>
        )}
      </div>
      {isExpanded ? (
        <div className="mt-4 grid gap-3">
          <div className="space-y-1">
            <label
              htmlFor={`category-precondition-${category.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Förutsättning (Precondition)
            </label>
            <textarea
              id={`category-precondition-${category.id}`}
              name={`category-precondition-${category.id}`}
              value={category.precondition}
              onChange={(event) => onUpdate(category.id, { precondition: event.target.value })}
              onBlur={(event) => onUpdate(category.id, { precondition: event.target.value })}
              placeholder="Vad orsakar detta?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-sky-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`category-action-${category.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Handling (Action)
            </label>
            <textarea
              id={`category-action-${category.id}`}
              name={`category-action-${category.id}`}
              value={category.action}
              onChange={(event) => onUpdate(category.id, { action: event.target.value })}
              onBlur={(event) => onUpdate(category.id, { action: event.target.value })}
              placeholder="Vad görs för att hantera det?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-amber-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`category-consequence-${category.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Konsekvens (Consequence)
            </label>
            <textarea
              id={`category-consequence-${category.id}`}
              name={`category-consequence-${category.id}`}
              value={category.consequence}
              onChange={(event) => onUpdate(category.id, { consequence: event.target.value })}
              onBlur={(event) => onUpdate(category.id, { consequence: event.target.value })}
              placeholder="Vad blir resultatet?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-emerald-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          {showMemos ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Theoretical Notes
                </p>
                <button
                  type="button"
                  onClick={() => onAddMemo(category.id, category.name)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Memo
                </button>
              </div>
              <MemoList
                memos={categoryMemos}
                onUpdateMemo={onUpdateMemo}
                onRemoveMemo={onRemoveMemo}
                emptyText="Skriv en theoretical note om sambanden i denna kategori."
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
