import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/cn'

type MenuKey = 'file' | 'edit' | 'view' | 'help'

type MenuBarProps = {
  onOpenProject: () => void
  onNewProject: () => void
  onCloseProject: () => void
  canCloseProject: boolean
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

type MenuItemProps = {
  label: string
  onClick: () => void
  shortcut?: string
  destructive?: boolean
}

const MenuItem = ({ label, onClick, shortcut, destructive }: MenuItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
        destructive
          ? 'text-rose-600 hover:bg-rose-50'
          : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      <span>{label}</span>
      {shortcut ? <span className="text-xs text-slate-400">{shortcut}</span> : null}
    </button>
  )
}

export function MenuBar({
  onOpenProject,
  onNewProject,
  onCloseProject,
  canCloseProject,
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
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  const toggleMenu = (menu: MenuKey) => {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  const closeMenu = () => setOpenMenu(null)

  return (
    <div ref={containerRef} className="flex items-center gap-2 text-sm">
      <div className="relative">
        <button
          type="button"
          id="file-menu"
          onClick={() => toggleMenu('file')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
            openMenu === 'file' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          File
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'file' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <MenuItem
              label="Open project"
              onClick={() => {
                onOpenProject()
                closeMenu()
              }}
            />
            <MenuItem
              label="New project"
              onClick={() => {
                onNewProject()
                closeMenu()
              }}
            />
            <MenuItem
              label="Close project"
              onClick={() => {
                if (!canCloseProject) return
                onCloseProject()
                closeMenu()
              }}
              destructive
            />
            <div className="my-2 border-t border-slate-100" />
            <MenuItem
              label="New document"
              onClick={() => {
                onAddDocument()
                closeMenu()
              }}
            />
            <MenuItem
              label="Delete document"
              onClick={() => {
                if (!canDeleteDocument) return
                if (
                  !window.confirm(
                    `Delete "${deleteDocumentLabel}"? This cannot be undone.`,
                  )
                )
                  return
                onDeleteDocument()
                closeMenu()
              }}
              destructive
            />
            <div className="my-2 border-t border-slate-100" />
            <MenuItem
              label="Export as Excel"
              onClick={() => {
                onExportExcel()
                closeMenu()
              }}
            />
            <MenuItem
              label="Export as Word"
              onClick={() => {
                onExportWord()
                closeMenu()
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('edit')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
            openMenu === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          Edit
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'edit' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <MenuItem
              label="Undo"
              shortcut="Ctrl+Z"
              onClick={() => {
                onUndo()
                closeMenu()
              }}
            />
            <MenuItem
              label="Redo"
              shortcut="Ctrl+Y"
              onClick={() => {
                onRedo()
                closeMenu()
              }}
            />
            <div className="my-2 border-t border-slate-100" />
            <MenuItem
              label="Cut"
              shortcut="Ctrl+X"
              onClick={() => {
                onCut()
                closeMenu()
              }}
            />
            <MenuItem
              label="Copy"
              shortcut="Ctrl+C"
              onClick={() => {
                onCopy()
                closeMenu()
              }}
            />
            <MenuItem
              label="Paste"
              shortcut="Ctrl+V"
              onClick={() => {
                onPaste()
                closeMenu()
              }}
            />
            <div className="my-2 border-t border-slate-100" />
            <MenuItem
              label="Select all"
              shortcut="Ctrl+A"
              onClick={() => {
                onSelectAll()
                closeMenu()
              }}
            />
            <div className="my-2 border-t border-slate-100" />
            <MenuItem
              label="Change my name"
              onClick={() => {
                onRenameUser()
                closeMenu()
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          id="view-menu"
          onClick={() => toggleMenu('view')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
            openMenu === 'view' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          View
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'view' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <MenuItem
              label={showCodeLabels ? 'Hide labels' : 'Show labels'}
              onClick={() => {
                onToggleCodeLabels()
                closeMenu()
              }}
            />
            <MenuItem
              label={showMemos ? 'Hide memos' : 'Show memos'}
              onClick={() => {
                onToggleMemos()
                closeMenu()
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu('help')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
            openMenu === 'help' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          Help
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'help' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <MenuItem
              label="Restart tour"
              onClick={() => {
                onTour()
                closeMenu()
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
