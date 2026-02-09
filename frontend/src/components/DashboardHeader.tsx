import { MenuBar } from './MenuBar'
import { type PresenceUser } from './DashboardLayout.types'
import { cn } from '../lib/cn'

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
}: DashboardHeaderProps) {
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              GT
            </div>
            <div>
              <p className="text-lg font-semibold">Grounded Theory</p>
              {activeProjectName ? (
                <p className="text-xs font-medium text-slate-500">{activeProjectName}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    websocketOnline ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span>{websocketOnline ? 'Online' : 'Offline'} WebSocket</span>
                <span className="mx-1 text-slate-300">•</span>
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
                  <span className="min-w-[120px] tabular-nums">{saveLabel}</span>
                  {saveWarning && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                      {saveWarning}
                    </span>
                  )}
              </div>
            </div>
          </div>
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
          {onManualSave ? (
            <button
              type="button"
              onClick={onManualSave}
              disabled={!canManualSave || isSaving}
              className={cn(
                'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition',
                !canManualSave || isSaving
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-50',
              )}
            >
              Save
            </button>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {presenceUsers.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="font-semibold text-slate-600">
                  {user.name}
                  {localUser?.id === user.id ? ' (you)' : ''}
                </span>
              </span>
            ))}
            {!presenceUsers.length && (
              <span className="text-xs text-slate-400">No collaborators yet</span>
            )}
          </div>
        </div>
        {sizeLabel && sizePercent !== null && (
          <div className="flex flex-col items-end gap-1 text-xs text-slate-600 lg:ml-auto">
            <span className="rounded-full bg-slate-100 px-2 py-1">
              {projectSizeLabel ?? 'Lagring'}: {sizeLabel} ({sizePercent.toFixed(0)}%)
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${sizeTone}`}
                style={{ width: `${sizePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
