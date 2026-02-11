import {
  useCallback,
  useEffect,
  useMemo,
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
  documents: { id: string; title: string; text: string; html: string }[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  theoryHtml: string
  coreCategoryId: string
  coreCategoryDraft: string
  projectId?: string | null
  setDocuments: Dispatch<SetStateAction<{ id: string; title: string; text: string; html: string }[]>>
  setCodes: Dispatch<SetStateAction<Code[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  setMemos: Dispatch<SetStateAction<Memo[]>>
  setTheoryHtml: Dispatch<SetStateAction<string>>
  setCoreCategoryId: Dispatch<SetStateAction<string>>
  setCoreCategoryDraft: Dispatch<SetStateAction<string>>
  isApplyingRemoteRef: MutableRefObject<boolean>
}

type ScalarValue = string | Y.Text
type DocumentMapValue = ScalarValue
type CodeMapValue = ScalarValue
type CategoryMapValue = ScalarValue | Y.Array<string>
type MemoMapValue = ScalarValue

const LOCAL_ORIGIN = 'local-yjs'
const REMOTE_ORIGIN = 'remote-yjs'
const BROADCAST_ORIGIN = 'broadcast-yjs'

const getTabId = () => {
  if (typeof window === 'undefined') return 'server'
  const tabIdKey = 'gt-tab-id'
  const stored = window.sessionStorage.getItem(tabIdKey)
  if (stored) return stored
  const next = crypto.randomUUID()
  window.sessionStorage.setItem(tabIdKey, next)
  return next
}

const toBase64 = (bytes: Uint8Array) => {
  // iOS Safari can throw when spreading large typed arrays into fromCharCode.
  // Use a safe incremental conversion instead.
  const parts: string[] = []
  const chunkSize = 2048
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    let chunk = ''
    for (let j = 0; j < slice.length; j += 1) {
      chunk += String.fromCharCode(slice[j])
    }
    parts.push(chunk)
  }
  return btoa(parts.join(''))
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
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (element.closest('.document-content')) return true
  if (element.closest('.ProseMirror')) return true
  if (element.closest('#theory-narrative')) return true
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

const isEffectivelyEmptyHtml = (value: string) => {
  const html = (value ?? '').trim()
  if (!html) return true
  const normalized = html.replace(/\s+/g, '').toLowerCase()
  return (
    normalized === '<p></p>' ||
    normalized === '<p><br></p>' ||
    normalized === '<p><br/></p>'
  )
}

const hasMeaningfulContent = (html: string, text: string) => {
  if ((text ?? '').trim().length > 0) return true
  const trimmedHtml = (html ?? '').trim()
  if (!trimmedHtml) return false
  return !isEffectivelyEmptyHtml(trimmedHtml)
}

const readScalarString = (value: unknown) => {
  if (!value) return ''
  if (value instanceof Y.Text) return value.toString()
  // Strings (and most primitives) safely stringify.
  try {
    return String(value)
  } catch {
    return ''
  }
}

export function useYjsSync({
  documents,
  codes,
  categories,
  memos,
  theoryHtml,
  coreCategoryId,
  coreCategoryDraft,
  projectId,
  setDocuments,
  setCodes,
  setCategories,
  setMemos,
  setTheoryHtml,
  setCoreCategoryId,
  setCoreCategoryDraft,
  isApplyingRemoteRef,
}: UseYjsSyncArgs) {
  const disableWsEnv = import.meta.env.VITE_DISABLE_WS === 'true'
  const disableWsDebug =
    typeof window !== 'undefined' && window.localStorage.getItem('gt-disable-ws') === 'true'
  const disableWs = disableWsEnv || disableWsDebug
  const debugEnabled =
    typeof window !== 'undefined' && window.localStorage.getItem('gt-debug') === 'true'
  const ydoc = useMemo(() => new Y.Doc(), [projectId])
  const [hasRemoteUpdates, setHasRemoteUpdates] = useState(false)
  const [hasReceivedSync, setHasReceivedSync] = useState(false)
  const documentsMapRef = useRef<Y.Map<Y.Map<DocumentMapValue>> | null>(null)
  const documentsOrderRef = useRef<Y.Array<string> | null>(null)
  const codesMapRef = useRef<Y.Map<Y.Map<CodeMapValue>> | null>(null)
  const codesOrderRef = useRef<Y.Array<string> | null>(null)
  const categoriesMapRef = useRef<Y.Map<Y.Map<CategoryMapValue>> | null>(null)
  const categoriesOrderRef = useRef<Y.Array<string> | null>(null)
  const memosMapRef = useRef<Y.Map<Y.Map<MemoMapValue>> | null>(null)
  const memosOrderRef = useRef<Y.Array<string> | null>(null)
  const theoryTextRef = useRef<Y.Text | null>(null)
  const coreCategoryTextRef = useRef<Y.Text | null>(null)
  const coreCategoryDraftTextRef = useRef<Y.Text | null>(null)
  const pendingRefreshRef = useRef(false)
  const didHydrateRef = useRef(false)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const leaderHeartbeatRef = useRef<number | null>(null)
  const leaderCheckRef = useRef<number | null>(null)
  const localLeaderSeedTimerRef = useRef<number | null>(null)
  const [isLocalLeader, setIsLocalLeader] = useState(false)
  const isLocalLeaderRef = useRef(false)

  useEffect(() => {
    didHydrateRef.current = false
    pendingRefreshRef.current = false
    documentsMapRef.current = null
    documentsOrderRef.current = null
    codesMapRef.current = null
    codesOrderRef.current = null
    categoriesMapRef.current = null
    categoriesOrderRef.current = null
    memosMapRef.current = null
    memosOrderRef.current = null
    theoryTextRef.current = null
    coreCategoryTextRef.current = null
    coreCategoryDraftTextRef.current = null
    queueMicrotask(() => {
      setHasRemoteUpdates(false)
      setHasReceivedSync(false)
      setIsLocalLeader(false)
    })
    isLocalLeaderRef.current = false

    return () => {
      try {
        ydoc.destroy()
      } catch {
        // ignore
      }
    }
  }, [ydoc])

  const { sendJson } = useProjectWebSocket({
    projectId,
    onMessage: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as Record<string, unknown>
      if (!ydoc) return

      const payloadProjectId = typeof data.project_id === 'string' ? data.project_id : null
      if (payloadProjectId && projectId && payloadProjectId !== projectId) {
        if (debugEnabled) {
          console.warn('[Yjs] ignore message for wrong project', {
            expected: projectId,
            got: payloadProjectId,
            type: data.type,
          })
        }
        return
      }
      if (data.type === 'yjs:sync') {
        const updates = Array.isArray(data.updates) ? data.updates : []
        updates.forEach((update) => {
          if (typeof update !== 'string') return
          const decoded = fromBase64(update)
          Y.applyUpdate(ydoc, decoded, REMOTE_ORIGIN)
        })
        // IMPORTANT: Mark sync as received only AFTER applying updates.
        // Otherwise downstream consumers can observe hasReceivedSync=true while the
        // shared Yjs fragments are still empty, leading to duplicate seeding.
        setHasReceivedSync(true)
        if (updates.length > 0) setHasRemoteUpdates(true)
        return
      }
      if (data.type !== 'yjs:update') return
      const update = typeof data.update === 'string' ? data.update : null
      if (!update) return
      const decoded = fromBase64(update)
      Y.applyUpdate(ydoc, decoded, REMOTE_ORIGIN)
      setHasRemoteUpdates(true)
    },
  })

  useEffect(() => {
    if (!disableWs) return undefined
    if (typeof window === 'undefined') return undefined
    if (!projectId) {
      queueMicrotask(() => setHasReceivedSync(false))
      return undefined
    }

    const tabId = getTabId()
    const leaderKey = `gt-yjs-leader:${projectId}`
    const STALE_AFTER_MS = 5500
    const HEARTBEAT_MS = 2000

    const readLeader = () => {
      try {
        const raw = window.localStorage.getItem(leaderKey)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { tabId?: string; updatedAt?: number }
        if (!parsed || typeof parsed.tabId !== 'string' || typeof parsed.updatedAt !== 'number') {
          return null
        }
        return { tabId: parsed.tabId, updatedAt: parsed.updatedAt }
      } catch {
        return null
      }
    }

    const writeLeader = () => {
      try {
        window.localStorage.setItem(
          leaderKey,
          JSON.stringify({ tabId, updatedAt: Date.now() }),
        )
      } catch {
        // Ignore storage failures.
      }
    }

    const ensureLeaderState = () => {
      const current = readLeader()
      const now = Date.now()
      const isStale = !current || now - current.updatedAt > STALE_AFTER_MS
      if (isStale) {
        writeLeader()
      }
      const after = readLeader()
      const amLeader = after?.tabId === tabId

      isLocalLeaderRef.current = amLeader
      setIsLocalLeader(amLeader)

      if (debugEnabled) {
        console.log('[Yjs][local] leader-check', {
          projectId,
          tabId,
          leader: after,
          amLeader,
        })
      }
      return amLeader
    }

    let amLeader = ensureLeaderState()

    if (leaderHeartbeatRef.current) {
      window.clearInterval(leaderHeartbeatRef.current)
      leaderHeartbeatRef.current = null
    }
    if (leaderCheckRef.current) {
      window.clearInterval(leaderCheckRef.current)
      leaderCheckRef.current = null
    }

    if (amLeader) {
      leaderHeartbeatRef.current = window.setInterval(() => {
        writeLeader()
      }, HEARTBEAT_MS)
    }

    // Periodically re-check in case leader disappears and we need to take over.
    leaderCheckRef.current = window.setInterval(() => {
      const nextLeader = ensureLeaderState()
      if (nextLeader && !amLeader) {
        amLeader = true
        if (!leaderHeartbeatRef.current) {
          leaderHeartbeatRef.current = window.setInterval(() => {
            writeLeader()
          }, HEARTBEAT_MS)
        }
      }
    }, HEARTBEAT_MS)

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== leaderKey) return
      // Leader may have changed; re-evaluate.
      ensureLeaderState()
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
      if (leaderHeartbeatRef.current) {
        window.clearInterval(leaderHeartbeatRef.current)
        leaderHeartbeatRef.current = null
      }
      if (leaderCheckRef.current) {
        window.clearInterval(leaderCheckRef.current)
        leaderCheckRef.current = null
      }
      if (localLeaderSeedTimerRef.current) {
        window.clearTimeout(localLeaderSeedTimerRef.current)
        localLeaderSeedTimerRef.current = null
      }
      // Note: don't remove the leader key here.
      // In React StrictMode (dev), effects mount/unmount twice and cleanup would temporarily
      // clear leadership, causing new tabs to seed and duplicate content. We rely on staleness instead.
    }
  }, [disableWs, projectId])

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
        label: readScalarString(map?.get('label')) || fallback?.label || 'Untitled',
        description:
          readScalarString(map?.get('description')) || fallback?.description || '',
        colorClass:
          readScalarString(map?.get('colorClass')) ||
          fallback?.colorClass ||
          'bg-slate-100 text-slate-700 ring-slate-200',
        colorHex:
          readScalarString(map?.get('colorHex')) || fallback?.colorHex || '#E2E8F0',
        textHex:
          readScalarString(map?.get('textHex')) || fallback?.textHex || '#334155',
        ringHex:
          readScalarString(map?.get('ringHex')) || fallback?.ringHex || 'rgba(148,163,184,0.4)',
      }
    })
  }, [])

  const readDocumentsFromYjs = useCallback(
    (current: { id: string; title: string; text: string; html: string }[]) => {
      const documentsMap = documentsMapRef.current
      const order = documentsOrderRef.current
      if (!documentsMap) return current
      const ids = Array.from(documentsMap.keys())
      if (!ids.length) return []
      const orderedIds = normalizeOrder(order?.toArray() ?? [], ids)
      const currentById = new Map(current.map((doc) => [doc.id, doc]))
      return orderedIds.map((id) => {
        const map = documentsMap.get(id)
        const fallback = currentById.get(id)
        const title = readScalarString(map?.get('title')) || fallback?.title || ''
        const mapHtml = readScalarString(map?.get('html'))
        const mapText = readScalarString(map?.get('text'))
        const fallbackHtml = fallback?.html ?? ''
        const fallbackText = fallback?.text ?? ''
        const mapHas = hasMeaningfulContent(mapHtml, mapText)
        const fallbackHas = hasMeaningfulContent(fallbackHtml, fallbackText)

        const html = mapHas || !fallbackHas ? mapHtml : fallbackHtml
        const text = mapHas || !fallbackHas ? mapText : fallbackText
        return {
          id,
          title,
          text,
          html,
        }
      })
    },
    [],
  )

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
        name: readScalarString(map?.get('name')) || fallback?.name || '',
        codeIds: codeIds ?? fallback?.codeIds ?? [],
        precondition:
          readScalarString(map?.get('precondition')) || fallback?.precondition || '',
        action: readScalarString(map?.get('action')) || fallback?.action || '',
        consequence:
          readScalarString(map?.get('consequence')) || fallback?.consequence || '',
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
      const typeValue = readScalarString(map?.get('type'))
      const type: Memo['type'] =
        typeValue === 'code' || typeValue === 'category' || typeValue === 'global'
          ? typeValue
          : fallback?.type ?? 'global'
      return {
        id,
        type,
        refId: readScalarString(map?.get('refId')) || fallback?.refId,
        title: readScalarString(map?.get('title')) || fallback?.title || 'Untitled memo',
        body: readScalarString(map?.get('body')) || fallback?.body || '',
        createdAt:
          readScalarString(map?.get('createdAt')) || fallback?.createdAt || new Date().toISOString(),
        updatedAt:
          readScalarString(map?.get('updatedAt')) || fallback?.updatedAt || new Date().toISOString(),
      }
    })
  }, [])

  const refreshFromYjs = useCallback(() => {
    const documentsMap = documentsMapRef.current
    const categoriesMap = categoriesMapRef.current
    const codesMap = codesMapRef.current
    const memosMap = memosMapRef.current
    const theoryText = theoryTextRef.current
    const coreCategoryText = coreCategoryTextRef.current
    const coreCategoryDraftText = coreCategoryDraftTextRef.current
    if (!documentsMap || !categoriesMap || !codesMap || !memosMap || !theoryText || !coreCategoryText || !coreCategoryDraftText) return
    isApplyingRemoteRef.current = true
    setDocuments((current) => {
      const next = readDocumentsFromYjs(current)
      if (next.length === current.length) {
        let changed = false
        for (let i = 0; i < next.length; i += 1) {
          if (next[i].id !== current[i].id || next[i].title !== current[i].title) {
            changed = true
            break
          }
        }
        if (!changed) return current
      }
      return next
    })
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
    const nextCoreDraft = coreCategoryDraftText.toString()
    if (nextTheory !== theoryHtml) setTheoryHtml(nextTheory)
    if (nextCoreId !== coreCategoryId) setCoreCategoryId(nextCoreId)
    if (nextCoreDraft !== coreCategoryDraft) setCoreCategoryDraft(nextCoreDraft)
    setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 0)
  }, [
    coreCategoryId,
    isApplyingRemoteRef,
    readDocumentsFromYjs,
    readCategoriesFromYjs,
    readCodesFromYjs,
    readMemosFromYjs,
    setDocuments,
    setCodes,
    setCategories,
    setCoreCategoryId,
    setCoreCategoryDraft,
    setMemos,
    setTheoryHtml,
    theoryHtml,
    coreCategoryDraft,
  ])

  useEffect(() => {
    // Only use BroadcastChannel in local-collaboration mode (WS disabled).
    // When WS is enabled, updates already fan out via the server; broadcasting as well
    // can result in the same update being applied twice in other tabs.
    if (!disableWs) return
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    if (!projectId) return
    const channel = new BroadcastChannel(`gt-yjs:${projectId}`)
    broadcastChannelRef.current = channel
    const clientId = ydoc.clientID

    if (isLocalLeaderRef.current) {
      if (localLeaderSeedTimerRef.current) {
        window.clearTimeout(localLeaderSeedTimerRef.current)
      }
      // Grace period: give existing tabs time to reply with yjs:sync.
      // Keep this short so single-tab local usage hydrates quickly.
      localLeaderSeedTimerRef.current = window.setTimeout(() => {
        localLeaderSeedTimerRef.current = null
        if (!isLocalLeaderRef.current) return
        setHasReceivedSync((prev) => prev || true)
        if (debugEnabled) {
          console.log('[Yjs][local] leader-seed-enabled', { projectId })
        }
      }, 250)
      if (debugEnabled) {
        console.log('[Yjs][local] leader-seed-timer-start', { projectId })
      }
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; update?: string; from?: number } | undefined
      if (!data || typeof data.type !== 'string') return
      if (data.type === 'yjs:update' && typeof data.update === 'string') {
        if (debugEnabled) {
          console.log('[Yjs][local] recv update', { projectId, from: data.from })
        }
        const decoded = fromBase64(data.update)
        Y.applyUpdate(ydoc, decoded, BROADCAST_ORIGIN)
        setHasRemoteUpdates(true)
        if (disableWs) {
          setHasReceivedSync(true)
          if (localLeaderSeedTimerRef.current) {
            window.clearTimeout(localLeaderSeedTimerRef.current)
            localLeaderSeedTimerRef.current = null
            if (debugEnabled) {
              console.log('[Yjs][local] leader-seed-timer-cancel (update)', { projectId })
            }
          }
        }
        return
      }
      if (data.type === 'yjs:sync' && typeof data.update === 'string') {
        if (localLeaderSeedTimerRef.current) {
          window.clearTimeout(localLeaderSeedTimerRef.current)
          localLeaderSeedTimerRef.current = null
          if (debugEnabled) {
            console.log('[Yjs][local] leader-seed-timer-cancel (sync)', { projectId })
          }
        }
        if (debugEnabled) {
          console.log('[Yjs][local] recv sync', { projectId, from: data.from })
        }
        const decoded = fromBase64(data.update)
        Y.applyUpdate(ydoc, decoded, BROADCAST_ORIGIN)
        // Mark sync only after applying update to avoid seeding races.
        setHasReceivedSync(true)
        setHasRemoteUpdates(true)
        return
      }
      if (data.type === 'yjs:hello' && typeof data.from === 'number' && data.from !== clientId) {
        const update = Y.encodeStateAsUpdate(ydoc)
        if (debugEnabled) {
          console.log('[Yjs][local] recv hello -> sending sync', { projectId, to: data.from })
        }
        channel.postMessage({ type: 'yjs:sync', update: toBase64(update), from: clientId })
      }
    }

    channel.addEventListener('message', handleMessage)
    if (debugEnabled) {
      console.log('[Yjs][local] send hello', { projectId, from: clientId })
    }
    channel.postMessage({ type: 'yjs:hello', from: clientId })
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
      broadcastChannelRef.current = null
      if (localLeaderSeedTimerRef.current) {
        window.clearTimeout(localLeaderSeedTimerRef.current)
        localLeaderSeedTimerRef.current = null
      }
    }
  }, [disableWs, projectId, ydoc])

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
    documentsMapRef.current = ydoc.getMap<Y.Map<DocumentMapValue>>('documents')
    documentsOrderRef.current = ydoc.getArray<string>('documentsOrder')
    codesMapRef.current = ydoc.getMap<Y.Map<CodeMapValue>>('codes')
    codesOrderRef.current = ydoc.getArray<string>('codesOrder')
    categoriesMapRef.current = ydoc.getMap<Y.Map<CategoryMapValue>>('categories')
    categoriesOrderRef.current = ydoc.getArray<string>('categoriesOrder')
    memosMapRef.current = ydoc.getMap<Y.Map<MemoMapValue>>('memos')
    memosOrderRef.current = ydoc.getArray<string>('memosOrder')
    theoryTextRef.current = ydoc.getText('theoryHtml')
    coreCategoryTextRef.current = ydoc.getText('coreCategoryId')
    coreCategoryDraftTextRef.current = ydoc.getText('coreCategoryDraft')

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN || origin === BROADCAST_ORIGIN) {
        setHasRemoteUpdates(true)
        // Only defer applying remote updates while the user is actively editing in THIS tab.
        // In background tabs, `document.activeElement` can stay on a contentEditable editor,
        // which previously caused remote updates to be deferred indefinitely.
        const isActivelyEditingHere = document.hasFocus() && isEditingElement(document.activeElement)
        if (isActivelyEditingHere) {
          pendingRefreshRef.current = true
          return
        }
        refreshFromYjs()
        return
      }

      let encoded: string | null = null
      try {
        encoded = toBase64(update)
      } catch (error) {
        if (debugEnabled) {
          console.warn('[Yjs] failed to encode update', { projectId, error })
        }
      }

      if (!encoded) return

      const sent = sendJson?.({ type: 'yjs:update', update: encoded })
      if (debugEnabled && sent === false) {
        console.warn('[Yjs] failed to send yjs:update (ws not open)', { projectId })
      }

      if (disableWs) {
        try {
          broadcastChannelRef.current?.postMessage({
            type: 'yjs:update',
            update: encoded,
          })
        } catch {
          // ignore
        }
      }
    }

    ydoc.on('update', handleUpdate)
    return () => {
      try {
        ydoc.off('update', handleUpdate)
      } catch {
        // ignore
      }
    }
  }, [refreshFromYjs, sendJson, ydoc])

  // Single effect: ensure every React category is represented in the Yjs map
  // and that mutable Yjs values match React state.
  useEffect(() => {
    const documentsMap = documentsMapRef.current
    const documentsOrder = documentsOrderRef.current
    const codesMap = codesMapRef.current
    const codesOrder = codesOrderRef.current
    const categoriesMap = categoriesMapRef.current
    const categoriesOrder = categoriesOrderRef.current
    const memosMap = memosMapRef.current
    const memosOrder = memosOrderRef.current
    if (!ydoc || !documentsMap || !documentsOrder || !codesMap || !codesOrder || !categoriesMap || !categoriesOrder || !memosMap || !memosOrder) return
    // Skip syncing React→Yjs when we're applying a remote change to avoid loops
    if (isApplyingRemoteRef.current) return

    const hasRemoteData =
      documentsMap.size > 0 ||
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

      const ensureScalar = (map: Y.Map<unknown>, key: string, value: string) => {
        const current = map.get(key)
        const currentValue = current instanceof Y.Text ? current.toString() : typeof current === 'string' ? current : current ? String(current) : ''
        if (currentValue === value) return
        // Use primitive strings for scalar fields so concurrent full-field rewrites don't merge
        // into duplicated content (a known issue with Y.Text delete+insert patterns).
        map.set(key, value)
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

      const documentIds = documents.map((doc) => doc.id)
      syncOrder(documentsOrder, documentIds)
      documents.forEach((doc) => {
        let map = documentsMap.get(doc.id)
        if (!map) {
          map = new Y.Map<DocumentMapValue>()
          documentsMap.set(doc.id, map)
        }
        ensureScalar(map as unknown as Y.Map<unknown>, 'title', doc.title)
        ensureScalar(map as unknown as Y.Map<unknown>, 'html', doc.html ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'text', doc.text ?? '')
      })
      Array.from(documentsMap.keys()).forEach((id) => {
        if (documentIds.includes(id)) return
        documentsMap.delete(id)
      })

      const codeIds = codes.map((code) => code.id)
      syncOrder(codesOrder, codeIds)
      codes.forEach((code) => {
        let map = codesMap.get(code.id)
        if (!map) {
          map = new Y.Map<CodeMapValue>()
          codesMap.set(code.id, map)
        }
        ensureScalar(map as unknown as Y.Map<unknown>, 'label', code.label)
        ensureScalar(map as unknown as Y.Map<unknown>, 'description', code.description ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'colorClass', code.colorClass ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'colorHex', code.colorHex ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'textHex', code.textHex ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'ringHex', code.ringHex ?? '')
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
        // Category text fields can also be safely stored as strings to avoid merge duplication.
        ensureScalar(map as unknown as Y.Map<unknown>, 'name', category.name)
        ensureScalar(map as unknown as Y.Map<unknown>, 'precondition', category.precondition)
        ensureScalar(map as unknown as Y.Map<unknown>, 'action', category.action)
        ensureScalar(map as unknown as Y.Map<unknown>, 'consequence', category.consequence)
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
        ensureScalar(map as unknown as Y.Map<unknown>, 'type', memo.type ?? 'global')
        ensureScalar(map as unknown as Y.Map<unknown>, 'refId', memo.refId ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'title', memo.title ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'body', memo.body ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'createdAt', memo.createdAt ?? '')
        ensureScalar(map as unknown as Y.Map<unknown>, 'updatedAt', memo.updatedAt ?? '')
      })
      Array.from(memosMap.keys()).forEach((id) => {
        if (memoIds.includes(id)) return
        memosMap.delete(id)
      })
    }, LOCAL_ORIGIN)
  }, [
    documents,
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
    const coreCategoryDraftText = coreCategoryDraftTextRef.current
    if (!ydoc || !theoryText || !coreCategoryText || !coreCategoryDraftText) return
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
      if (coreCategoryDraftText.toString() !== coreCategoryDraft) {
        coreCategoryDraftText.delete(0, coreCategoryDraftText.length)
        coreCategoryDraftText.insert(0, coreCategoryDraft)
      }
    }, LOCAL_ORIGIN)
  }, [theoryHtml, coreCategoryId, coreCategoryDraft, isApplyingRemoteRef, ydoc])

  return {
    ydoc,
    hasRemoteUpdates,
    hasReceivedSync,
    isLocalLeader: disableWs ? isLocalLeader : false,
  }
}
