import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Layers, Tag } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Category, type Code, type Memo } from '../types'
import { OpenCodingPanel } from './OpenCodingPanel'
import { AxialCodingPanel } from './AxialCodingPanel'
import { MemosPanel } from './MemosPanel'
import { SelectiveCodingPanel } from './SelectiveCodingPanel'

type TabKey = 'open' | 'axial' | 'theory' | 'memos'

type CodingSidebarProps = {
  codes: Code[]
  categories: Category[]
  ungroupedCodes: Code[]
  coreCategoryId: string
  coreCategoryDraft: string
  memos: Memo[]
  isTheoryEmpty: boolean
  showMemos: boolean
  onAddCode: () => void
  onApplyCode: (codeId: string) => void
  onUpdateCode: (codeId: string, patch: Partial<Code>) => void
  onRemoveCode: (codeId: string) => void
  onAddCodeMemo: (codeId: string, codeLabel?: string) => void
  getReadableTextColor: (hex: string) => string
  onAddCategory: () => void
  onUpdateCategory: (categoryId: string, patch: Partial<Category>) => void
  onRemoveCategory: (categoryId: string) => void
  onRemoveCodeFromCategory: (categoryId: string, codeId: string) => void
  onAddCategoryMemo: (categoryId: string, categoryName?: string) => void
  onAddGlobalMemo: () => void
  onCoreCategoryDraftChange: (value: string) => void
  onCreateCoreCategory: () => void
  onUpdateMemo: (memoId: string, patch: Partial<Memo>) => void
  onRemoveMemo: (memoId: string) => void
  onApplyEditorCommand: (command: string, value?: string) => void
  onTheoryInput: (html: string) => void
  onTheoryEditorRef: (node: HTMLDivElement | null) => void
  onMoveCode: (codeId: string, targetId: string) => void
}

const tabConfig: Array<{ key: TabKey; label: string; icon: typeof Tag }> = [
  { key: 'open', label: 'Open Coding', icon: Tag },
  { key: 'axial', label: 'Axial Coding', icon: Layers },
  { key: 'theory', label: 'Selective Coding', icon: Tag },
  { key: 'memos', label: 'Memos', icon: BookOpen },
]

// Right-side panel stack for open/axial/selective coding.
export function CodingSidebar({
  codes,
  categories,
  ungroupedCodes,
  coreCategoryId,
  coreCategoryDraft,
  memos,
  isTheoryEmpty,
  showMemos,
  onAddCode,
  onApplyCode,
  onUpdateCode,
  onRemoveCode,
  onAddCodeMemo,
  getReadableTextColor,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onRemoveCodeFromCategory,
  onAddCategoryMemo,
  onAddGlobalMemo,
  onCoreCategoryDraftChange,
  onCreateCoreCategory,
  onUpdateMemo,
  onRemoveMemo,
  onApplyEditorCommand,
  onTheoryInput,
  onTheoryEditorRef,
  onMoveCode,
}: CodingSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('open')
  const resolvedActiveTab = !showMemos && activeTab === 'memos' ? 'open' : activeTab

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          {tabConfig
            .filter((tab) => (tab.key === 'memos' ? showMemos : true))
            .map((tab) => {
            const Icon = tab.icon
            return (
              <button
                id={
                  tab.key === 'axial'
                    ? 'axial-tab'
                    : tab.key === 'theory'
                      ? 'theory-tab'
                      : tab.key === 'memos'
                        ? 'memos-tab'
                        : undefined
                }
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  resolvedActiveTab === tab.key
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
        <AnimatePresence mode="popLayout">
          {resolvedActiveTab === 'open' ? (
            <motion.div
              key="open-coding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-4"
            >
              <OpenCodingPanel
                codes={codes}
                memos={memos}
                showMemos={showMemos}
                onAddCode={onAddCode}
                onApplyCode={onApplyCode}
                onUpdateCode={onUpdateCode}
                onRemoveCode={onRemoveCode}
                onAddCodeMemo={onAddCodeMemo}
                onUpdateMemo={onUpdateMemo}
                onRemoveMemo={onRemoveMemo}
                getReadableTextColor={getReadableTextColor}
              />
            </motion.div>
          ) : resolvedActiveTab === 'axial' ? (
            <motion.div
              key="axial-coding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-4"
            >
              <AxialCodingPanel
                categories={categories}
                codes={codes}
                ungroupedCodes={ungroupedCodes}
                memos={memos}
                showMemos={showMemos}
                onAddCategory={onAddCategory}
                onUpdateCategory={onUpdateCategory}
                onRemoveCategory={onRemoveCategory}
                onRemoveCodeFromCategory={onRemoveCodeFromCategory}
                onRemoveCode={onRemoveCode}
                onAddCategoryMemo={onAddCategoryMemo}
                onUpdateMemo={onUpdateMemo}
                onRemoveMemo={onRemoveMemo}
                onMoveCode={onMoveCode}
              />
            </motion.div>
          ) : resolvedActiveTab === 'theory' ? (
            <motion.div
              key="selective-coding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-4"
            >
              <SelectiveCodingPanel
                coreCategoryId={coreCategoryId}
                coreCategoryDraft={coreCategoryDraft}
                onCoreCategoryDraftChange={onCoreCategoryDraftChange}
                onCreateCoreCategory={onCreateCoreCategory}
                categories={categories}
                isTheoryEmpty={isTheoryEmpty}
                onApplyEditorCommand={onApplyEditorCommand}
                onTheoryInput={onTheoryInput}
                theoryEditorRef={onTheoryEditorRef}
              />
            </motion.div>
          ) : (
            <motion.div
              key="memos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-4"
            >
              <MemosPanel
                memos={memos}
                onAddGlobalMemo={onAddGlobalMemo}
                onUpdateMemo={onUpdateMemo}
                onRemoveMemo={onRemoveMemo}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
