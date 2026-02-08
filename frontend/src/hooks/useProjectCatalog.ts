import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

type ProjectSummary = {
  id: string
  name: string
  updated_at?: string | null
  created_at?: string | null
}

type UseProjectCatalogArgs = {
  apiBase: string
  adminToken?: string | null
  remoteLoadedRef: MutableRefObject<boolean>
  applyRemoteProject: (project: Record<string, unknown>) => void
  autoCreateIfEmpty?: boolean
  onActiveProjectChange?: (projectId: string, name: string) => void
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
  duplicateProject: (projectId: string, name?: string) => Promise<void>
  renameProject: (projectId: string, name: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<boolean>
  closeProject: () => void
  purgeProjects: () => Promise<number>
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
  adminToken,
  remoteLoadedRef,
  applyRemoteProject,
  autoCreateIfEmpty = false,
  onActiveProjectChange,
}: UseProjectCatalogArgs): UseProjectCatalogResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProjectName, setActiveProjectName] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [totalProjectBytes, setTotalProjectBytes] = useState<number | null>(null)
  const [totalProjectLimitBytes, setTotalProjectLimitBytes] = useState<number | null>(null)
  const didInitRef = useRef(false)
  const suppressAutoCreateRef = useRef(false)

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
      suppressAutoCreateRef.current = false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project'
      setProjectError(message)
    }
  }, [apiBase, applyRemoteProject, remoteLoadedRef, onActiveProjectChange])

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
        suppressAutoCreateRef.current = false
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
  }, [apiBase, applyRemoteProject, remoteLoadedRef, onActiveProjectChange, refreshStorage])

  const duplicateProject = useCallback(async (projectId: string, name?: string) => {
    if (!apiBase) return
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name?.trim() || undefined }),
      })
      if (!response.ok) {
        throw new Error(`Failed to duplicate project: ${response.status}`)
      }
      const data = (await response.json()) as {
        project_id?: string
        project_raw?: Record<string, unknown>
        name?: string
      }
      if (data.project_id) {
        setProjects((current) => [
          { id: data.project_id!, name: data.name ?? name ?? 'New project' },
          ...current,
        ])
        void refreshStorage()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate project'
      setProjectError(message)
    }
  }, [apiBase, refreshStorage])

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
    if (!adminToken) {
      setProjectError('Admin login required to delete projects')
      return false
    }
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`)
      }
      const wasActive = activeProjectId === projectId
      setProjects((current) => current.filter((project) => project.id !== projectId))
      if (wasActive) {
        setActiveProjectId(null)
        setActiveProjectName('')
        suppressAutoCreateRef.current = true
      }
      void refreshStorage()
      return wasActive
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project'
      setProjectError(message)
      return false
    }
  }, [activeProjectId, adminToken, apiBase, refreshStorage])

  const closeProject = useCallback(() => {
    setActiveProjectId(null)
    setActiveProjectName('')
    suppressAutoCreateRef.current = true
  }, [])

  const purgeProjects = useCallback(async () => {
    if (!apiBase) return 0
    if (!adminToken) {
      setProjectError('Admin login required to purge projects')
      return 0
    }
    setProjectError(null)
    try {
      const response = await fetch(`${apiBase}/projects/purge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!response.ok) {
        throw new Error(`Failed to purge projects: ${response.status}`)
      }
      const data = (await response.json()) as { deleted?: number }
      const deleted = typeof data.deleted === 'number' ? data.deleted : 0
      setProjects([])
      setActiveProjectId(null)
      setActiveProjectName('')
      suppressAutoCreateRef.current = true
      await refreshStorage()
      return deleted
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to purge projects'
      setProjectError(message)
      return 0
    }
  }, [adminToken, apiBase, refreshStorage])

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
    duplicateProject,
    renameProject,
    deleteProject,
    closeProject,
    purgeProjects,
  }
}
