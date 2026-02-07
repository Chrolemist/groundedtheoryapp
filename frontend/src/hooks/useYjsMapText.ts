import { useCallback } from 'react'
import type * as Y from 'yjs'

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
      const map = ydoc.getMap<Y.Map<Y.Text>>(mapName)
      let item = map.get(itemId)
      if (!item) {
        item = new Y.Map<Y.Text>()
        map.set(itemId, item)
      }
      let text = item.get(field) as Y.Text | undefined
      if (!text) {
        text = new Y.Text()
        item.set(field, text)
      }
      if (text.toString() !== value) {
        text.delete(0, text.length)
        text.insert(0, value)
      }
    },
    [field, itemId, mapName, onLocalUpdate, ydoc],
  )
}
