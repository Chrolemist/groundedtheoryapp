import { useCallback } from 'react'
import * as Y from 'yjs'

type UseYjsMapTextArgs = {
  ydoc: Y.Doc | null
  mapName: string
  itemId: string
  field: string
  onLocalUpdate: (value: string) => void
}

export function useYjsMapText({
  ydoc,
  mapName,
  itemId,
  field,
  onLocalUpdate,
}: UseYjsMapTextArgs) {
  return useCallback(
    (value: string) => {
      onLocalUpdate(value)
      if (!ydoc) return
      try {
        const map = ydoc.getMap<Y.Map<Y.Text>>(mapName)
        let item = map.get(itemId)
        if (!item) {
          item = new Y.Map<Y.Text>()
          map.set(itemId, item)
        }
        const existing = item.get(field)
        // ensureScalar in useYjsSync may have stored a plain string instead of
        // a Y.Text.  In that case fall back to a plain-string overwrite so the
        // React→Yjs sync effect picks up the correct value on its next run.
        if (existing instanceof Y.Text) {
          if (existing.toString() !== value) {
            existing.delete(0, existing.length)
            existing.insert(0, value)
          }
        } else {
          // Overwrite with a plain string (matches ensureScalar convention)
          const currentStr =
            typeof existing === 'string' ? existing : existing ? String(existing) : ''
          if (currentStr !== value) {
            item.set(field, value as unknown as Y.Text)
          }
        }
      } catch {
        // Yjs write failed; the sync effect will reconcile on its next run.
      }
    },
    [field, itemId, mapName, onLocalUpdate, ydoc],
  )
}
