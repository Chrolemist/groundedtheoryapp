import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import * as Y from 'yjs'
import { type Category, type Code, type Memo } from '../types'
import { useProjectWebSocket } from './useProjectWebSocket'

type UseYjsSyncArgs = {
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  theoryHtml: string
  coreCategoryId: string
  setCodes: Dispatch<SetStateAction<Code[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  setMemos: Dispatch<SetStateAction<Memo[]>>
  setTheoryHtml: Dispatch<SetStateAction<string>>
  setCoreCategoryId: Dispatch<SetStateAction<string>>
  isApplyingRemoteRef: MutableRefObject<boolean>
}

type CodeMapValue = Y.Text
type CategoryMapValue = Y.Text | Y.Array<string>
type MemoMapValue = Y.Text

const LOCAL_ORIGIN = 'local-yjs'
const REMOTE_ORIGIN = 'remote-yjs'

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const isEditingElement = (element: Element | null) => {
  if (!element) return false
  if (element instanceof HTMLElement) {
    if (element.isContentEditable) return true
    const tag = element.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  }
  return false
}

const normalizeOrder = (order: string[], ids: string[]) => {
  const seen = new Set<string>()
  const normalized: string[] = []
  order.forEach((id) => {
    if (!ids.includes(id) || seen.has(id)) return
    seen.add(id)
    normalized.push(id)
  })
  ids.forEach((id) => {
    if (seen.has(id)) return
    seen.add(id)
    normalized.push(id)
  })
  return normalized
}

export function useYjsSync({
  codes,
  categories,
  memos,
  theoryHtml,
  coreCategoryId,
  setCodes,
  setCategories,
  setMemos,
  setTheoryHtml,
  setCoreCategoryId,
  isApplyingRemoteRef,
}: UseYjsSyncArgs) {
  const [ydoc] = useState(() => new Y.Doc())
  const codesMapRef = useRef<Y.Map<Y.Map<CodeMapValue>> | null>(null)
  const codesOrderRef = useRef<Y.Array<string> | null>(null)
  const categoriesMapRef = useRef<Y.Map<Y.Map<CategoryMapValue>> | null>(null)
  const categoriesOrderRef = useRef<Y.Array<string> | null>(null)
  const memosMapRef = useRef<Y.Map<Y.Map<MemoMapValue>> | null>(null)
  const memosOrderRef = useRef<Y.Array<string> | null>(null)
  const theoryTextRef = useRef<Y.Text | null>(null)
  const coreCategoryTextRef = useRef<Y.Text | null>(null)
  const pendingRefreshRef = useRef(false)
  const didHydrateRef = useRef(false)

  const { sendJson } = useProjectWebSocket({
    onMessage: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as Record<string, unknown>
      if (!ydoc) return
      if (data.type === 'yjs:sync') {
        const updates = Array.isArray(data.updates) ? data.updates : []
        updates.forEach((update) => {
          if (typeof update !== 'string') return
          const decoded = fromBase64(update)
          Y.applyUpdate(ydoc, decoded, REMOTE_ORIGIN)
        })
        return
      }
      if (data.type !== 'yjs:update') return
      const update = typeof data.update === 'string' ? data.update : null
      if (!update) return
      const decoded = fromBase64(update)
      Y.applyUpdate(ydoc, decoded, REMOTE_ORIGIN)
    },
  })

  const readCodesFromYjs = useCallback((current: Code[]) => {
    const codesMap = codesMapRef.current
    const order = codesOrderRef.current
    if (!codesMap) return current
    const ids = Array.from(codesMap.keys())
    if (!ids.length) return current
    const orderedIds = normalizeOrder(order?.toArray() ?? [], ids)
    const currentById = new Map(current.map((code) => [code.id, code]))
    return orderedIds.map((id) => {
      const map = codesMap.get(id)
      const fallback = currentById.get(id)
      return {
        id,
        label: (map?.get('label') as Y.Text | undefined)?.toString() ?? fallback?.label ?? 'Untitled',
        description:
          (map?.get('description') as Y.Text | undefined)?.toString() ??
          fallback?.description ??
          '',
        colorClass:
          (map?.get('colorClass') as Y.Text | undefined)?.toString() ??
          fallback?.colorClass ??
          'bg-slate-100 text-slate-700 ring-slate-200',
        colorHex:
          (map?.get('colorHex') as Y.Text | undefined)?.toString() ??
          fallback?.colorHex ??
          '#E2E8F0',
        textHex:
          (map?.get('textHex') as Y.Text | undefined)?.toString() ??
          fallback?.textHex ??
          '#334155',
        ringHex:
          (map?.get('ringHex') as Y.Text | undefined)?.toString() ??
          fallback?.ringHex ??
          'rgba(148,163,184,0.4)',
      }
    })
  }, [])

  const readCategoriesFromYjs = useCallback((current: Category[]) => {
    const categoriesMap = categoriesMapRef.current
    const order = categoriesOrderRef.current
    if (!categoriesMap) return current
    const ids = Array.from(categoriesMap.keys())
    if (!ids.length) return current
    const orderedIds = normalizeOrder(order?.toArray() ?? [], ids)
    const currentById = new Map(current.map((category) => [category.id, category]))
    return orderedIds.map((id) => {
      const map = categoriesMap.get(id)
      const fallback = currentById.get(id)
      const codeIds = (map?.get('codeIds') as Y.Array<string> | undefined)?.toArray()
      return {
        id,
        name: (map?.get('name') as Y.Text | undefined)?.toString() ?? fallback?.name ?? '',
        codeIds: codeIds ?? fallback?.codeIds ?? [],
        precondition:
          (map?.get('precondition') as Y.Text | undefined)?.toString() ??
          fallback?.precondition ??
          '',
        action: (map?.get('action') as Y.Text | undefined)?.toString() ?? fallback?.action ?? '',
        consequence:
          (map?.get('consequence') as Y.Text | undefined)?.toString() ??
          fallback?.consequence ??
          '',
      }
    })
  }, [])

  const readMemosFromYjs = useCallback((current: Memo[]) => {
    const memosMap = memosMapRef.current
    const order = memosOrderRef.current
    if (!memosMap) return current
    const ids = Array.from(memosMap.keys())
    if (!ids.length) return current
    const orderedIds = normalizeOrder(order?.toArray() ?? [], ids)
    const currentById = new Map(current.map((memo) => [memo.id, memo]))
    return orderedIds.map((id) => {
      const map = memosMap.get(id)
      const fallback = currentById.get(id)
      const typeValue = (map?.get('type') as Y.Text | undefined)?.toString()
      const type: Memo['type'] =
        typeValue === 'code' || typeValue === 'category' || typeValue === 'global'
          ? typeValue
          : fallback?.type ?? 'global'
      return {
        id,
        type,
        refId: (map?.get('refId') as Y.Text | undefined)?.toString() ?? fallback?.refId,
        title: (map?.get('title') as Y.Text | undefined)?.toString() ?? fallback?.title ?? 'Untitled memo',
        body: (map?.get('body') as Y.Text | undefined)?.toString() ?? fallback?.body ?? '',
        createdAt:
          (map?.get('createdAt') as Y.Text | undefined)?.toString() ??
          fallback?.createdAt ??
          new Date().toISOString(),
        updatedAt:
          (map?.get('updatedAt') as Y.Text | undefined)?.toString() ??
          fallback?.updatedAt ??
          new Date().toISOString(),
      }
    })
  }, [])

  const refreshFromYjs = useCallback(() => {
    const categoriesMap = categoriesMapRef.current
    const codesMap = codesMapRef.current
    const memosMap = memosMapRef.current
    const theoryText = theoryTextRef.current
    const coreCategoryText = coreCategoryTextRef.current
    if (!categoriesMap || !codesMap || !memosMap || !theoryText || !coreCategoryText) return
    isApplyingRemoteRef.current = true
    setCodes((current) => {
      const next = readCodesFromYjs(current)
      if (next.length === current.length) {
        let changed = false
        for (let i = 0; i < next.length; i += 1) {
          const a = next[i]
          const b = current[i]
          if (
            a.id !== b.id ||
            a.label !== b.label ||
            a.description !== b.description ||
            a.colorClass !== b.colorClass ||
            a.colorHex !== b.colorHex ||
            a.textHex !== b.textHex ||
            a.ringHex !== b.ringHex
          ) {
            changed = true
            break
          }
        }
        if (!changed) return current
      }
      return next
    })
    setCategories((current) => {
      const next = readCategoriesFromYjs(current)
      if (next.length === current.length) {
        let changed = false
        for (let i = 0; i < next.length; i += 1) {
          const a = next[i]
          const b = current[i]
          if (
            a.id !== b.id ||
            a.name !== b.name ||
            a.precondition !== b.precondition ||
            a.action !== b.action ||
            a.consequence !== b.consequence ||
            a.codeIds.length !== b.codeIds.length
          ) {
            changed = true
            break
          }
          for (let j = 0; j < a.codeIds.length; j += 1) {
            if (a.codeIds[j] !== b.codeIds[j]) {
              changed = true
              break
            }
          }
          if (changed) break
        }
        if (!changed) return current
      }
      return next
    })
    setMemos((current) => {
      const next = readMemosFromYjs(current)
      if (next.length === current.length) {
        let changed = false
        for (let i = 0; i < next.length; i += 1) {
          const a = next[i]
          const b = current[i]
          if (
            a.id !== b.id ||
            a.type !== b.type ||
            a.refId !== b.refId ||
            a.title !== b.title ||
            a.body !== b.body ||
            a.createdAt !== b.createdAt ||
            a.updatedAt !== b.updatedAt
          ) {
            changed = true
            break
          }
        }
        if (!changed) return current
      }
      return next
    })
    const nextTheory = theoryText.toString()
    const nextCoreId = coreCategoryText.toString()
    if (nextTheory !== theoryHtml) setTheoryHtml(nextTheory)
    if (nextCoreId !== coreCategoryId) setCoreCategoryId(nextCoreId)
    setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 0)
  }, [
    coreCategoryId,
    isApplyingRemoteRef,
    readCategoriesFromYjs,
    readCodesFromYjs,
    readMemosFromYjs,
    setCodes,
    setCategories,
    setCoreCategoryId,
    setMemos,
    setTheoryHtml,
    theoryHtml,
  ])

  useEffect(() => {
    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!pendingRefreshRef.current) return
        if (isEditingElement(document.activeElement)) return
        pendingRefreshRef.current = false
        refreshFromYjs()
      }, 0)
    }
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [refreshFromYjs])

  useEffect(() => {
    codesMapRef.current = ydoc.getMap<Y.Map<CodeMapValue>>('codes')
    codesOrderRef.current = ydoc.getArray<string>('codesOrder')
    categoriesMapRef.current = ydoc.getMap<Y.Map<CategoryMapValue>>('categories')
    categoriesOrderRef.current = ydoc.getArray<string>('categoriesOrder')
    memosMapRef.current = ydoc.getMap<Y.Map<MemoMapValue>>('memos')
    memosOrderRef.current = ydoc.getArray<string>('memosOrder')
    theoryTextRef.current = ydoc.getText('theoryHtml')
    coreCategoryTextRef.current = ydoc.getText('coreCategoryId')

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) {
        if (isEditingElement(document.activeElement)) {
          pendingRefreshRef.current = true
          return
        }
        refreshFromYjs()
        return
      }
      sendJson?.({ type: 'yjs:update', update: toBase64(update) })
    })
  }, [refreshFromYjs, sendJson, ydoc])

  // Single effect: ensure every React category is represented in the Yjs map
  // and that mutable Yjs values match React state.
  useEffect(() => {
    const codesMap = codesMapRef.current
    const codesOrder = codesOrderRef.current
    const categoriesMap = categoriesMapRef.current
    const categoriesOrder = categoriesOrderRef.current
    const memosMap = memosMapRef.current
    const memosOrder = memosOrderRef.current
    if (!ydoc || !codesMap || !codesOrder || !categoriesMap || !categoriesOrder || !memosMap || !memosOrder) return
    // Skip syncing React→Yjs when we're applying a remote change to avoid loops
    if (isApplyingRemoteRef.current) return

    const hasRemoteData =
      codesMap.size > 0 ||
      categoriesMap.size > 0 ||
      memosMap.size > 0 ||
      (theoryTextRef.current?.length ?? 0) > 0 ||
      (coreCategoryTextRef.current?.length ?? 0) > 0

    if (!didHydrateRef.current && hasRemoteData) {
      didHydrateRef.current = true
      refreshFromYjs()
      return
    }

    if (!didHydrateRef.current) didHydrateRef.current = true

    ydoc.transact(() => {
      const syncOrder = (orderArray: Y.Array<string>, ids: string[]) => {
        const nextOrder = normalizeOrder(orderArray.toArray(), ids)
        const currentOrder = orderArray.toArray()
        if (nextOrder.length !== currentOrder.length) {
          orderArray.delete(0, orderArray.length)
          orderArray.insert(0, nextOrder)
          return
        }
        for (let i = 0; i < nextOrder.length; i += 1) {
          if (nextOrder[i] !== currentOrder[i]) {
            orderArray.delete(0, orderArray.length)
            orderArray.insert(0, nextOrder)
            return
          }
        }
      }

      const ensureText = (map: Y.Map<Y.Text>, key: string, value: string) => {
        const text = map.get(key)
        if (!text) {
          const next = new Y.Text()
          next.insert(0, value)
          map.set(key, next)
          return
        }
        if (text.toString() !== value) {
          text.delete(0, text.length)
          text.insert(0, value)
        }
      }

      const ensureCategoryText = (map: Y.Map<CategoryMapValue>, key: string, value: string) => {
        const text = map.get(key) as Y.Text | undefined
        if (!text) {
          const next = new Y.Text()
          next.insert(0, value)
          map.set(key, next)
          return
        }
        if (text.toString() !== value) {
          text.delete(0, text.length)
          text.insert(0, value)
        }
      }

      const ensureArray = (map: Y.Map<CategoryMapValue>, key: string, value: string[]) => {
        const array = map.get(key) as Y.Array<string> | undefined
        if (!array) {
          const next = new Y.Array<string>()
          next.insert(0, value)
          map.set(key, next)
          return
        }
        const current = array.toArray()
        if (current.length !== value.length) {
          array.delete(0, array.length)
          array.insert(0, value)
          return
        }
        for (let i = 0; i < value.length; i += 1) {
          if (current[i] !== value[i]) {
            array.delete(0, array.length)
            array.insert(0, value)
            return
          }
        }
      }

      const codeIds = codes.map((code) => code.id)
      syncOrder(codesOrder, codeIds)
      codes.forEach((code) => {
        let map = codesMap.get(code.id)
        if (!map) {
          map = new Y.Map<CodeMapValue>()
          codesMap.set(code.id, map)
        }
        ensureText(map as Y.Map<Y.Text>, 'label', code.label)
        ensureText(map as Y.Map<Y.Text>, 'description', code.description ?? '')
        ensureText(map as Y.Map<Y.Text>, 'colorClass', code.colorClass ?? '')
        ensureText(map as Y.Map<Y.Text>, 'colorHex', code.colorHex ?? '')
        ensureText(map as Y.Map<Y.Text>, 'textHex', code.textHex ?? '')
        ensureText(map as Y.Map<Y.Text>, 'ringHex', code.ringHex ?? '')
      })
      Array.from(codesMap.keys()).forEach((id) => {
        if (codeIds.includes(id)) return
        codesMap.delete(id)
      })

      const categoryIds = categories.map((category) => category.id)
      syncOrder(categoriesOrder, categoryIds)
      categories.forEach((category) => {
        let map = categoriesMap.get(category.id)
        if (!map) {
          map = new Y.Map<CategoryMapValue>()
          categoriesMap.set(category.id, map)
        }
        ensureCategoryText(map, 'name', category.name)
        ensureCategoryText(map, 'precondition', category.precondition)
        ensureCategoryText(map, 'action', category.action)
        ensureCategoryText(map, 'consequence', category.consequence)
        ensureArray(map, 'codeIds', category.codeIds)
      })
      Array.from(categoriesMap.keys()).forEach((id) => {
        if (categoryIds.includes(id)) return
        categoriesMap.delete(id)
      })

      const memoIds = memos.map((memo) => memo.id)
      syncOrder(memosOrder, memoIds)
      memos.forEach((memo) => {
        let map = memosMap.get(memo.id)
        if (!map) {
          map = new Y.Map<MemoMapValue>()
          memosMap.set(memo.id, map)
        }
        ensureText(map as Y.Map<Y.Text>, 'type', memo.type ?? 'global')
        ensureText(map as Y.Map<Y.Text>, 'refId', memo.refId ?? '')
        ensureText(map as Y.Map<Y.Text>, 'title', memo.title ?? '')
        ensureText(map as Y.Map<Y.Text>, 'body', memo.body ?? '')
        ensureText(map as Y.Map<Y.Text>, 'createdAt', memo.createdAt ?? '')
        ensureText(map as Y.Map<Y.Text>, 'updatedAt', memo.updatedAt ?? '')
      })
      Array.from(memosMap.keys()).forEach((id) => {
        if (memoIds.includes(id)) return
        memosMap.delete(id)
      })
    }, LOCAL_ORIGIN)
  }, [
    codes,
    categories,
    memos,
    isApplyingRemoteRef,
    refreshFromYjs,
    ydoc,
  ])

  useEffect(() => {
    const theoryText = theoryTextRef.current
    const coreCategoryText = coreCategoryTextRef.current
    if (!ydoc || !theoryText || !coreCategoryText) return
    if (isApplyingRemoteRef.current) return

    ydoc.transact(() => {
      if (theoryText.toString() !== theoryHtml) {
        theoryText.delete(0, theoryText.length)
        theoryText.insert(0, theoryHtml)
      }
      if (coreCategoryText.toString() !== coreCategoryId) {
        coreCategoryText.delete(0, coreCategoryText.length)
        coreCategoryText.insert(0, coreCategoryId)
      }
    }, LOCAL_ORIGIN)
  }, [theoryHtml, coreCategoryId, isApplyingRemoteRef, ydoc])

  return {
    ydoc,
  }
}
