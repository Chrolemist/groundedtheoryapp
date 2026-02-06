import { useState } from 'react'
import { FileText, Plus, Tag, Trash2 } from 'lucide-react'
import { type Code, type Memo } from '../types'
import { MemoList } from './MemoList'

type OpenCodingPanelProps = {
  codes: Code[]
  memos: Memo[]
  showMemos: boolean
  onAddCode: () => void
  onApplyCode: (codeId: string) => void
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void
  onRemoveCode: (codeId: string) => void
  onAddCodeMemo: (codeId: string, codeLabel?: string) => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  getReadableTextColor: (hex: string) => string
}

// Focused panel for open coding creation and labeling.
export function OpenCodingPanel({
  codes,
  memos,
  showMemos,
  onAddCode,
  onApplyCode,
  onUpdateCode,
  onRemoveCode,
  onAddCodeMemo,
  onUpdateMemo,
  onRemoveMemo,
  getReadableTextColor,
}: OpenCodingPanelProps) {
  const [activeMemoCodeId, setActiveMemoCodeId] = useState<string | null>(null)

  return (
    <div id="open-coding-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Open Codes</p>
          <p className="text-xs text-slate-500">
            Drag to axial categories or apply in the document.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddCode}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New Code
        </button>
      </div>
      <div className="space-y-2">
        {codes.map((code) => {
          const codeMemos = memos.filter((memo) => memo.type === 'code' && memo.refId === code.id)
          const isActive = activeMemoCodeId === code.id

          return (
            <div
              key={code.id}
              onContextMenu={(event) => {
                if (!showMemos) return
                event.preventDefault()
                setActiveMemoCodeId(code.id)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onApplyCode(code.id)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: code.colorHex ?? '#E2E8F0',
                    color: code.textHex ?? '#0F172A',
                    boxShadow: `inset 0 0 0 1px ${code.ringHex ?? 'rgba(148,163,184,0.4)'}`,
                  }}
                >
                  <Tag className="h-3 w-3" />
                  Apply
                </button>
                <input
                  id={`code-label-${code.id}`}
                  name={`code-label-${code.id}`}
                  value={code.label}
                  onChange={(event) => onUpdateCode(code.id, { label: event.target.value })}
                  className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  placeholder="Code name"
                />
                <input
                  id={`code-color-${code.id}`}
                  name={`code-color-${code.id}`}
                  type="color"
                  value={code.colorHex ?? '#E2E8F0'}
                  onChange={(event) => {
                    const colorHex = event.target.value
                    onUpdateCode(code.id, {
                      colorHex,
                      textHex: getReadableTextColor(colorHex),
                      ringHex: `${getReadableTextColor(colorHex)}33`,
                    })
                  }}
                  className="h-9 w-12 rounded border border-slate-200"
                  title="Change color"
                />
                {showMemos ? (
                  <button
                    type="button"
                    onClick={() => setActiveMemoCodeId(isActive ? null : code.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
                    title="Edit memo"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-semibold">{codeMemos.length}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemoveCode(code.id)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-50"
                  title="Remove code"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {showMemos && isActive && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Code Notes
                    </p>
                    <button
                      type="button"
                      onClick={() => onAddCodeMemo(code.id, code.label)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Memo
                    </button>
                  </div>
                  <MemoList
                    memos={codeMemos}
                    onUpdateMemo={onUpdateMemo}
                    onRemoveMemo={onRemoveMemo}
                    emptyText="Hogerklicka eller klicka + for att skriva en code note."
                  />
                </div>
              )}
            </div>
          )
        })}
        {!codes.length && (
          <p className="text-xs text-slate-400">Create your first code to start tagging text.</p>
        )}
      </div>
    </div>
  )
}
