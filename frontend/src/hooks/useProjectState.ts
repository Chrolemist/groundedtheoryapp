import { useCallback, useEffect, useRef } from 'react'
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
import { useYjsSync } from './useYjsSync'

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
    updatedAt?: number
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
  const disableLocalStoragePersist = true
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionDocumentIdRef = useRef<string | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const pushHistoryRef = useRef<() => void>(() => {})
  const removeHighlightsByCodeIdRef = useRef<(codeId: string) => void>(() => {})
  const clearYjsFragmentsForRemovedCodeRef = useRef<(codeId: string) => void>(() => {})
  const storedHasData = Boolean(
    storedState?.codes?.length ||
      storedState?.categories?.length ||
      storedState?.documents?.length ||
      storedState?.memos?.length ||
      storedState?.theoryHtml ||
      storedState?.coreCategoryId,
  )
  const projectUpdatedAtRef = useRef<number>(storedState?.updatedAt ?? 0)
  const hasLocalProjectUpdateRef = useRef(false)
  const didInitRef = useRef(false)

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
    removeHighlightsByCodeId: (codeId) => removeHighlightsByCodeIdRef.current(codeId),
    clearYjsFragmentsForRemovedCode: (codeId) =>
      clearYjsFragmentsForRemovedCodeRef.current(codeId),
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
    documentEditorInstanceRef,
    documentEditorInstancesRef,
    setDocumentEditorRef,
    setDocumentEditorInstance,
    documentLineHeight,
    setDocumentLineHeight,
    documentFontFamily,
    setDocumentFontFamily,
    documentFontFamilyDisplay,
    setDocumentFontFamilyDisplay,
    updateDocument,
    getDocumentById,
    addNewDocument,
    removeDocument: removeDocumentState,
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
    moveCodeToCategory,
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
    removeHighlightsByCodeId,
    getSelectionDocumentId,
  } = useHighlighting({
    codeById,
    selectionRangeRef,
    selectionDocumentIdRef,
    updateDocument,
    pushHistory,
    documentEditorInstanceRef,
    documentEditorInstancesRef,
    activeDocumentId,
  })
  useEffect(() => {
    removeHighlightsByCodeIdRef.current = removeHighlightsByCodeId
  }, [removeHighlightsByCodeId])

  useUndoRedoShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
  })

  useEffect(() => {
    if (disableLocalStoragePersist) return
    if (projectUpdatedAtRef.current === 0 && storedHasData) {
      projectUpdatedAtRef.current = Date.now()
    }
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
      updatedAt: projectUpdatedAtRef.current,
    })
  }, [
    disableLocalStoragePersist,
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
    storedHasData,
  ])

  useEffect(() => {
    if (isApplyingRemoteRef.current) return
    if (!didInitRef.current) {
      didInitRef.current = true
      return
    }
    const nextUpdatedAt = Date.now()
    if (nextUpdatedAt === projectUpdatedAtRef.current) return
    projectUpdatedAtRef.current = nextUpdatedAt
    hasLocalProjectUpdateRef.current = true
  }, [
    codes,
    categories,
    memos,
    documents,
    theoryHtml,
    coreCategoryId,
  ])

  const { ydoc } = useYjsSync({
    documents,
    codes,
    categories,
    memos,
    theoryHtml,
    coreCategoryId,
    coreCategoryDraft,
    setDocuments,
    setCodes,
    setCategories,
    setMemos,
    setTheoryHtml,
    setCoreCategoryId,
    setCoreCategoryDraft,
    isApplyingRemoteRef,
  })

  const handleRemoveDocument = (documentId: string) => {
    removeDocumentState(documentId)
    documentEditorInstancesRef.current.delete(documentId)
    if (ydoc) {
      const fragment = ydoc.getXmlFragment(documentId)
      if (fragment.length > 0) fragment.delete(0, fragment.length)
    }
  }

  const clearYjsFragmentsForRemovedCode = useCallback((codeId: string) => {
    if (!ydoc) return
    const openDocIds = new Set(documentEditorInstancesRef.current.keys())
    documents.forEach((doc) => {
      if (openDocIds.has(doc.id)) return
      if (!doc.html || !doc.html.includes(codeId)) return
      const fragment = ydoc.getXmlFragment(doc.id)
      if (fragment.length > 0) fragment.delete(0, fragment.length)
    })
  }, [ydoc, documents, documentEditorInstancesRef])

  useEffect(() => {
    clearYjsFragmentsForRemovedCodeRef.current = clearYjsFragmentsForRemovedCode
  }, [clearYjsFragmentsForRemovedCode])

  useEffect(() => {
    if (documentViewMode !== 'single') return
    if (ydoc) return
    applyCodeStylesToEditor(codeById)
  }, [
    activeDocumentId,
    documents,
    documentViewMode,
    codeById,
    applyCodeStylesToEditor,
    ydoc,
  ])

  const { applyRemoteProject } = useProjectCollaborationSync({
    sendJson,
    hasRemoteState,
    isApplyingRemoteRef,
    selectionRangeRef,
    selectionDocumentIdRef,
    getSelectionDocumentId,
    documentEditorInstancesRef,
    documentFontFamily,
    setDocumentFontFamilyDisplay,
    documents,
    codes,
    categories,
    memos,
    coreCategoryId,
    theoryHtml,
    projectUpdatedAtRef,
    hasLocalProjectUpdateRef,
    setDocuments,
    setCodes,
    setCategories,
    setMemos,
    setCoreCategoryId,
    setTheoryHtml,
    getReadableTextColor,
    persistProject,
    enableProjectSync: false,
  })

  return {
    documents,
    setDocuments,
    activeDocumentId,
    setActiveDocumentId,
    documentViewMode,
    setDocumentViewMode,
    documentEditorRef,
    documentEditorInstanceRef,
    documentEditorInstancesRef,
    theoryEditorRef,
    setDocumentEditorRef,
    setDocumentEditorInstance,
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
    getReadableTextColor,
    applyRemoteProject,
    updateDocument,
    getDocumentById,
    addNewDocument,
    removeDocument: handleRemoveDocument,
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
    moveCodeToCategory,
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
    ydoc,
  }
}
