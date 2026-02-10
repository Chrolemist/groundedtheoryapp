import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'

type ProjectSummary = {
  id: string
  name: string
  updated_at?: string | null
  created_at?: string | null
}

type ProjectPickerModalProps = {
  open: boolean
  projects: ProjectSummary[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null
  canDeleteProjects: boolean
  onClose: () => void
  onRefresh: () => void
  onSelect: (projectId: string) => void
  onCreate: (name: string) => void
  onDuplicate: (projectId: string) => void
  onDelete: (projectId: string) => void
  onPurge: () => void
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProjectPickerModal({
  open,
  projects,
  activeProjectId,
  isLoading,
  error,
  canDeleteProjects,
  onClose,
  onRefresh,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onPurge,
}: ProjectPickerModalProps) {
  const [name, setName] = useState('')
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aTime = a.updated_at ? Date.parse(a.updated_at) : 0
      const bTime = b.updated_at ? Date.parse(b.updated_at) : 0
      return bTime - aTime
    })
  }, [projects])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 px-4 py-6">
      <div className="mx-auto flex w-full max-w-xl min-h-[420px] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projects</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pick a project to load or create a new one.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New project name"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = name.trim()
              if (!trimmed) return
              onCreate(trimmed)
              setName('')
            }}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Create
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{isLoading ? 'Loading...' : `${sortedProjects.length} projects`}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
            >
              Refresh
            </button>
            {canDeleteProjects ? (
              <button
                type="button"
                onClick={onPurge}
                className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600"
              >
                Delete all
              </button>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {sortedProjects.map((project) => (
            <div
              key={project.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                project.id === activeProjectId
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(project.id)}
                className="flex flex-1 items-center justify-between gap-4 text-left"
              >
                <span className="font-semibold">{project.name || 'Untitled project'}</span>
                <span
                  className={cn(
                    'text-xs',
                    project.id === activeProjectId ? 'text-white/70' : 'text-slate-400',
                  )}
                >
                  {formatTimestamp(project.updated_at || project.created_at)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(project.id)}
                className={cn(
                  'rounded-lg border px-2 py-1 text-xs font-semibold transition',
                  project.id === activeProjectId
                    ? 'border-white/30 text-white hover:bg-white/10'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800',
                )}
              >
                Duplicera
              </button>
              {canDeleteProjects ? (
                <button
                  type="button"
                  onClick={() => onDelete(project.id)}
                  className={cn(
                    'rounded-lg border px-2 py-1 text-xs font-semibold transition',
                    project.id === activeProjectId
                      ? 'border-white/30 text-white hover:bg-white/10'
                      : 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30',
                  )}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))}
          {!sortedProjects.length && !isLoading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              No projects yet. Create your first one.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
