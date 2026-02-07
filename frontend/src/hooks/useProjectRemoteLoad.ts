import { useEffect, type MutableRefObject } from 'react'

type UseProjectRemoteLoadArgs = {
  apiBase: string
  disableWs: boolean
  hasRemoteState: boolean
  remoteLoadedRef: MutableRefObject<boolean>
  applyRemoteProject: (project: Record<string, unknown>) => void
}

export function useProjectRemoteLoad({
  apiBase,
  disableWs,
  hasRemoteState,
  remoteLoadedRef,
  applyRemoteProject,
}: UseProjectRemoteLoadArgs) {
  useEffect(() => {
    if (disableWs) return
    if (!apiBase) return
    if (hasRemoteState) return
    if (remoteLoadedRef.current) return
    const controller = new AbortController()
    const loadRemote = async () => {
      try {
        const response = await fetch(`${apiBase}/project/state`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = (await response.json()) as {
          project_raw?: Record<string, unknown>
          project?: Record<string, unknown>
        }
        const projectRaw = data.project_raw ?? data.project
        if (projectRaw) {
          remoteLoadedRef.current = true
          applyRemoteProject(projectRaw)
        }
      } catch {
        return
      }
    }
    loadRemote()
    return () => {
      controller.abort()
    }
  }, [apiBase, disableWs, hasRemoteState, applyRemoteProject, remoteLoadedRef])
}
