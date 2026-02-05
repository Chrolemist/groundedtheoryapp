import { useEffect } from 'react'

type UseUndoRedoShortcutsArgs = {
  onUndo: () => void
  onRedo: () => void
}

// Global keyboard shortcuts for undo/redo when not focused in inputs.
export function useUndoRedoShortcuts({ onUndo, onRedo }: UseUndoRedoShortcutsArgs) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return

      const activeElement = document.activeElement as HTMLElement | null
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return
      }

      event.preventDefault()

      if (key === 'z' && event.shiftKey) {
        onRedo()
        return
      }

      if (key === 'z') {
        onUndo()
        return
      }

      if (key === 'y') {
        onRedo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onUndo, onRedo])
}
