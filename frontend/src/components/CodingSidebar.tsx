import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Tag, Layers } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Category, type Code, type Memo } from '../types'
import { OpenCodingPanel } from './OpenCodingPanel'
import { AxialCodingPanel } from './AxialCodingPanel'
import { SelectiveCodingPanel } from './SelectiveCodingPanel'

type TabKey = 'open' | 'axial' | 'theory'

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

type CodingSidebarProps = {
  codes: Code[]
  categories: Category[]
  ungroupedCodes: Code[]
  codeById: Map<string, Code>
  categoryStats: CategoryStat[]
  sharedCodes: SharedCode[]
  coreCategoryId: string
  coreCategoryDraft: string
  assignedCodeCount: number
  ungroupedCodeCount: number
  memos: Memo[]
  isTheoryEmpty: boolean
  onAddCode: () => void
  onApplyCode: (codeId: string) => void
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void
  onRemoveCode: (codeId: string) => void
  getReadableTextColor: (hex: string) => string
  onAddCategory: () => void
  onUpdateCategory: (categoryId: string, patch: Partial<Category>) => void
  onRemoveCategory: (categoryId: string) => void
  onRemoveCodeFromCategory: (categoryId: string, codeId: string) => void
  onCoreCategoryChange: (value: string) => void
  onCoreCategoryDraftChange: (value: string) => void
  onCreateCoreCategory: () => void
  onAddMemo: () => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  onApplyEditorCommand: (command: string, value?: string) => void
  onTheoryInput: (html: string) => void
  onTheoryEditorRef: (node: HTMLDivElement | null) => void
}

const tabConfig: Array<{ key: TabKey; label: string; icon: typeof Tag }> = [
  { key: 'open', label: 'Open Coding', icon: Tag },
  { key: 'axial', label: 'Axial Coding', icon: Layers },
  { key: 'theory', label: 'Selective Coding', icon: Tag },
]

// Right-side panel stack for open/axial/selective coding.
export function CodingSidebar({
  codes,
  categories,
  ungroupedCodes,
  codeById,
  categoryStats,
  sharedCodes,
  coreCategoryId,
  coreCategoryDraft,
  assignedCodeCount,
  ungroupedCodeCount,
  memos,
  isTheoryEmpty,
  onAddCode,
  onApplyCode,
  onUpdateCode,
  onRemoveCode,
  getReadableTextColor,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onRemoveCodeFromCategory,
  onCoreCategoryChange,
  onCoreCategoryDraftChange,
  onCreateCoreCategory,
  onAddMemo,
  onUpdateMemo,
  onRemoveMemo,
  onApplyEditorCommand,
  onTheoryInput,
  onTheoryEditorRef,
}: CodingSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('open')

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          {tabConfig.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                id={tab.key === 'axial' ? 'axial-tab' : tab.key === 'theory' ? 'theory-tab' : undefined}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AnimatePresence mode="wait">
          {activeTab === 'open' ? (
            <motion.div
              key="open-coding"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4"
            >
              <OpenCodingPanel
                codes={codes}
                onAddCode={onAddCode}
                onApplyCode={onApplyCode}
                onUpdateCode={onUpdateCode}
                onRemoveCode={onRemoveCode}
                getReadableTextColor={getReadableTextColor}
              />
            </motion.div>
          ) : activeTab === 'axial' ? (
            <motion.div
              key="axial-coding"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4"
            >
              <AxialCodingPanel
                categories={categories}
                codes={codes}
                ungroupedCodes={ungroupedCodes}
                onAddCategory={onAddCategory}
                onUpdateCategory={onUpdateCategory}
                onRemoveCategory={onRemoveCategory}
                onRemoveCodeFromCategory={onRemoveCodeFromCategory}
                onRemoveCode={onRemoveCode}
              />
            </motion.div>
          ) : (
            <motion.div
              key="selective-coding"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4"
            >
              <SelectiveCodingPanel
                coreCategoryId={coreCategoryId}
                onCoreCategoryChange={onCoreCategoryChange}
                coreCategoryDraft={coreCategoryDraft}
                onCoreCategoryDraftChange={onCoreCategoryDraftChange}
                onCreateCoreCategory={onCreateCoreCategory}
                categories={categories}
                codeById={codeById}
                categoryStats={categoryStats}
                sharedCodes={sharedCodes}
                codeCount={codes.length}
                assignedCodeCount={assignedCodeCount}
                ungroupedCodeCount={ungroupedCodeCount}
                memos={memos}
                onAddMemo={onAddMemo}
                onUpdateMemo={onUpdateMemo}
                onRemoveMemo={onRemoveMemo}
                isTheoryEmpty={isTheoryEmpty}
                onApplyEditorCommand={onApplyEditorCommand}
                onTheoryInput={onTheoryInput}
                theoryEditorRef={onTheoryEditorRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
