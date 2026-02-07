import { Plus } from 'lucide-react'
import type { Doc } from 'yjs'
import { type Memo } from '../types'
import { MemoList } from './MemoList'

type MemosPanelProps = {
  memos: Memo[]
  ydoc: Doc | null
  onAddGlobalMemo: () => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
}

// Global memos view for integrative notes.
export function MemosPanel({ memos, ydoc, onAddGlobalMemo, onUpdateMemo, onRemoveMemo }: MemosPanelProps) {
  const globalMemos = memos.filter((memo) => memo.type === 'global')

  return (
    <div id="memos-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Memos</p>
          <p className="text-xs text-slate-500">Integrative notes that run through the process.</p>
        </div>
        <button
          type="button"
          onClick={onAddGlobalMemo}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New Memo
        </button>
      </div>
      <MemoList
        memos={globalMemos}
        ydoc={ydoc}
        onUpdateMemo={onUpdateMemo}
        onRemoveMemo={onRemoveMemo}
        emptyText="Skapa en integrativ memo for helheten."
      />
    </div>
  )
}
