import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/cn'
import { toggleTheme } from '../lib/theme'

type MenuKey = 'file' | 'edit' | 'view' | 'help'

type MenuBarVariant = 'bar' | 'drawer'

type MenuBarProps = {
  variant?: MenuBarVariant
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
  isAdmin: boolean
  onAdminLogin: () => void
  onAdminLogout: () => void
}

type MenuItemProps = {
  label: string
  onClick: () => void
  shortcut?: string
  destructive?: boolean
  disabled?: boolean
}

const MenuItem = ({ label, onClick, shortcut, destructive, disabled }: MenuItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
        disabled
          ? 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent'
          : null,
        destructive
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
      )}
    >
      <span>{label}</span>
      {shortcut ? <span className="text-xs text-slate-400">{shortcut}</span> : null}
    </button>
  )
}

export function MenuBar({
  variant = 'bar',
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
  isAdmin,
  onAdminLogin,
  onAdminLogout,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [drawerMenu, setDrawerMenu] = useState<MenuKey>('file')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (variant !== 'bar') return

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
  }, [variant])

  const toggleMenu = (menu: MenuKey) => {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  const closeMenu = () => setOpenMenu(null)

  if (variant === 'drawer') {
    const sectionButton = (menu: MenuKey, label: string) => (
      <button
        key={menu}
        type="button"
        onClick={() => setDrawerMenu(menu)}
        className={cn(
          'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition',
          drawerMenu === menu
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        )}
      >
        {label}
      </button>
    )

    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1">
            {sectionButton('file', 'File')}
            {sectionButton('edit', 'Edit')}
            {sectionButton('view', 'View')}
            {sectionButton('help', 'Help')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          {drawerMenu === 'file' ? (
            <>
              <MenuItem label="Open project" onClick={onOpenProject} />
              <MenuItem label="New project" onClick={onNewProject} />
              <MenuItem
                label="Close project"
                onClick={() => {
                  if (!canCloseProject) return
                  onCloseProject()
                }}
                destructive
                disabled={!canCloseProject}
              />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem label="New document" onClick={onAddDocument} />
              <MenuItem
                label="Delete document"
                onClick={() => {
                  if (!canDeleteDocument) return
                  if (!window.confirm(`Delete "${deleteDocumentLabel}"? This cannot be undone.`))
                    return
                  onDeleteDocument()
                }}
                destructive
                disabled={!canDeleteDocument}
              />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem label="Export as Excel" onClick={onExportExcel} />
              <MenuItem label="Export as Word" onClick={onExportWord} />
            </>
          ) : drawerMenu === 'edit' ? (
            <>
              <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={onUndo} />
              <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={onRedo} />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem label="Cut" shortcut="Ctrl+X" onClick={onCut} />
              <MenuItem label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
              <MenuItem label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem label="Select all" shortcut="Ctrl+A" onClick={onSelectAll} />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem label="Change my name" onClick={onRenameUser} />
            </>
          ) : drawerMenu === 'view' ? (
            <>
              <MenuItem
                label={showCodeLabels ? 'Hide labels' : 'Show labels'}
                onClick={onToggleCodeLabels}
              />
              <MenuItem label={showMemos ? 'Hide memos' : 'Show memos'} onClick={onToggleMemos} />
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <MenuItem
                label="Toggle dark mode"
                onClick={() => {
                  toggleTheme()
                }}
              />
            </>
          ) : (
            <>
              <MenuItem label="Restart tour" onClick={onTour} />
              <MenuItem
                label={isAdmin ? 'Admin logout' : 'Admin login'}
                onClick={() => {
                  if (isAdmin) {
                    onAdminLogout()
                  } else {
                    onAdminLogin()
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 text-sm">
      <div className="relative">
        <button
          type="button"
          id="file-menu"
          onClick={() => toggleMenu('file')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
            openMenu === 'file'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
          )}
        >
          File
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'file' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
              disabled={!canCloseProject}
            />
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
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
              disabled={!canDeleteDocument}
            />
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
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
            openMenu === 'edit'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
          )}
        >
          Edit
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'edit' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
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
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
            <MenuItem
              label="Select all"
              shortcut="Ctrl+A"
              onClick={() => {
                onSelectAll()
                closeMenu()
              }}
            />
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
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
            openMenu === 'view'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
          )}
        >
          View
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'view' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
            <MenuItem
              label="Toggle dark mode"
              onClick={() => {
                toggleTheme()
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
            openMenu === 'help'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
          )}
        >
          Help
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {openMenu === 'help' ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <MenuItem
              label="Restart tour"
              onClick={() => {
                onTour()
                closeMenu()
              }}
            />
            <MenuItem
              label={isAdmin ? 'Admin logout' : 'Admin login'}
              onClick={() => {
                if (isAdmin) {
                  onAdminLogout()
                } else {
                  onAdminLogin()
                }
                closeMenu()
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
