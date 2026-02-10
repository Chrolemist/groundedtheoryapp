import { useMemo } from 'react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from './DashboardLayout.types'

type StatsOverviewPanelProps = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
}

type StatBarItem = {
  id: string
  label: string
  value: number
  meta?: string
}

const buildBars = (items: StatBarItem[], maxItems = 5) => {
  const ordered = [...items].sort((a, b) => b.value - a.value).slice(0, maxItems)
  const maxValue = Math.max(...ordered.map((item) => item.value), 0)
  return { ordered, maxValue }
}

export function StatsOverviewPanel({
  documents,
  codes,
  categories,
  memos,
}: StatsOverviewPanelProps) {
  const memoCounts = useMemo(() => {
    return memos.reduce(
      (acc, memo) => {
        acc[memo.type] += 1
        return acc
      },
      { global: 0, category: 0, code: 0 },
    )
  }, [memos])

  const categoryStats = useMemo<StatBarItem[]>(() => {
    return categories.map((category) => ({
      id: category.id,
      label: category.name,
      value: category.codeIds.length,
    }))
  }, [categories])

  const highlightStats = useMemo<StatBarItem[]>(() => {
    const counts = new Map<string, number>()
    documents.forEach((doc) => {
      if (!doc.html) return
      const parser = new DOMParser()
      const wrapper = parser.parseFromString(`<div>${doc.html}</div>`, 'text/html')
      const container = wrapper.body.firstElementChild
      if (!container) return
      const highlights = container.querySelectorAll('span[data-code-id]')
      highlights.forEach((highlight) => {
        const codeId = highlight.getAttribute('data-code-id')
        if (!codeId) return
        counts.set(codeId, (counts.get(codeId) ?? 0) + 1)
      })
    })

    return codes.map((code) => ({
      id: code.id,
      label: code.label,
      value: counts.get(code.id) ?? 0,
    }))
  }, [documents, codes])

  const { ordered: topCategories, maxValue: maxCategoryValue } = buildBars(categoryStats)
  const { ordered: topHighlights, maxValue: maxHighlightValue } = buildBars(highlightStats)

  const totalDocuments = documents.length
  const totalCodes = codes.length
  const totalCategories = categories.length
  const totalMemos = memos.length

  return (
    <section
      id="analysis-overview"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Analysis Overview</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quick stats and trends to keep track of your grounded theory progress.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Totals
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Documents</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totalDocuments}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Codes</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totalCodes}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Categories</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totalCategories}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Memos</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totalMemos}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Memos by type
          </p>
          <div className="mt-3 space-y-3">
            {([
              { key: 'global', label: 'Integrative memos', value: memoCounts.global },
              { key: 'category', label: 'Theoretical memos', value: memoCounts.category },
              { key: 'code', label: 'Code memos', value: memoCounts.code },
            ] as const).map((item) => {
              const max = Math.max(memoCounts.global, memoCounts.category, memoCounts.code, 1)
              const width = (item.value / max) * 100
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-100">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white dark:bg-slate-900">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Strongest categories
          </p>
          <div className="mt-3 space-y-3">
            {topCategories.length ? (
              topCategories.map((item) => {
                const width = maxCategoryValue > 0 ? (item.value / maxCategoryValue) * 100 : 0
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span>{item.value} codes</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No categories yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Most highlighted codes
          </p>
          <div className="mt-3 space-y-3">
            {topHighlights.length ? (
              topHighlights.map((item) => {
                const width = maxHighlightValue > 0 ? (item.value / maxHighlightValue) * 100 : 0
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                      <span>{item.value} highlights</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No highlights yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
