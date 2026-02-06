import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import * as Y from 'yjs'
import { type Category } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'
import { useProjectWebSocket } from './useProjectWebSocket'

type UseYjsSyncArgs = {
  documents: DocumentItem[]
  categories: Category[]
  theoryHtml: string
  coreCategoryId: string
  setDocuments: Dispatch<SetStateAction<DocumentItem[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  setTheoryHtml: Dispatch<SetStateAction<string>>
  setCoreCategoryId: Dispatch<SetStateAction<string>>
  isApplyingRemoteRef: MutableRefObject<boolean>
}

type CategoryMapValue = Y.Text | Y.Array<string>

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

const htmlToText = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html
  return container.innerText
}

export function useYjsSync({
  documents,
  categories,
  theoryHtml,
  coreCategoryId,
  setDocuments,
  setCategories,
  setTheoryHtml,
  setCoreCategoryId,
  isApplyingRemoteRef,
}: UseYjsSyncArgs) {
  const docRef = useRef<Y.Doc | null>(null)
  const docsMapRef = useRef<Y.Map<Y.Text> | null>(null)
  const categoriesMapRef = useRef<Y.Map<Y.Map<CategoryMapValue>> | null>(null)
  const theoryTextRef = useRef<Y.Text | null>(null)
  const coreCategoryTextRef = useRef<Y.Text | null>(null)
  const observedDocsRef = useRef(new Map<string, Y.Text>())
  const observedCategoriesRef = useRef(new Map<string, Y.Map<CategoryMapValue>>())
  const observedTheoryRef = useRef(false)

  const { sendJson } = useProjectWebSocket({
    onMessage: (payload) => {
      if (!payload || typeof payload !== 'object') return
      const data = payload as Record<string, unknown>
      if (data.type !== 'yjs:update') return
      const update = typeof data.update === 'string' ? data.update : null
      if (!update) return
      if (!docRef.current) return
      const decoded = fromBase64(update)
      Y.applyUpdate(docRef.current, decoded, REMOTE_ORIGIN)
    },
  })

  useEffect(() => {
    if (docRef.current) return
    const ydoc = new Y.Doc()
    docRef.current = ydoc
    docsMapRef.current = ydoc.getMap<Y.Text>('documents')
    categoriesMapRef.current = ydoc.getMap<Y.Map<CategoryMapValue>>('categories')
    theoryTextRef.current = ydoc.getText('theoryHtml')
    coreCategoryTextRef.current = ydoc.getText('coreCategoryId')

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return
      sendJson?.({ type: 'yjs:update', update: toBase64(update) })
    })
  }, [sendJson])

  useEffect(() => {
    const ydoc = docRef.current
    if (!ydoc || !docsMapRef.current) return

    documents.forEach((doc) => {
      const existing = docsMapRef.current?.get(doc.id)
      if (!existing) {
        const text = new Y.Text()
        text.insert(0, doc.html || '')
        docsMapRef.current?.set(doc.id, text)
      }
    })
  }, [documents])

  useEffect(() => {
    const ydoc = docRef.current
    if (!ydoc || !docsMapRef.current) return
    if (isApplyingRemoteRef.current) return

    ydoc.transact(() => {
      documents.forEach((doc) => {
        let text = docsMapRef.current?.get(doc.id)
        if (!text) {
          text = new Y.Text()
          docsMapRef.current?.set(doc.id, text)
        }
        const nextHtml = doc.html || ''
        if (text.toString() !== nextHtml) {
          text.delete(0, text.length)
          text.insert(0, nextHtml)
        }
      })
    }, LOCAL_ORIGIN)
  }, [documents, isApplyingRemoteRef])

  useEffect(() => {
    const ydoc = docRef.current
    const docsMap = docsMapRef.current
    if (!ydoc || !docsMap) return

    documents.forEach((doc) => {
      const text = docsMap.get(doc.id)
      if (!text || observedDocsRef.current.has(doc.id)) return
      observedDocsRef.current.set(doc.id, text)
      text.observe((event: Y.YTextEvent) => {
        if (event.transaction.origin === LOCAL_ORIGIN) return
        const html = text.toString()
        isApplyingRemoteRef.current = true
        setDocuments((current) =>
          current.map((item) =>
            item.id === doc.id
              ? {
                  ...item,
                  html,
                  text: htmlToText(html),
                }
              : item,
          ),
        )
        setTimeout(() => {
          isApplyingRemoteRef.current = false
        }, 0)
      })
    })
  }, [documents, setDocuments, isApplyingRemoteRef])

  useEffect(() => {
    const ydoc = docRef.current
    const categoriesMap = categoriesMapRef.current
    if (!ydoc || !categoriesMap) return

    categories.forEach((category) => {
      const existing = categoriesMap.get(category.id)
      if (existing) return
      const map = new Y.Map<CategoryMapValue>()
      const name = new Y.Text()
      name.insert(0, category.name)
      const precondition = new Y.Text()
      precondition.insert(0, category.precondition)
      const action = new Y.Text()
      action.insert(0, category.action)
      const consequence = new Y.Text()
      consequence.insert(0, category.consequence)
      const codeIds = new Y.Array<string>()
      codeIds.insert(0, category.codeIds)
      map.set('name', name)
      map.set('precondition', precondition)
      map.set('action', action)
      map.set('consequence', consequence)
      map.set('codeIds', codeIds)
      categoriesMap.set(category.id, map)
    })
  }, [categories])

  useEffect(() => {
    const ydoc = docRef.current
    const categoriesMap = categoriesMapRef.current
    if (!ydoc || !categoriesMap) return
    if (isApplyingRemoteRef.current) return

    ydoc.transact(() => {
      categories.forEach((category) => {
        let map = categoriesMap.get(category.id)
        if (!map) {
          map = new Y.Map<CategoryMapValue>()
          categoriesMap.set(category.id, map)
        }
        const name = map.get('name') as Y.Text | undefined
        const precondition = map.get('precondition') as Y.Text | undefined
        const action = map.get('action') as Y.Text | undefined
        const consequence = map.get('consequence') as Y.Text | undefined
        const codeIds = map.get('codeIds') as Y.Array<string> | undefined

        const ensureText = (text: Y.Text | undefined, value: string, key: string) => {
          if (!text) {
            const next = new Y.Text()
            next.insert(0, value)
            map?.set(key, next)
            return
          }
          if (text.toString() !== value) {
            text.delete(0, text.length)
            text.insert(0, value)
          }
        }

        ensureText(name, category.name, 'name')
        ensureText(precondition, category.precondition, 'precondition')
        ensureText(action, category.action, 'action')
        ensureText(consequence, category.consequence, 'consequence')

        if (codeIds) {
          const nextIds = category.codeIds
          if (codeIds.toArray().join('|') !== nextIds.join('|')) {
            codeIds.delete(0, codeIds.length)
            codeIds.insert(0, nextIds)
          }
        } else {
          const nextArray = new Y.Array<string>()
          nextArray.insert(0, category.codeIds)
          map?.set('codeIds', nextArray)
        }
      })
    }, LOCAL_ORIGIN)
  }, [categories, isApplyingRemoteRef])

  useEffect(() => {
    const categoriesMap = categoriesMapRef.current
    if (!categoriesMap) return

    categories.forEach((category) => {
      const map = categoriesMap.get(category.id)
      if (!map || observedCategoriesRef.current.has(category.id)) return
      observedCategoriesRef.current.set(category.id, map)

      const observeText = (key: string) => {
        const text = map.get(key) as Y.Text | undefined
        if (!text) return
        text.observe((event: Y.YTextEvent) => {
          if (event.transaction.origin === LOCAL_ORIGIN) return
          const value = text.toString()
          isApplyingRemoteRef.current = true
          setCategories((current) =>
            current.map((item) =>
              item.id === category.id ? { ...item, [key]: value } : item,
            ),
          )
          setTimeout(() => {
            isApplyingRemoteRef.current = false
          }, 0)
        })
      }

      observeText('name')
      observeText('precondition')
      observeText('action')
      observeText('consequence')

      const codeIds = map.get('codeIds') as Y.Array<string> | undefined
      if (codeIds) {
        codeIds.observe((event: Y.YArrayEvent<string>) => {
          if (event.transaction.origin === LOCAL_ORIGIN) return
          const nextIds = codeIds.toArray()
          isApplyingRemoteRef.current = true
          setCategories((current) =>
            current.map((item) =>
              item.id === category.id ? { ...item, codeIds: nextIds } : item,
            ),
          )
          setTimeout(() => {
            isApplyingRemoteRef.current = false
          }, 0)
        })
      }
    })
  }, [categories, setCategories, isApplyingRemoteRef])

  useEffect(() => {
    const ydoc = docRef.current
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
  }, [theoryHtml, coreCategoryId, isApplyingRemoteRef])

  useEffect(() => {
    const theoryText = theoryTextRef.current
    const coreCategoryText = coreCategoryTextRef.current
    if (!theoryText || !coreCategoryText) return
    if (observedTheoryRef.current) return
    observedTheoryRef.current = true

    theoryText.observe((event: Y.YTextEvent) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return
      const value = theoryText.toString()
      isApplyingRemoteRef.current = true
      setTheoryHtml(value)
      setTimeout(() => {
        isApplyingRemoteRef.current = false
      }, 0)
    })

    coreCategoryText.observe((event: Y.YTextEvent) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return
      const value = coreCategoryText.toString()
      isApplyingRemoteRef.current = true
      setCoreCategoryId(value)
      setTimeout(() => {
        isApplyingRemoteRef.current = false
      }, 0)
    })
  }, [setTheoryHtml, setCoreCategoryId, isApplyingRemoteRef])
}
