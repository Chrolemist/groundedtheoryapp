import { Plus, Trash2 } from 'lucide-react'
import { type Category, type Code, type Memo } from '../types'

type CategoryStat = {
  id: string
  name: string
  codeCount: number
  codes: Code[]
}

type SharedCode = {
  code: Code
  count: number
}

type SelectiveCodingPanelProps = {
  coreCategoryId: string
  onCoreCategoryChange: (value: string) => void
  coreCategoryDraft: string
  onCoreCategoryDraftChange: (value: string) => void
  onCreateCoreCategory: () => void
  categories: Category[]
  codeById: Map<string, Code>
  categoryStats: CategoryStat[]
  sharedCodes: SharedCode[]
  codeCount: number
  assignedCodeCount: number
  ungroupedCodeCount: number
  memos: Memo[]
  onAddMemo: () => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  isTheoryEmpty: boolean
  onApplyEditorCommand: (command: string, value?: string) => void
  onTheoryInput: (html: string) => void
  theoryEditorRef: (node: HTMLDivElement | null) => void
}

export function SelectiveCodingPanel({
  coreCategoryId,
  onCoreCategoryChange,
  coreCategoryDraft,
  onCoreCategoryDraftChange,
  onCreateCoreCategory,
  categories,
  codeById,
  categoryStats,
  sharedCodes,
  codeCount,
  assignedCodeCount,
  ungroupedCodeCount,
  memos,
  onAddMemo,
  onUpdateMemo,
  onRemoveMemo,
  isTheoryEmpty,
  onApplyEditorCommand,
  onTheoryInput,
  theoryEditorRef,
}: SelectiveCodingPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Selective Coding</p>
        <p className="text-xs text-slate-500">
          Define your core category and craft the final grounded theory narrative.
        </p>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <label
            htmlFor="core-category"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Core Category
          </label>
          <select
            id="core-category"
            name="core-category"
            value={coreCategoryId}
            onChange={(event) => onCoreCategoryChange(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Select the core category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              id="core-category-new"
              name="core-category-new"
              value={coreCategoryDraft}
              onChange={(event) => onCoreCategoryDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                onCreateCoreCategory()
              }}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="Create a new core category"
            />
            <button
              type="button"
              onClick={onCreateCoreCategory}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
            >
              Create core
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Analysis Snapshot
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              Categories: {categories.length}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              Codes: {codeCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              Grouped codes: {assignedCodeCount}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              Ungrouped codes: {ungroupedCodeCount}
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Strongest categories
              </p>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                {categoryStats.length ? (
                  categoryStats.slice(0, 3).map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                    >
                      <span className="font-semibold text-slate-700">{category.name}</span>
                      <span>{category.codeCount} codes</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">No categories yet.</div>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Most shared codes
              </p>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                {sharedCodes.length ? (
                  sharedCodes.slice(0, 4).map((entry) => (
                    <div
                      key={entry.code.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                    >
                      <span className="font-semibold text-slate-700">{entry.code.label}</span>
                      <span>{entry.count} categories</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">No shared codes yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div id="memos-section">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Categories & Codes Overview
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {categories.length ? (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{category.name}</p>
                    {coreCategoryId === category.id ? (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Core
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {category.codeIds.length ? (
                      category.codeIds
                        .map((codeId) => codeById.get(codeId))
                        .filter((code): code is Code => Boolean(code))
                        .map((code) => (
                          <span
                            key={code.id}
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor: code.colorHex ?? '#E2E8F0',
                              color: code.textHex ?? '#0F172A',
                              boxShadow: `inset 0 0 0 1px ${
                                code.ringHex ?? 'rgba(148,163,184,0.4)'
                              }`,
                            }}
                          >
                            {code.label}
                          </span>
                        ))
                    ) : (
                      <span className="text-xs text-slate-400">No codes yet</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-400">
                Add categories and codes to see the overview here.
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Memos</p>
            <button
              type="button"
              onClick={onAddMemo}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
            >
              <Plus className="h-3.5 w-3.5" />
              New Memo
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {memos.length ? (
              memos.map((memo) => (
                <div key={memo.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      id={`memo-title-${memo.id}`}
                      name={`memo-title-${memo.id}`}
                      value={memo.title}
                      onChange={(event) => onUpdateMemo(memo.id, { title: event.target.value })}
                      className="min-w-[180px] flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
                      placeholder="Memo title"
                    />
                    <span className="text-xs text-slate-400">
                      {(memo.updatedAt || memo.createdAt).slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveMemo(memo.id)}
                      className="rounded-md border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
                      title="Delete memo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    id={`memo-body-${memo.id}`}
                    name={`memo-body-${memo.id}`}
                    value={memo.body}
                    onChange={(event) => onUpdateMemo(memo.id, { body: event.target.value })}
                    placeholder="Skriv din analys, hypoteser och aha-upplevelser..."
                    rows={4}
                    className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-400">
                Skapa en memo för att skriva ner dina tolkningar.
              </div>
            )}
          </div>
        </div>
        <div>
          <span
            id="theory-narrative-label"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Theory Narrative
          </span>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => onApplyEditorCommand('bold')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => onApplyEditorCommand('italic')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => onApplyEditorCommand('underline')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Underline
              </button>
              <select
                id="theory-font-size"
                name="theory-font-size"
                onChange={(event) => onApplyEditorCommand('fontSize', event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                defaultValue="3"
              >
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Large</option>
                <option value="5">XL</option>
              </select>
              <input
                id="theory-text-color"
                name="theory-text-color"
                type="color"
                onChange={(event) => onApplyEditorCommand('foreColor', event.target.value)}
                className="h-7 w-10 rounded border border-slate-200"
                title="Text color"
              />
            </div>
            <div className="relative">
              {isTheoryEmpty && (
                <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400">
                  Summarize the main storyline and how categories relate...
                </span>
              )}
              <div
                ref={theoryEditorRef}
                id="theory-narrative"
                role="textbox"
                aria-multiline="true"
                aria-labelledby="theory-narrative-label"
                className="min-h-[140px] px-3 py-3 text-sm text-slate-700 outline-none"
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => onTheoryInput((event.target as HTMLDivElement).innerHTML)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
