import { Trash2 } from 'lucide-react'
import type { Doc } from 'yjs'
import { type Memo } from '../types'
import { useYjsMapText } from '../hooks/useYjsMapText'

type MemoListProps = {
  memos: Memo[]
  ydoc: Doc | null
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  emptyText?: string
}

// Shared memo editor list for code/category/global notes.
function MemoListItem({
  memo,
  ydoc,
  onUpdateMemo,
  onRemoveMemo,
}: {
  memo: Memo
  ydoc: Doc | null
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
}) {
  const updateTitle = useYjsMapText({
    ydoc,
    mapName: 'memos',
    itemId: memo.id,
    field: 'title',
    onLocalUpdate: (value) => onUpdateMemo(memo.id, { title: value }),
  })
  const updateBody = useYjsMapText({
    ydoc,
    mapName: 'memos',
    itemId: memo.id,
    field: 'body',
    onLocalUpdate: (value) => onUpdateMemo(memo.id, { body: value }),
  })

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          id={`memo-title-${memo.id}`}
          name={`memo-title-${memo.id}`}
          value={memo.title}
          onChange={(event) => updateTitle(event.target.value)}
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
        onChange={(event) => updateBody(event.target.value)}
        placeholder="Skriv din analys, hypoteser och aha-upplevelser..."
        rows={4}
        className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      />
    </div>
  )
}

export function MemoList({ memos, ydoc, onUpdateMemo, onRemoveMemo, emptyText }: MemoListProps) {
  if (!memos.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-400">
        {emptyText ?? 'No memos yet.'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {memos.map((memo) => (
        <MemoListItem
          key={memo.id}
          memo={memo}
          ydoc={ydoc}
          onUpdateMemo={onUpdateMemo}
          onRemoveMemo={onRemoveMemo}
        />
      ))}
    </div>
  )
}
