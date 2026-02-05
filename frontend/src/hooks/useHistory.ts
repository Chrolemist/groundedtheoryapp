import { useRef } from 'react'

type UseHistoryArgs<TSnapshot> = {
  createSnapshot: () => TSnapshot
  restoreSnapshot: (snapshot: TSnapshot) => void
  isSameSnapshot: (a: TSnapshot, b: TSnapshot) => boolean
  executeEditorCommand: (command: string) => boolean
  maxHistory?: number
}

// Undo/redo stack that falls back to editor commands if active.
export function useHistory<TSnapshot>({
  createSnapshot,
  restoreSnapshot,
  isSameSnapshot,
  executeEditorCommand,
  maxHistory = 60,
}: UseHistoryArgs<TSnapshot>) {
  const historyRef = useRef<{ past: TSnapshot[]; future: TSnapshot[] }>({
    past: [],
    future: [],
  })

  const pushHistory = () => {
    const snapshot = createSnapshot()
    const past = historyRef.current.past
    const last = past[past.length - 1]
    if (last && isSameSnapshot(last, snapshot)) return
    historyRef.current.past = [...past, snapshot].slice(-maxHistory)
    historyRef.current.future = []
  }

  const handleUndo = () => {
    if (executeEditorCommand('undo')) return
    const history = historyRef.current
    if (!history.past.length) return
    const current = createSnapshot()
    const previous = history.past[history.past.length - 1]
    history.past = history.past.slice(0, -1)
    history.future = [current, ...history.future]
    restoreSnapshot(previous)
  }

  const handleRedo = () => {
    if (executeEditorCommand('redo')) return
    const history = historyRef.current
    if (!history.future.length) return
    const current = createSnapshot()
    const next = history.future[0]
    history.future = history.future.slice(1)
    history.past = [...history.past, current]
    restoreSnapshot(next)
  }

  return {
    pushHistory,
    handleUndo,
    handleRedo,
  }
}
