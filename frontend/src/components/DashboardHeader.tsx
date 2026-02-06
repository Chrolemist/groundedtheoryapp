import { type MutableRefObject } from 'react'
import { MenuBar } from './MenuBar'
import { type PresenceUser } from './DashboardLayout.types'
import { cn } from '../lib/cn'

type DashboardHeaderProps = {
  websocketOnline: boolean
  presenceUsers: PresenceUser[]
  localUser: PresenceUser | null
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  onFileSelected: (file: File) => void
  onSaveProject: () => void
  onExportExcel: () => void
  onExportWord: () => void
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
}

// Top navigation with app actions and collaborator presence.
export function DashboardHeader({
  websocketOnline,
  presenceUsers,
  localUser,
  fileInputRef,
  onFileSelected,
  onSaveProject,
  onExportExcel,
  onExportWord,
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
}: DashboardHeaderProps) {
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
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    websocketOnline ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span>{websocketOnline ? 'Online' : 'Offline'} WebSocket</span>
              </div>
            </div>
          </div>
          <MenuBar
            onLoadProject={() => fileInputRef.current?.click()}
            onSaveProject={onSaveProject}
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
          />
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
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                onFileSelected(file)
              }
              event.target.value = ''
            }}
          />
        </div>
      </div>
    </header>
  )
}
