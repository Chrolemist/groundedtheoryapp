import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

type ProjectSummary = {
  id: string
  name: string
  updated_at?: string | null
  created_at?: string | null
}

type UseProjectCatalogArgs = {
  apiBase: string
  remoteLoadedRef: MutableRefObject<boolean>
  applyRemoteProject: (project: Record<string, unknown>) => void
  autoCreateIfEmpty?: boolean
  onActiveProjectChange?: (projectId: string, name: string) => void
  storageKey?: string
}

type UseProjectCatalogResult = {
  projects: ProjectSummary[]
  activeProjectId: string | null
  activeProjectName: string
  isLoadingProjects: boolean
  projectError: string | null
  totalProjectBytes: number | null
  totalProjectLimitBytes: number | null
  refreshStorage: () => Promise<void>
  refreshProjects: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  createProject: (name?: string) => Promise<void>
  renameProject: (projectId: string, name: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<boolean>
  closeProject: () => void
}

const defaultProjectPayload = () => ({
  documents: [],
  codes: [],
  categories: [],
  memos: [],
  coreCategoryId: '',
  theoryHtml: '',
})

export function useProjectCatalog({
  apiBase,
  remoteLoadedRef,
  applyRemoteProject,
  autoCreateIfEmpty = false,
  onActiveProjectChange,
  storageKey = 'gt-last-project-id',
}: UseProjectCatalogArgs): UseProjectCatalogResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectName, setActiveProjectName] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [totalProjectBytes, setTotalProjectBytes] = useState<number | null>(null)
  const [totalProjectLimitBytes, setTotalProjectLimitBytes] = useState<number | null>(null)
  const didInitRef = useRef(false)
  const suppressAutoLoadRef = useRef(false)
  const suppressAutoCreateRef = useRef(false)
  const autoLoadAttemptRef = useRef<string | null>(null)

  const refreshProjects = useCallback(async () => {
    if (!apiBase) return
    setIsLoadingProjects(true)
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects`)
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.status}`)
      }
      const data = (await response.json()) as { projects?: ProjectSummary[] }
      const nextProjects = Array.isArray(data.projects) ? data.projects : []
      setProjects(nextProjects)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects'
      setProjectError(message)
    } finally {
      setIsLoadingProjects(false)
    }
  }, [apiBase])

  const refreshStorage = useCallback(async () => {
    if (!apiBase) return
    try {
      const response = await fetch(`${apiBase}/projects/storage`)
      if (!response.ok) {
        throw new Error(`Failed to load storage: ${response.status}`)
      }
      const data = (await response.json()) as {
        total_bytes?: number
        total_limit_bytes?: number
      }
      setTotalProjectBytes(typeof data.total_bytes === 'number' ? data.total_bytes : null)
      setTotalProjectLimitBytes(
        typeof data.total_limit_bytes === 'number' ? data.total_limit_bytes : null,
      )
    } catch {
      setTotalProjectBytes(null)
      setTotalProjectLimitBytes(null)
    }
  }, [apiBase])

  const loadProject = useCallback(async (projectId: string) => {
    if (!apiBase) return
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}`)
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.status}`)
      }
      const data = (await response.json()) as {
        project_raw?: Record<string, unknown>
        project?: Record<string, unknown>
        name?: string
      }
      const projectRaw = data.project_raw ?? data.project
      if (projectRaw) {
        remoteLoadedRef.current = true
        applyRemoteProject(projectRaw)
      }
      setActiveProjectId(projectId)
      const nextName = data.name ?? ''
      setActiveProjectName(nextName)
      onActiveProjectChange?.(projectId, nextName)
      autoLoadAttemptRef.current = null
      suppressAutoLoadRef.current = false
      suppressAutoCreateRef.current = false
      try {
        localStorage.setItem(storageKey, projectId)
      } catch {
        // Ignore storage failures.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project'
      setProjectError(message)
    }
  }, [apiBase, applyRemoteProject, remoteLoadedRef, onActiveProjectChange, storageKey])

  const createProject = useCallback(async (name?: string) => {
    if (!apiBase) return
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name?.trim() || 'New project', project_raw: defaultProjectPayload() }),
      })
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`)
      }
      const data = (await response.json()) as {
        project_id?: string
        project_raw?: Record<string, unknown>
        name?: string
      }
      if (data.project_id && data.project_raw) {
        remoteLoadedRef.current = true
        applyRemoteProject(data.project_raw)
        setActiveProjectId(data.project_id)
        const nextName = data.name ?? name ?? 'New project'
        setActiveProjectName(nextName)
        onActiveProjectChange?.(data.project_id, nextName)
        autoLoadAttemptRef.current = null
        suppressAutoLoadRef.current = false
        suppressAutoCreateRef.current = false
        try {
          localStorage.setItem(storageKey, data.project_id)
        } catch {
          // Ignore storage failures.
        }
        setProjects((current) => [
          { id: data.project_id!, name: data.name ?? name ?? 'New project' },
          ...current,
        ])
        void refreshStorage()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project'
      setProjectError(message)
    }
  }, [apiBase, applyRemoteProject, remoteLoadedRef, onActiveProjectChange, refreshStorage, storageKey])

  const renameProject = useCallback(async (projectId: string, name: string) => {
    if (!apiBase) return
    const trimmed = name.trim()
    if (!trimmed) return
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!response.ok) {
        throw new Error(`Failed to rename project: ${response.status}`)
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, name: trimmed } : project,
        ),
      )
      if (activeProjectId === projectId) {
        setActiveProjectName(trimmed)
        onActiveProjectChange?.(projectId, trimmed)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename project'
      setProjectError(message)
    }
  }, [activeProjectId, apiBase, onActiveProjectChange])

  const deleteProject = useCallback(async (projectId: string) => {
    if (!apiBase) return false
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`)
      }
      const wasActive = activeProjectId === projectId
      setProjects((current) => current.filter((project) => project.id !== projectId))
      if (wasActive) {
        setActiveProjectId(null)
        setActiveProjectName('')
        suppressAutoLoadRef.current = true
        suppressAutoCreateRef.current = true
      }
      try {
        const storedId = localStorage.getItem(storageKey)
        if (storedId === projectId) {
          localStorage.removeItem(storageKey)
        }
      } catch {
        // Ignore storage failures.
      }
      void refreshStorage()
      return wasActive
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project'
      setProjectError(message)
      return false
    }
  }, [activeProjectId, apiBase, refreshStorage, storageKey])

  const closeProject = useCallback(() => {
    setActiveProjectId(null)
    setActiveProjectName('')
    suppressAutoLoadRef.current = true
    suppressAutoCreateRef.current = true
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey])

  useEffect(() => {
    if (didInitRef.current) return
    if (!apiBase) return
    didInitRef.current = true
    refreshProjects()
  }, [apiBase, refreshProjects])

  useEffect(() => {
    if (!autoCreateIfEmpty) return
    if (!didInitRef.current) return
    if (suppressAutoCreateRef.current) return
    if (projects.length > 0) return
    if (activeProjectId) return
    void createProject('New project')
  }, [autoCreateIfEmpty, projects.length, activeProjectId, createProject])

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      if (suppressAutoLoadRef.current) return
      let fallbackId = projects[0].id
      try {
        const storedId = localStorage.getItem(storageKey)
        if (storedId && projects.some((project) => project.id === storedId)) {
          fallbackId = storedId
        }
      } catch {
        // Ignore storage failures.
      }
      if (autoLoadAttemptRef.current === fallbackId) return
      autoLoadAttemptRef.current = fallbackId
      void loadProject(fallbackId)
    }
  }, [activeProjectId, projects, loadProject, storageKey])

  return {
    projects,
    activeProjectId,
    activeProjectName,
    isLoadingProjects,
    projectError,
    totalProjectBytes,
    totalProjectLimitBytes,
    refreshStorage,
    refreshProjects,
    loadProject,
    createProject,
    renameProject,
    deleteProject,
    closeProject,
  }
}
