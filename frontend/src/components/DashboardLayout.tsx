import { useEffect, useMemo, useRef } from 'react'
import { DndContext } from '@dnd-kit/core'
import { OnboardingTour } from './OnboardingTour'
import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { DocumentViewerPanel } from './DocumentViewerPanel'
import { DashboardHeader } from './DashboardHeader'
import { CollaborationLayer } from './CollaborationLayer'
import { CodingSidebar } from './CodingSidebar'
import { useCollaboration } from '../hooks/useCollaboration'
import { loadStoredProjectState } from '../lib/projectStorage'
import { useProjectState } from '../hooks/useProjectState'
import { useProjectIO } from '../hooks/useProjectIO'

export function DashboardLayout() {
  const storageKey = 'grounded-theory-app-state'
  const storedState = loadStoredProjectState(storageKey)
  const projectUpdateRef = useRef<(project: Record<string, unknown>) => void>(() => {})
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tour = useOnboardingTour()

  const {
    websocketOnline,
    sendJson,
    presenceUsers,
    localUser,
    remoteCursors,
    hasRemoteState,
  } = useCollaboration({
    onProjectUpdate: (project) => projectUpdateRef.current(project),
  })

  const project = useProjectState({
    storageKey,
    storedState,
    sendJson,
    hasRemoteState,
  })

  const { handleSaveProject, handleLoadProject, exportReport } = useProjectIO({
    documents: project.documents,
    codes: project.codes,
    categories: project.categories,
    memos: project.memos,
    coreCategoryId: project.coreCategoryId,
    theoryHtml: project.theoryHtml,
    activeDocumentId: project.activeDocumentId,
    documentViewMode: project.documentViewMode,
    documentFontFamily: project.documentFontFamily,
    documentLineHeight: project.documentLineHeight,
    showCodeLabels: project.showCodeLabels,
    showMemos: project.showMemos,
    setDocuments: project.setDocuments,
    setCodes: project.setCodes,
    setCategories: project.setCategories,
    setMemos: project.setMemos,
    setCoreCategoryId: project.setCoreCategoryId,
    setTheoryHtml: project.setTheoryHtml,
    setActiveDocumentId: project.setActiveDocumentId,
    setDocumentViewMode: project.setDocumentViewMode,
    setDocumentFontFamily: project.setDocumentFontFamily,
    setDocumentFontFamilyDisplay: project.setDocumentFontFamilyDisplay,
    setDocumentLineHeight: project.setDocumentLineHeight,
    setShowCodeLabels: project.setShowCodeLabels,
    setShowMemos: project.setShowMemos,
    getReadableTextColor: project.getReadableTextColor,
  })

  useEffect(() => {
    projectUpdateRef.current = project.applyRemoteProject
  }, [project.applyRemoteProject])

  const presenceById = useMemo(() => {
    return new Map(presenceUsers.map((user) => [user.id, user]))
  }, [presenceUsers])

  const handleRenameUser = () => {
    const currentName = localUser?.name ?? ''
    const nextName = window.prompt('Your name', currentName)?.trim()
    if (!nextName) return
    sendJson?.({ type: 'presence:rename', name: nextName })
  }

  return (
    <DndContext
      sensors={project.sensors}
      onDragStart={project.handleDragStart}
      onDragEnd={project.handleDragEnd}
    >
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <OnboardingTour run={tour.run} runId={tour.runId} onFinish={tour.stop} />
        <DashboardHeader
          websocketOnline={websocketOnline}
          presenceUsers={presenceUsers}
          localUser={localUser}
          fileInputRef={fileInputRef}
          onFileSelected={(file) => void handleLoadProject(file)}
          onSaveProject={handleSaveProject}
          onExportExcel={() => void exportReport('excel')}
          onExportWord={() => void exportReport('word')}
          onAddDocument={project.addNewDocument}
          onDeleteDocument={() => project.removeDocument(project.activeDocumentId)}
          canDeleteDocument={project.documents.length > 1}
          deleteDocumentLabel={project.getDocumentById(project.activeDocumentId)?.title ?? 'Untitled document'}
          onRenameUser={handleRenameUser}
          onUndo={project.handleUndo}
          onRedo={project.handleRedo}
          onCut={() => project.executeEditorCommand('cut')}
          onCopy={() => project.executeEditorCommand('copy')}
          onPaste={project.pasteFromClipboard}
          onSelectAll={() => project.executeEditorCommand('selectAll')}
          onToggleCodeLabels={() => project.setShowCodeLabels((current) => !current)}
          showCodeLabels={project.showCodeLabels}
          onToggleMemos={() => project.setShowMemos((current) => !current)}
          showMemos={project.showMemos}
          onTour={tour.restart}
        />

        {/* Main workspace: documents on the left, coding panels on the right. */}
        <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[3fr_2fr]">
          <DocumentViewerPanel
            documents={project.documents}
            activeDocumentId={project.activeDocumentId}
            documentViewMode={project.documentViewMode}
            onDocumentViewModeChange={project.setDocumentViewMode}
            onActiveDocumentChange={project.setActiveDocumentId}
            documentTitle={project.getDocumentById(project.activeDocumentId)?.title ?? ''}
            onDocumentTitleChange={(title) =>
              project.updateDocument(project.activeDocumentId, { title })
            }
            documentFontFamily={project.documentFontFamily}
            documentFontFamilyDisplay={project.documentFontFamilyDisplay}
            onDocumentFontFamilyChange={project.setDocumentFontFamily}
            onDocumentFontFamilyDisplayChange={project.setDocumentFontFamilyDisplay}
            documentLineHeight={project.documentLineHeight}
            onDocumentLineHeightChange={project.setDocumentLineHeight}
            showCodeLabels={project.showCodeLabels}
            onDocumentInput={(documentId, patch) => project.updateDocument(documentId, patch)}
            onDocumentCommand={project.applyDocumentCommand}
            onHighlightMouseDown={project.handleHighlightMouseDown}
            onHighlightMouseUp={project.handleSelection}
            onHighlightClick={(event) => {
              const removeButton = project.getClosestRemoveButton(event.target)
              if (!removeButton) return
              const highlight = removeButton.closest('span[data-code-id]') as HTMLElement | null
              if (!highlight) return
              event.preventDefault()
              event.stopPropagation()
              project.removeHighlightSpan(highlight)
            }}
            onEditorRef={project.setDocumentEditorRef}
          />

          <CodingSidebar
            codes={project.codes}
            categories={project.categories}
            ungroupedCodes={project.ungroupedCodes}
            codeById={project.codeById}
            categoryStats={project.categoryStats}
            sharedCodes={project.sharedCodes}
            coreCategoryId={project.coreCategoryId}
            coreCategoryDraft={project.coreCategoryDraft}
            assignedCodeCount={project.assignedCodeIds.size}
            ungroupedCodeCount={project.ungroupedCodes.length}
            memos={project.memos}
            isTheoryEmpty={project.isTheoryEmpty}
            showMemos={project.showMemos}
            onAddCode={project.addNewCode}
            onApplyCode={project.applyCodeToSelection}
            onUpdateCode={project.updateCode}
            onRemoveCode={project.removeCode}
            getReadableTextColor={project.getReadableTextColor}
            onAddCategory={project.handleAddCategory}
            onUpdateCategory={project.updateCategory}
            onRemoveCategory={project.removeCategory}
            onRemoveCodeFromCategory={project.removeCodeFromCategory}
            onCoreCategoryChange={project.setCoreCategoryId}
            onCoreCategoryDraftChange={project.setCoreCategoryDraft}
            onCreateCoreCategory={project.handleCreateCoreCategory}
            onAddCodeMemo={project.handleAddCodeMemo}
            onAddCategoryMemo={project.handleAddCategoryMemo}
            onAddGlobalMemo={project.handleAddGlobalMemo}
            onUpdateMemo={project.updateMemo}
            onRemoveMemo={project.removeMemo}
            onApplyEditorCommand={project.applyEditorCommand}
            onTheoryInput={project.setTheoryHtml}
            onTheoryEditorRef={project.setTheoryEditorRef}
          />
        </main>

        <CollaborationLayer
          remoteCursors={remoteCursors}
          presenceById={presenceById}
          localUser={localUser}
          activeCode={project.activeCode}
        />
      </div>
    </DndContext>
  )
}
