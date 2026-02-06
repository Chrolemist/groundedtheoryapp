import { useEffect, useRef } from 'react'
import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from '../components/DashboardLayout.types'
import { saveStoredProjectState } from '../lib/projectStorage'
import { isSameProjectSnapshot, type ProjectSnapshot } from '../lib/projectSnapshot'
import { useCodingState } from './useCodingState'
import { useDocumentState } from './useDocumentState'
import { useEditorCommands } from './useEditorCommands'
import { useHistory } from './useHistory'
import { useHighlighting } from './useHighlighting'
import { useProjectCollaborationSync } from './useProjectCollaborationSync'
import { useUndoRedoShortcuts } from './useUndoRedoShortcuts'

type UseProjectStateArgs = {
  storageKey: string
  storedState: {
    codes?: Code[]
    categories?: Category[]
    memos?: Memo[]
    documents?: DocumentItem[]
    activeDocumentId?: string
    documentViewMode?: DocumentViewMode
    theoryHtml?: string
    coreCategoryId?: string
    showMemos?: boolean
  } | null
  sendJson?: (payload: Record<string, unknown>) => void
  hasRemoteState: boolean
  persistProject?: (projectRaw: Record<string, unknown>) => void
}

// Core state + editing behavior for grounded theory workflows.
export function useProjectState({
  storageKey,
  storedState,
  sendJson,
  hasRemoteState,
  persistProject,
}: UseProjectStateArgs) {
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionDocumentIdRef = useRef<string | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const pushHistoryRef = useRef<() => void>(() => {})

  const documentState = useDocumentState({
    storedState,
    pushHistoryRef,
    isApplyingRemoteRef,
  })

  const codingState = useCodingState({
    storedState,
    pushHistoryRef,
    setDocuments: documentState.setDocuments,
    syncDocumentsForCodes: documentState.syncDocumentsForCodes,
    syncEditorForCodes: documentState.syncEditorForCodes,
    isApplyingRemoteRef,
  })

  const {
    documents,
    setDocuments,
    activeDocumentId,
    setActiveDocumentId,
    documentViewMode,
    setDocumentViewMode,
    documentEditorRef,
    setDocumentEditorRef,
    documentLineHeight,
    setDocumentLineHeight,
    documentFontFamily,
    setDocumentFontFamily,
    documentFontFamilyDisplay,
    setDocumentFontFamilyDisplay,
    updateDocument,
    getDocumentById,
    addNewDocument,
    removeDocument,
    applyCodeStylesToEditor,
  } = documentState

  const {
    codes,
    setCodes,
    categories,
    setCategories,
    memos,
    setMemos,
    coreCategoryId,
    setCoreCategoryId,
    coreCategoryDraft,
    setCoreCategoryDraft,
    theoryHtml,
    setTheoryHtml,
    showCodeLabels,
    setShowCodeLabels,
    showMemos,
    setShowMemos,
    codeById,
    assignedCodeIds,
    ungroupedCodes,
    categoryStats,
    sharedCodes,
    isTheoryEmpty,
    sensors,
    activeCode,
    getReadableTextColor,
    addNewCode,
    updateCode,
    removeCode,
    updateCategory,
    handleAddCategory,
    removeCategory,
    removeCodeFromCategory,
    handleAddGlobalMemo,
    handleAddCodeMemo,
    handleAddCategoryMemo,
    updateMemo,
    removeMemo,
    handleCreateCoreCategory,
    handleDragStart,
    handleDragEnd,
    theoryEditorRef,
    setTheoryEditorRef,
  } = codingState

  const createSnapshot = (): ProjectSnapshot => {
    const payload: ProjectSnapshot = {
      documents: documents.map((doc) => ({ ...doc })),
      codes: codes.map((code) => ({ ...code })),
      categories: categories.map((category) => ({
        ...category,
        codeIds: [...category.codeIds],
      })),
      memos: memos.map((memo) => ({ ...memo })),
      activeDocumentId,
      documentViewMode,
      theoryHtml,
      coreCategoryId,
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(payload)
    }
    return JSON.parse(JSON.stringify(payload)) as typeof payload
  }

  const restoreSnapshot = (snapshot: ProjectSnapshot) => {
    setDocuments(snapshot.documents)
    setCodes(snapshot.codes)
    setCategories(snapshot.categories)
    setMemos(snapshot.memos)
    setActiveDocumentId(snapshot.activeDocumentId)
    setDocumentViewMode(snapshot.documentViewMode)
    setTheoryHtml(snapshot.theoryHtml)
    setCoreCategoryId(snapshot.coreCategoryId)
  }

  const { applyEditorCommand, applyDocumentCommand, executeEditorCommand, pasteFromClipboard } =
    useEditorCommands({ documentEditorRef, theoryEditorRef })

  const { pushHistory, handleUndo, handleRedo } = useHistory({
    createSnapshot,
    restoreSnapshot,
    isSameSnapshot: isSameProjectSnapshot,
    executeEditorCommand,
  })

  useEffect(() => {
    pushHistoryRef.current = pushHistory
  }, [pushHistory])

  const {
    handleHighlightMouseDown,
    handleSelection,
    getClosestRemoveButton,
    applyCodeToSelection,
    removeHighlightSpan,
    getSelectionDocumentId,
  } = useHighlighting({
    codeById,
    selectionRangeRef,
    selectionDocumentIdRef,
    updateDocument,
    pushHistory,
  })

  useUndoRedoShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
  })

  useEffect(() => {
    saveStoredProjectState(storageKey, {
      codes,
      categories,
      memos,
      documents,
      activeDocumentId,
      documentViewMode,
      theoryHtml,
      coreCategoryId,
      showMemos,
    })
  }, [
    storageKey,
    codes,
    categories,
    memos,
    documents,
    activeDocumentId,
    documentViewMode,
    theoryHtml,
    coreCategoryId,
    showMemos,
  ])

  useEffect(() => {
    if (documentViewMode !== 'single') return
    applyCodeStylesToEditor(codeById)
  }, [
    activeDocumentId,
    documents,
    documentViewMode,
    codeById,
    applyCodeStylesToEditor,
  ])

  const { applyRemoteProject } = useProjectCollaborationSync({
    sendJson,
    hasRemoteState,
    isApplyingRemoteRef,
    selectionRangeRef,
    selectionDocumentIdRef,
    getSelectionDocumentId,
    documentFontFamily,
    setDocumentFontFamilyDisplay,
    documents,
    codes,
    categories,
    memos,
    coreCategoryId,
    theoryHtml,
    setDocuments,
    setCodes,
    setCategories,
    setMemos,
    setCoreCategoryId,
    setTheoryHtml,
    getReadableTextColor,
    persistProject,
  })

  return {
    documents,
    setDocuments,
    activeDocumentId,
    setActiveDocumentId,
    documentViewMode,
    setDocumentViewMode,
    documentEditorRef,
    theoryEditorRef,
    setDocumentEditorRef,
    setTheoryEditorRef,
    codes,
    setCodes,
    categories,
    setCategories,
    memos,
    setMemos,
    coreCategoryId,
    setCoreCategoryId,
    coreCategoryDraft,
    setCoreCategoryDraft,
    theoryHtml,
    setTheoryHtml,
    showCodeLabels,
    setShowCodeLabels,
    showMemos,
    setShowMemos,
    documentLineHeight,
    setDocumentLineHeight,
    documentFontFamily,
    setDocumentFontFamily,
    documentFontFamilyDisplay,
    setDocumentFontFamilyDisplay,
    codeById,
    assignedCodeIds,
    ungroupedCodes,
    categoryStats,
    sharedCodes,
    isTheoryEmpty,
    sensors,
    activeCode,
    getReadableTextColor,
    applyRemoteProject,
    updateDocument,
    getDocumentById,
    addNewDocument,
    removeDocument,
    addNewCode,
    updateCode,
    removeCode,
    updateCategory,
    handleAddCategory,
    removeCategory,
    removeCodeFromCategory,
    handleAddGlobalMemo,
    handleAddCodeMemo,
    handleAddCategoryMemo,
    updateMemo,
    removeMemo,
    handleCreateCoreCategory,
    handleDragStart,
    handleDragEnd,
    applyEditorCommand,
    applyDocumentCommand,
    executeEditorCommand,
    pasteFromClipboard,
    handleHighlightMouseDown,
    handleSelection,
    getClosestRemoveButton,
    applyCodeToSelection,
    removeHighlightSpan,
    handleUndo,
    handleRedo,
  }
}
