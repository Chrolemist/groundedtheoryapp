import { type Category } from '../types'

type SelectiveCodingPanelProps = {
  coreCategoryId: string
  coreCategoryDraft: string
  onCoreCategoryDraftChange: (value: string) => void
  onCreateCoreCategory: () => void
  categories: Category[]
  isTheoryEmpty: boolean
  onApplyEditorCommand: (command: string, value?: string) => void
  onTheoryInput: (html: string) => void
  theoryEditorRef: (node: HTMLDivElement | null) => void
}

export function SelectiveCodingPanel({
  coreCategoryId,
  coreCategoryDraft,
  onCoreCategoryDraftChange,
  onCreateCoreCategory,
  categories,
  isTheoryEmpty,
  onApplyEditorCommand,
  onTheoryInput,
  theoryEditorRef,
}: SelectiveCodingPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selective Coding</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Define your core category and craft the final grounded theory narrative.
        </p>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <label
            htmlFor="core-category-new"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          >
            Core Category
          </label>
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
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Skriv din core category"
            />
            <button
              type="button"
              onClick={onCreateCoreCategory}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
            >
              Spara core
            </button>
          </div>
          {coreCategoryId ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Aktiv core: {categories.find((category) => category.id === coreCategoryId)?.name}
            </p>
          ) : null}
        </div>
        <div>
          <span
            id="theory-narrative-label"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          >
            Theory Narrative
          </span>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onApplyEditorCommand('bold')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => onApplyEditorCommand('italic')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => onApplyEditorCommand('underline')}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Underline
              </button>
              <select
                id="theory-font-size"
                name="theory-font-size"
                onChange={(event) => onApplyEditorCommand('fontSize', event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
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
                <span className="pointer-events-none absolute left-3 top-3 text-sm text-slate-400 dark:text-slate-500">
                  Summarize the main storyline and how categories relate...
                </span>
              )}
              <div
                ref={theoryEditorRef}
                id="theory-narrative"
                role="textbox"
                aria-multiline="true"
                aria-labelledby="theory-narrative-label"
                className="min-h-[140px] px-3 py-3 text-sm text-slate-700 outline-none dark:text-slate-100"
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => onTheoryInput((event.currentTarget as HTMLDivElement).innerHTML)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
