import { useEffect, useState } from 'react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { MenuBar } from './MenuBar'
import { type PresenceUser } from './DashboardLayout.types'
import { cn } from '../lib/cn'
import { getResolvedTheme, toggleTheme } from '../lib/theme'

type DashboardHeaderProps = {
  websocketOnline: boolean
  isSaving: boolean
  lastSavedAt: number | null
  saveError: string | null
  saveWarning?: string | null
  canManualSave?: boolean
  onManualSave?: () => void
  projectSizeBytes?: number | null
  projectSizeLimitBytes?: number
  projectSizeLabel?: string
  activeProjectName?: string
  presenceUsers: PresenceUser[]
  localUser: PresenceUser | null
  onExportExcel: () => void
  onExportWord: () => void
  onNewProject: () => void
  onOpenProject: () => void
  onCloseProject: () => void
  canCloseProject: boolean
  onAddDocument: () => void
  onDeleteDocument: () => void
  canDeleteDocument: boolean
  deleteDocumentLabel: string
  onRenameUser: () => void
  onUndo: () => void
  onRedo: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
  onToggleCodeLabels: () => void
  showCodeLabels: boolean
  onToggleMemos: () => void
  showMemos: boolean
  onTour: () => void
  isAdmin: boolean
  onAdminLogin: () => void
  onAdminLogout: () => void

  showMobileWorkspaceTabs?: boolean
  mobileWorkspaceTab?: 'document' | 'coding'
  onMobileWorkspaceTabChange?: (tab: 'document' | 'coding') => void
}

// Top navigation with app actions and collaborator presence.
export function DashboardHeader({
  websocketOnline,
  isSaving,
  lastSavedAt,
  saveError,
  saveWarning,
  canManualSave,
  onManualSave,
  projectSizeBytes,
  projectSizeLimitBytes,
  projectSizeLabel,
  activeProjectName,
  presenceUsers,
  localUser,
  onExportExcel,
  onExportWord,
  onNewProject,
  onOpenProject,
  onCloseProject,
  canCloseProject,
  onAddDocument,
  onDeleteDocument,
  canDeleteDocument,
  deleteDocumentLabel,
  onRenameUser,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onToggleCodeLabels,
  showCodeLabels,
  onToggleMemos,
  showMemos,
  onTour,
  isAdmin,
  onAdminLogin,
  onAdminLogout,

  showMobileWorkspaceTabs,
  mobileWorkspaceTab,
  onMobileWorkspaceTabChange,
}: DashboardHeaderProps) {
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : getResolvedTheme(),
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const update = () => setResolvedTheme(getResolvedTheme())
    update()

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'gt-theme') return
      update()
    }

    window.addEventListener('storage', handleStorage)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => update()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleMediaChange)
      return () => {
        window.removeEventListener('storage', handleStorage)
        media.removeEventListener('change', handleMediaChange)
      }
    }

    media.addListener(handleMediaChange)
    return () => {
      window.removeEventListener('storage', handleStorage)
      media.removeListener(handleMediaChange)
    }
  }, [])

  const formatSavedTime = (value: number) =>
    new Date(value).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    })

  const saveLabel = isSaving
    ? 'Sparar...'
    : saveError
      ? 'Sparande misslyckades'
      : lastSavedAt
        ? `Sparad ${formatSavedTime(lastSavedAt)}`
        : 'Ej sparad'

  const formatBytes = (value: number) => {
    if (value >= 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(value / 1024).toFixed(1)} KB`
  }

  const sizePercent =
    typeof projectSizeBytes === 'number' && projectSizeLimitBytes
      ? Math.min(100, Math.max(0, (projectSizeBytes / projectSizeLimitBytes) * 100))
      : null
  const sizeLabel =
    typeof projectSizeBytes === 'number' && projectSizeLimitBytes
      ? `${formatBytes(projectSizeBytes)} / ${formatBytes(projectSizeLimitBytes)}`
      : null
  const sizeTone =
    sizePercent === null
      ? 'bg-slate-600'
      : sizePercent >= 95
        ? 'bg-rose-500'
        : sizePercent >= 80
          ? 'bg-amber-500'
          : 'bg-emerald-500'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-2 lg:gap-3 lg:px-6 lg:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900 lg:h-10 lg:w-10 lg:text-sm">
              GT
            </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:hidden">
                  {activeProjectName ?? 'Grounded Theory'}
                </p>
                <p className="hidden text-lg font-semibold sm:block">Grounded Theory</p>
                {activeProjectName ? (
                  <p className="hidden truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                    {activeProjectName}
                  </p>
                ) : null}
                <div className="mt-1 hidden items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-slate-500 [-webkit-overflow-scrolling:touch] dark:text-slate-400 sm:flex lg:flex-wrap lg:overflow-visible lg:whitespace-normal">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    websocketOnline ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span>{websocketOnline ? 'Online' : 'Offline'}</span>
                <span className="mx-1 hidden text-slate-300 dark:text-slate-700 sm:inline">•</span>
                <span className="hidden items-center gap-2 sm:inline-flex">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isSaving
                        ? 'bg-amber-500'
                        : saveError
                          ? 'bg-rose-500'
                          : lastSavedAt
                            ? 'bg-emerald-500'
                            : 'bg-slate-300',
                    )}
                  />
                  <span className="tabular-nums">{saveLabel}</span>
                  {saveWarning && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      {saveWarning}
                    </span>
                  )}
                </span>
              </div>
            </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Open menu"
                title="Menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleTheme()
                  setResolvedTheme(getResolvedTheme())
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                title={resolvedTheme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
                aria-label={resolvedTheme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
              >
                {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="hidden lg:block">
            <MenuBar
              onOpenProject={onOpenProject}
              onNewProject={onNewProject}
              onCloseProject={onCloseProject}
              canCloseProject={canCloseProject}
              onExportExcel={onExportExcel}
              onExportWord={onExportWord}
              onAddDocument={onAddDocument}
              onDeleteDocument={onDeleteDocument}
              canDeleteDocument={canDeleteDocument}
              deleteDocumentLabel={deleteDocumentLabel}
              onRenameUser={onRenameUser}
              onUndo={onUndo}
              onRedo={onRedo}
              onCut={onCut}
              onCopy={onCopy}
              onPaste={onPaste}
              onSelectAll={onSelectAll}
              onToggleCodeLabels={onToggleCodeLabels}
              showCodeLabels={showCodeLabels}
              onToggleMemos={onToggleMemos}
              showMemos={showMemos}
              onTour={onTour}
              isAdmin={isAdmin}
              onAdminLogin={onAdminLogin}
              onAdminLogout={onAdminLogout}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              toggleTheme()
              setResolvedTheme(getResolvedTheme())
            }}
            className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex"
            title={resolvedTheme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
            aria-label={resolvedTheme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {resolvedTheme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
            </span>
          </button>
          {onManualSave ? (
            <button
              type="button"
              onClick={onManualSave}
              disabled={!canManualSave || isSaving}
              className={cn(
                'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
                !canManualSave || isSaving
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              Save
            </button>
          ) : null}
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5 text-xs text-slate-500 [-webkit-overflow-scrolling:touch] dark:text-slate-400 lg:flex-wrap lg:overflow-visible lg:whitespace-normal lg:pb-0">
            {presenceUsers.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="font-semibold text-slate-600 dark:text-slate-200">
                  {user.name}
                  {localUser?.id === user.id ? ' (you)' : ''}
                </span>
              </span>
            ))}
            {!presenceUsers.length && (
              <span className="text-xs text-slate-400 dark:text-slate-500">No collaborators yet</span>
            )}
          </div>

          {showMobileWorkspaceTabs && mobileWorkspaceTab && onMobileWorkspaceTabChange ? (
            <div className="lg:hidden">
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => onMobileWorkspaceTabChange('document')}
                  className={
                    mobileWorkspaceTab === 'document'
                      ? 'flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }
                >
                  Dokument
                </button>
                <button
                  type="button"
                  onClick={() => onMobileWorkspaceTabChange('coding')}
                  className={
                    mobileWorkspaceTab === 'coding'
                      ? 'flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }
                >
                  Kodning
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {sizeLabel && sizePercent !== null && (
          <div className="hidden flex-col items-end gap-1 text-xs text-slate-600 dark:text-slate-300 lg:ml-auto lg:flex">
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-900">
              {projectSizeLabel ?? 'Lagring'}: {sizeLabel} ({sizePercent.toFixed(0)}%)
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${sizeTone}`}
                style={{ width: `${sizePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/40"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[min(92vw,380px)] border-r border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Menu</p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <MenuBar
              variant="drawer"
              onOpenProject={() => {
                setMobileMenuOpen(false)
                onOpenProject()
              }}
              onNewProject={() => {
                setMobileMenuOpen(false)
                onNewProject()
              }}
              onCloseProject={() => {
                setMobileMenuOpen(false)
                onCloseProject()
              }}
              canCloseProject={canCloseProject}
              onExportExcel={() => {
                setMobileMenuOpen(false)
                onExportExcel()
              }}
              onExportWord={() => {
                setMobileMenuOpen(false)
                onExportWord()
              }}
              onAddDocument={() => {
                setMobileMenuOpen(false)
                onAddDocument()
              }}
              onDeleteDocument={() => {
                setMobileMenuOpen(false)
                onDeleteDocument()
              }}
              canDeleteDocument={canDeleteDocument}
              deleteDocumentLabel={deleteDocumentLabel}
              onRenameUser={() => {
                setMobileMenuOpen(false)
                onRenameUser()
              }}
              onUndo={() => {
                setMobileMenuOpen(false)
                onUndo()
              }}
              onRedo={() => {
                setMobileMenuOpen(false)
                onRedo()
              }}
              onCut={() => {
                setMobileMenuOpen(false)
                onCut()
              }}
              onCopy={() => {
                setMobileMenuOpen(false)
                onCopy()
              }}
              onPaste={() => {
                setMobileMenuOpen(false)
                onPaste()
              }}
              onSelectAll={() => {
                setMobileMenuOpen(false)
                onSelectAll()
              }}
              onToggleCodeLabels={() => {
                setMobileMenuOpen(false)
                onToggleCodeLabels()
              }}
              showCodeLabels={showCodeLabels}
              onToggleMemos={() => {
                setMobileMenuOpen(false)
                onToggleMemos()
              }}
              showMemos={showMemos}
              onTour={() => {
                setMobileMenuOpen(false)
                onTour()
              }}
              isAdmin={isAdmin}
              onAdminLogin={() => {
                setMobileMenuOpen(false)
                onAdminLogin()
              }}
              onAdminLogout={() => {
                setMobileMenuOpen(false)
                onAdminLogout()
              }}
            />
          </div>
        </div>
      ) : null}
    </header>
  )
}
