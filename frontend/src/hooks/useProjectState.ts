import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  projectId?: string | null
}

// Core state + editing behavior for grounded theory workflows.
export function useProjectState({
  storageKey,
  storedState,
  sendJson,
  hasRemoteState,
  persistProject,
  projectId,
}: UseProjectStateArgs) {
  const disableLocalStoragePersist = true
  const maxProjectBytes = Number(import.meta.env.VITE_MAX_PROJECT_BYTES) || 900000
  const debugEnabled =
    typeof window !== 'undefined' && window.localStorage.getItem('gt-debug') === 'true'
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionDocumentIdRef = useRef<string | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const lastDocDebugAtRef = useRef(0)
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

  useEffect(() => {
    // When switching/closing projects, ensure we don't carry a "dirty" flag or updatedAt
    // into the next project. Otherwise an autosave timer can persist an empty snapshot
    // and overwrite a real project.
    hasLocalProjectUpdateRef.current = false
    projectUpdatedAtRef.current = 0
  }, [projectId])

  useEffect(() => {
    // Ensure stale editor instances from a previous project can't be snapshotted
    // into the next project's manual save.
    documentEditorInstancesRef.current.clear()
    documentEditorInstanceRef.current = null
  }, [projectId])
  const markLocalChange = useCallback(() => {
    if (isApplyingRemoteRef.current) return
    hasLocalProjectUpdateRef.current = true
  }, [isApplyingRemoteRef])

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
    syncTipTapEditorsForCodes: documentState.syncTipTapEditorsForCodes,
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
    moveDocument: moveDocumentState,
    applyCodeStylesToEditor,
  } = documentState

  const shouldMarkDocumentChange = () => {
    if (typeof document === 'undefined') return true
    const active = document.activeElement
    if (!active) return true
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true
    if (active instanceof HTMLElement && active.isContentEditable) return true
    if (active instanceof HTMLElement && active.closest('.document-content')) return true
    if (active instanceof HTMLElement && active.closest('.ProseMirror')) return true
    return false
  }

  const updateDocumentWithDirty = useCallback(
    (documentId: string, patch: Partial<DocumentItem>) => {
      if (shouldMarkDocumentChange()) {
        markLocalChange()
      }

      if (debugEnabled && (typeof patch.html === 'string' || typeof patch.text === 'string')) {
        const now = Date.now()
        if (now - lastDocDebugAtRef.current > 800) {
          lastDocDebugAtRef.current = now
          console.log('[Project] updateDocument', {
            documentId,
            htmlLen: typeof patch.html === 'string' ? patch.html.length : undefined,
            textLen: typeof patch.text === 'string' ? patch.text.length : undefined,
            markedDirty: shouldMarkDocumentChange(),
          })
        }
      }
      updateDocument(documentId, patch)
    },
    [debugEnabled, markLocalChange, updateDocument],
  )

  const addNewDocumentWithDirty = useCallback(() => {
    markLocalChange()
    addNewDocument()
  }, [addNewDocument, markLocalChange])

  const removeDocumentWithDirty = useCallback(
    (documentId: string) => {
      markLocalChange()
      removeDocumentState(documentId)
    },
    [markLocalChange, removeDocumentState],
  )

  const moveDocumentWithDirty = useCallback(
    (documentId: string, direction: 'up' | 'down') => {
      markLocalChange()
      moveDocumentState(documentId, direction)
    },
    [markLocalChange, moveDocumentState],
  )

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

  const addNewCodeWithDirty = useCallback(() => {
    markLocalChange()
    addNewCode()
  }, [addNewCode, markLocalChange])

  const updateCodeWithDirty = useCallback(
    (codeId: string, patch: Partial<Code>) => {
      markLocalChange()
      updateCode(codeId, patch)
    },
    [markLocalChange, updateCode],
  )

  const removeCodeWithDirty = useCallback(
    (codeId: string) => {
      markLocalChange()
      removeCode(codeId)
    },
    [markLocalChange, removeCode],
  )

  const updateCategoryWithDirty = useCallback(
    (categoryId: string, patch: Partial<Category>) => {
      markLocalChange()
      updateCategory(categoryId, patch)
    },
    [markLocalChange, updateCategory],
  )

  const handleAddCategoryWithDirty = useCallback(() => {
    markLocalChange()
    handleAddCategory()
  }, [handleAddCategory, markLocalChange])

  const removeCategoryWithDirty = useCallback(
    (categoryId: string) => {
      markLocalChange()
      removeCategory(categoryId)
    },
    [markLocalChange, removeCategory],
  )

  const removeCodeFromCategoryWithDirty = useCallback(
    (categoryId: string, codeId: string) => {
      markLocalChange()
      removeCodeFromCategory(categoryId, codeId)
    },
    [markLocalChange, removeCodeFromCategory],
  )

  const handleAddGlobalMemoWithDirty = useCallback(() => {
    markLocalChange()
    handleAddGlobalMemo()
  }, [handleAddGlobalMemo, markLocalChange])

  const handleAddCodeMemoWithDirty = useCallback(
    (codeId: string, codeLabel?: string) => {
      markLocalChange()
      handleAddCodeMemo(codeId, codeLabel)
    },
    [handleAddCodeMemo, markLocalChange],
  )

  const handleAddCategoryMemoWithDirty = useCallback(
    (categoryId: string, categoryName?: string) => {
      markLocalChange()
      handleAddCategoryMemo(categoryId, categoryName)
    },
    [handleAddCategoryMemo, markLocalChange],
  )

  const updateMemoWithDirty = useCallback(
    (memoId: string, patch: Partial<Memo>) => {
      markLocalChange()
      updateMemo(memoId, patch)
    },
    [markLocalChange, updateMemo],
  )

  const removeMemoWithDirty = useCallback(
    (memoId: string) => {
      markLocalChange()
      removeMemo(memoId)
    },
    [markLocalChange, removeMemo],
  )

  const handleCreateCoreCategoryWithDirty = useCallback(() => {
    markLocalChange()
    handleCreateCoreCategory()
  }, [handleCreateCoreCategory, markLocalChange])

  const moveCodeToCategoryWithDirty = useCallback(
    (codeId: string, targetId: string) => {
      markLocalChange()
      moveCodeToCategory(codeId, targetId)
    },
    [markLocalChange, moveCodeToCategory],
  )

  const setTheoryHtmlWithDirty = useCallback(
    (html: string) => {
      markLocalChange()
      setTheoryHtml(html)
    },
    [markLocalChange, setTheoryHtml],
  )

  const setCoreCategoryIdWithDirty = useCallback(
    (id: string) => {
      markLocalChange()
      setCoreCategoryId(id)
    },
    [markLocalChange, setCoreCategoryId],
  )

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
    updateDocument: updateDocumentWithDirty,
    pushHistory,
    documentEditorInstanceRef,
    documentEditorInstancesRef,
    activeDocumentId,
    onLocalChange: markLocalChange,
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
      // Do not use Date.now() here; it can be ahead of the backend's canonical timestamps
      // and cause incoming collaboration updates to be treated as stale.
      // We only need a non-zero sentinel to avoid "allowReplace" behavior.
      projectUpdatedAtRef.current = 1
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

  const projectSizeBytes = useMemo(() => {
    try {
      const payload = JSON.stringify({
        documents,
        codes,
        categories,
        memos,
        coreCategoryId,
        theoryHtml,
      })
      return new TextEncoder().encode(payload).length
    } catch {
      return null
    }
  }, [documents, codes, categories, memos, coreCategoryId, theoryHtml])


  const { ydoc, hasRemoteUpdates, hasReceivedSync } = useYjsSync({
    documents,
    codes,
    categories,
    memos,
    theoryHtml,
    coreCategoryId,
    coreCategoryDraft,
    projectId,
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
    removeDocumentWithDirty(documentId)
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
    hasRemoteUpdates,
  ])

  const { applyRemoteProject } = useProjectCollaborationSync({
    sendJson,
    hasRemoteState,
    projectId,
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
    enableAutosave: true,
    enableProjectSync: true,
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
    setCoreCategoryId: setCoreCategoryIdWithDirty,
    coreCategoryDraft,
    setCoreCategoryDraft,
    theoryHtml,
    setTheoryHtml: setTheoryHtmlWithDirty,
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
    markLocalChange,
    updateDocument: updateDocumentWithDirty,
    getDocumentById,
    addNewDocument: addNewDocumentWithDirty,
    removeDocument: handleRemoveDocument,
    moveDocument: moveDocumentWithDirty,
    addNewCode: addNewCodeWithDirty,
    updateCode: updateCodeWithDirty,
    removeCode: removeCodeWithDirty,
    updateCategory: updateCategoryWithDirty,
    handleAddCategory: handleAddCategoryWithDirty,
    removeCategory: removeCategoryWithDirty,
    removeCodeFromCategory: removeCodeFromCategoryWithDirty,
    handleAddGlobalMemo: handleAddGlobalMemoWithDirty,
    handleAddCodeMemo: handleAddCodeMemoWithDirty,
    handleAddCategoryMemo: handleAddCategoryMemoWithDirty,
    updateMemo: updateMemoWithDirty,
    removeMemo: removeMemoWithDirty,
    handleCreateCoreCategory: handleCreateCoreCategoryWithDirty,
    moveCodeToCategory: moveCodeToCategoryWithDirty,
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
    projectSizeBytes,
    projectSizeLimitBytes: maxProjectBytes,
    hasRemoteUpdates,
    hasReceivedSync,
  }
}
