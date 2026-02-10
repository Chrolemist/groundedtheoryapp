import { useEffect, useMemo, useRef, useState } from 'react'
import { OnboardingTour } from './OnboardingTour'
import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { DocumentViewerPanel } from './DocumentViewerPanel'
import { DashboardHeader } from './DashboardHeader'
import { CollaborationLayer } from './CollaborationLayer'
import { CodingSidebar } from './CodingSidebar'
import { ProjectPickerModal } from './ProjectPickerModal'
import { AdminLoginModal } from './AdminLoginModal'
import { useCollaboration } from '../hooks/useCollaboration'
import { loadStoredProjectState } from '../lib/projectStorage'
import { useProjectState } from '../hooks/useProjectState'
import { useProjectIO } from '../hooks/useProjectIO'
import { useProjectPersistence } from '../hooks/useProjectPersistence'
import { useProjectCatalog } from '../hooks/useProjectCatalog'

export function DashboardLayout() {
  const storageKey = 'grounded-theory-app-state'
  const disableLocalStorage = true
  const storedState = disableLocalStorage ? null : loadStoredProjectState(storageKey)
  const disableWsEnv = import.meta.env.VITE_DISABLE_WS === 'true'
  const isolationMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    const envEnabled = (import.meta.env.VITE_ISOLATION_MODE as string | undefined) === 'true'
    const localEnabled = window.localStorage.getItem('gt-isolation') === 'true'
    return envEnabled || localEnabled
  }, [])
  const plainEditorMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('gt-plain-editor') === 'true'
  }, [])
  const hideSidebarMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('gt-hide-sidebar') === 'true'
  }, [])
  const disableWsDebug = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('gt-disable-ws') === 'true'
  }, [])
  const disableWs = disableWsEnv || disableWsDebug
  const projectUpdateRef = useRef<(project: Record<string, unknown>) => void>(() => {})
  const remoteLoadedRef = useRef(false)
  const activeProjectIdRef = useRef<string | null>(null)
  const tour = useOnboardingTour()
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null)
  const [adminRetryAfterSeconds, setAdminRetryAfterSeconds] = useState<number | null>(null)
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false)
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'document' | 'coding'>(
    'document',
  )

  const apiBase = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const configured = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
    if (configured) return configured.replace(/\/$/, '')
    if (window.location.port === '5173') return 'http://localhost:8000'
    return window.location.origin
  }, [])

  const catalog = useProjectCatalog({
    apiBase,
    adminToken,
    remoteLoadedRef,
    applyRemoteProject: (project) => projectUpdateRef.current(project),
    autoCreateIfEmpty: false,
    onActiveProjectChange: (projectId, name) => {
      activeProjectIdRef.current = projectId
      document.title = name
        ? `GT · Grounded Theory - ${name}`
        : 'GT · Grounded Theory'
    },
  })

  const { activeProjectId: catalogActiveProjectId, refreshStorage: refreshCatalogStorage } = catalog

  const {
    websocketOnline,
    sendJson,
    presenceUsers,
    localUser,
    remoteCursors,
    remoteSelections,
    hasRemoteState,
  } = useCollaboration({
    projectId: isolationMode ? null : catalogActiveProjectId,
    onProjectUpdate: (project) => projectUpdateRef.current(project),
    onProjectNameUpdate: (name) => catalog.applyRemoteProjectName(name),
  })

  const seedReady = useMemo(() => {
    if (!catalogActiveProjectId) return true
    if (disableWs) return true
    if (!websocketOnline) return false
    if (!localUser) return false
    if (!presenceUsers.length) return false
    return true
  }, [catalogActiveProjectId, disableWs, localUser, presenceUsers.length, websocketOnline])

  const canSeedInitialContent = useMemo(() => {
    if (!catalogActiveProjectId) return true
    if (disableWs) return true
    if (!websocketOnline) return false
    if (!localUser) return false
    if (!presenceUsers.length) return false
    const ids = presenceUsers.map((user) => user.id).filter(Boolean).sort()
    if (!ids.length) return false
    return localUser.id === ids[0]
  }, [catalogActiveProjectId, disableWs, localUser, presenceUsers, websocketOnline])

  const { persistProject, isSaving, lastSavedAt, saveError, saveWarning } = useProjectPersistence({
    apiBase,
    hasRemoteState,
    remoteLoadedRef,
    projectId: catalogActiveProjectId,
    websocketOnline,
    disableWs,
  })

  const project = useProjectState({
    storageKey,
    storedState,
    sendJson,
    hasRemoteState,
    persistProject,
    projectId: catalogActiveProjectId,
  })

  useEffect(() => {
    projectUpdateRef.current = project.applyRemoteProject
  }, [project.applyRemoteProject])

  useEffect(() => {
    if (!catalogActiveProjectId) {
      void refreshCatalogStorage()
    }
  }, [catalogActiveProjectId, refreshCatalogStorage])

  const { exportReport } = useProjectIO({
    documents: project.documents,
    codes: project.codes,
    categories: project.categories,
    memos: project.memos,
    coreCategoryId: project.coreCategoryId,
    theoryHtml: project.theoryHtml,
    activeDocumentId: project.activeDocumentId,
    projectId: catalog.activeProjectId,
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

  const openProjectModal = () => {
    setIsProjectModalOpen(true)
    void catalog.refreshProjects()
  }

  const handleCreateProject = async (name: string) => {
    await catalog.createProject(name)
    setIsProjectModalOpen(false)
  }

  const handleSelectProject = async (projectId: string) => {
    await catalog.loadProject(projectId)
    setIsProjectModalOpen(false)
  }

  const handleDuplicateProject = async (projectId: string) => {
    await catalog.duplicateProject(projectId)
    await catalog.refreshProjects()
  }

  const handlePurgeProjects = async () => {
    const ok = window.confirm(
      'Delete ALL projects permanently? This cannot be undone.',
    )
    if (!ok) return
    const deleted = await catalog.purgeProjects()
    if (deleted > 0) {
      activeProjectIdRef.current = null
      remoteLoadedRef.current = false
      project.setDocuments([])
      project.setCodes([])
      project.setCategories([])
      project.setMemos([])
      project.setCoreCategoryId('')
      project.setTheoryHtml('')
      project.setActiveDocumentId('')
      project.setDocumentViewMode('all')
      document.title = 'GT · Grounded Theory'
    }
  }

  const handleRenameProject = async (name: string) => {
    if (!catalog.activeProjectId) return
    const trimmed = name.trim()
    if (!trimmed) return
    await catalog.renameProject(catalog.activeProjectId, trimmed)
    // Also broadcast via WS using an existing message type so other clients can update
    // their project title even if the backend doesn't emit a dedicated project:rename event.
    sendJson?.({
      type: 'project:update',
      project_raw: {
        name: trimmed,
        updated_at: Date.now(),
      },
    })
  }

  const handleDeleteProject = async (projectId: string) => {
    const ok = window.confirm('Delete this project permanently? This cannot be undone.')
    if (!ok) return
    const wasActive = await catalog.deleteProject(projectId)
    if (wasActive) {
      activeProjectIdRef.current = null
      remoteLoadedRef.current = false
      project.setDocuments([])
      project.setCodes([])
      project.setCategories([])
      project.setMemos([])
      project.setCoreCategoryId('')
      project.setTheoryHtml('')
      project.setActiveDocumentId('')
      project.setDocumentViewMode('all')
    }
  }

  const handleCloseProject = () => {
    catalog.closeProject()
    activeProjectIdRef.current = null
    remoteLoadedRef.current = false
    project.setDocuments([])
    project.setCodes([])
    project.setCategories([])
    project.setMemos([])
    project.setCoreCategoryId('')
    project.setTheoryHtml('')
    project.setActiveDocumentId('')
    project.setDocumentViewMode('all')
    document.title = 'GT · Grounded Theory'
  }

  const headerSizeBytes = catalogActiveProjectId
    ? project.projectSizeBytes
    : catalog.totalProjectBytes
  const headerSizeLimit = catalogActiveProjectId
    ? project.projectSizeLimitBytes
    : catalog.totalProjectLimitBytes
  const headerSizeLabel = catalogActiveProjectId ? 'Lagring' : 'Total lagring'

  const presenceById = useMemo(() => {
    return new Map(presenceUsers.map((user) => [user.id, user]))
  }, [presenceUsers])

  const handleRenameUser = () => {
    const currentName = localUser?.name ?? ''
    const nextName = window.prompt('Your name', currentName)?.trim()
    if (!nextName) return
    try {
      window.localStorage.setItem('gt-client-name', nextName)
    } catch {
      // ignore
    }
    sendJson?.({ type: 'presence:rename', name: nextName })
  }

  const handleAdminLogin = async () => {
    if (!apiBase) {
      window.alert('Backend not available.')
      return
    }
    if (adminRetryAfterSeconds && adminRetryAfterSeconds > 0) {
      setIsAdminModalOpen(true)
      return
    }
    setAdminLoginError(null)
    setAdminRetryAfterSeconds(null)
    setAdminPassword('')
    setIsAdminModalOpen(true)
  }

  const submitAdminLogin = async () => {
    if (!apiBase) {
      window.alert('Backend not available.')
      return
    }
    if (adminRetryAfterSeconds && adminRetryAfterSeconds > 0) return
    if (!adminPassword.trim()) return
    try {
      setIsAdminLoggingIn(true)
      const response = await fetch(`${apiBase}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      })
      const data = (await response.json()) as {
        ok?: boolean
        message?: string
        retry_after_seconds?: number
        token?: string
        expires_in_seconds?: number
      }
      if (data.ok) {
        if (!data.token) {
          setAdminLoginError('Admin token missing from response')
          setAdminRetryAfterSeconds(null)
          return
        }
        setIsAdmin(true)
        setAdminToken(data.token)
        setIsAdminModalOpen(false)
        setAdminPassword('')
        setAdminLoginError(null)
        setAdminRetryAfterSeconds(null)
        return
      }
      setAdminLoginError(data.message ?? 'Incorrect password')
      if (typeof data.retry_after_seconds === 'number') {
        setAdminRetryAfterSeconds(data.retry_after_seconds)
      } else {
        setAdminRetryAfterSeconds(null)
      }
      setAdminPassword('')
    } catch {
      setAdminLoginError('Failed to verify admin password')
      setAdminRetryAfterSeconds(null)
    } finally {
      setIsAdminLoggingIn(false)
    }
  }

  useEffect(() => {
    if (adminRetryAfterSeconds === null) return
    if (adminRetryAfterSeconds <= 0) {
      setAdminRetryAfterSeconds(null)
      setAdminLoginError(null)
      return
    }
    const timer = window.setTimeout(() => {
      setAdminRetryAfterSeconds((current) =>
        typeof current === 'number' ? current - 1 : null,
      )
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [adminRetryAfterSeconds])

  const handleAdminLogout = () => {
    setIsAdmin(false)
    setAdminToken(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AdminLoginModal
        open={isAdminModalOpen}
        password={adminPassword}
        isSubmitting={isAdminLoggingIn}
        error={adminLoginError}
        retryAfterSeconds={adminRetryAfterSeconds}
        onPasswordChange={setAdminPassword}
        onSubmit={submitAdminLogin}
        onClose={() => setIsAdminModalOpen(false)}
      />
      <ProjectPickerModal
        open={isProjectModalOpen}
        projects={catalog.projects}
        activeProjectId={catalog.activeProjectId}
        isLoading={catalog.isLoadingProjects}
        error={catalog.projectError}
        canDeleteProjects={isAdmin}
        onClose={() => setIsProjectModalOpen(false)}
        onRefresh={() => void catalog.refreshProjects()}
        onSelect={(projectId: string) => void handleSelectProject(projectId)}
        onCreate={(name: string) => void handleCreateProject(name)}
        onDuplicate={(projectId: string) => void handleDuplicateProject(projectId)}
        onDelete={(projectId: string) => void handleDeleteProject(projectId)}
        onPurge={() => void handlePurgeProjects()}
      />
      <OnboardingTour key={tour.runId} run={tour.run} runId={tour.runId} onFinish={tour.stop} />
      <DashboardHeader
        websocketOnline={websocketOnline}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        saveWarning={saveWarning}
        projectSizeBytes={headerSizeBytes}
        projectSizeLimitBytes={headerSizeLimit ?? undefined}
        projectSizeLabel={headerSizeLabel}
        activeProjectName={catalog.activeProjectName}
        presenceUsers={presenceUsers}
        localUser={localUser}
        onNewProject={openProjectModal}
        onOpenProject={openProjectModal}
        onCloseProject={handleCloseProject}
        canCloseProject={Boolean(catalogActiveProjectId)}
        onExportExcel={() => void exportReport('excel')}
        onExportWord={() => void exportReport('word')}
        onAddDocument={project.addNewDocument}
        onDeleteDocument={() => project.removeDocument(project.activeDocumentId)}
        canDeleteDocument={project.documents.length > 0}
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
        isAdmin={isAdmin}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}

        showMobileWorkspaceTabs={Boolean(catalogActiveProjectId) && !(isolationMode || hideSidebarMode)}
        mobileWorkspaceTab={mobileWorkspaceTab}
        onMobileWorkspaceTabChange={setMobileWorkspaceTab}
      />

      {/* Main workspace: documents on the left, coding panels on the right. */}
      <main className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[3fr_2fr]">
        {catalogActiveProjectId ? (
          <>
            <div className={mobileWorkspaceTab === 'document' ? 'block' : 'hidden lg:block'}>
            <DocumentViewerPanel
              documents={project.documents}
              codes={project.codes}
              categories={project.categories}
              memos={project.memos}
              coreCategoryId={project.coreCategoryId}
              showMemos={project.showMemos}
              theoryHtml={project.theoryHtml}
              projectName={catalog.activeProjectName}
              onProjectNameChange={handleRenameProject}
              ydoc={project.ydoc}
              activeDocumentId={project.activeDocumentId}
              documentViewMode={project.documentViewMode}
              onDocumentViewModeChange={project.setDocumentViewMode}
              onActiveDocumentChange={project.setActiveDocumentId}
              onRemoveDocument={(documentId, title) => {
                if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
                project.removeDocument(documentId)
              }}
              onAddDocument={project.addNewDocument}
              onMoveDocument={project.moveDocument}
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
              onLocalChange={project.markLocalChange}
              onEditorReady={project.setDocumentEditorInstance}
              onHighlightMouseDown={project.handleHighlightMouseDown}
              onHighlightMouseUp={project.handleSelection}
              onHighlightClick={(event) => {
                const removeButton = project.getClosestRemoveButton(event.target)
                if (!removeButton) return
                const highlight = removeButton.closest('span[data-code-id]') as HTMLElement | null
                if (!highlight) return
                const handled = project.removeHighlightSpan(highlight)
                if (!handled) return
                event.preventDefault()
                event.stopPropagation()
              }}
              onEditorRef={project.setDocumentEditorRef}
              canSeedInitialContent={canSeedInitialContent}
              seedReady={seedReady}
              hasRemoteUpdates={project.hasRemoteUpdates}
              hasReceivedSync={project.hasReceivedSync}
              isolationMode={isolationMode}
              plainEditorMode={plainEditorMode}
            />
            </div>

            {isolationMode || hideSidebarMode ? null : (
              <div className={mobileWorkspaceTab === 'coding' ? 'block' : 'hidden lg:block'}>
                <CodingSidebar
                  codes={project.codes}
                  categories={project.categories}
                  ungroupedCodes={project.ungroupedCodes}
                  coreCategoryId={project.coreCategoryId}
                  coreCategoryDraft={project.coreCategoryDraft}
                  memos={project.memos}
                  isTheoryEmpty={project.isTheoryEmpty}
                  showMemos={project.showMemos}
                  ydoc={project.ydoc}
                  onAddCode={project.addNewCode}
                  onApplyCode={project.applyCodeToSelection}
                  onUpdateCode={project.updateCode}
                  onRemoveCode={project.removeCode}
                  getReadableTextColor={project.getReadableTextColor}
                  onAddCategory={project.handleAddCategory}
                  onUpdateCategory={project.updateCategory}
                  onRemoveCategory={project.removeCategory}
                  onRemoveCodeFromCategory={project.removeCodeFromCategory}
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
                  onMoveCode={project.moveCodeToCategory}
                />
              </div>
            )}
          </>
        ) : (
          <div className="col-span-full flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              No project open
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Choose a project to continue
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Open an existing project or create a new one to start coding documents.
            </p>
            <button
              type="button"
              onClick={openProjectModal}
              className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Open project
            </button>
          </div>
        )}
      </main>

      <CollaborationLayer
        remoteCursors={remoteCursors}
        remoteSelections={remoteSelections}
        presenceById={presenceById}
        localUser={localUser}
        documentEditorInstancesRef={project.documentEditorInstancesRef}
      />
    </div>
  )
}
