import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import { CodeHighlight } from '../tiptap/CodeHighlight'
import type * as Y from 'yjs'

type DocumentEditorProps = {
  documentId: string
  initialHtml: string

    // IMPORTANT: Only one client should ever seed snapshot HTML into the shared Yjs document.
    // If multiple devices seed concurrently (common during reconnect), CRDT merges can duplicate
    // the content. We therefore only seed when presence/WS is ready AND this client is the
    // designated seeder.
    clearFallbackTimer()
    if (!seedReady) return
    if (!canSeedInitialContent) return
      }
      window.localStorage.setItem(lockKey, JSON.stringify({ tabId, ts: now }))
      return true
    } catch {
      // If storage is blocked, fall back to allowing seeding.
      return true
    }
  }

  const extensions = collaborationEnabled
    ? [
        StarterKit.configure({ history: false }),
        Underline,
        CodeHighlight,
        Collaboration.configure({
          document: ydoc,
          field: documentId,
        }),
      ]
    : [StarterKit, Underline, CodeHighlight]
  const editor = useEditor({
    extensions,
    content: '',
    onUpdate: ({ editor, transaction }) => {
      if (transaction?.getMeta?.('gt-local-change') === true) {
        onLocalChange?.()
      }
      const html = editor.getHTML()
      const text = editor.getText()
      lastAppliedHtmlRef.current = html
      if (debugEnabled) {
        const now = Date.now()
        if (now - debugRef.current.lastLogAt > 800) {
          debugRef.current.lastLogAt = now
          console.log('[DocEditor] update', {
            documentId,
            htmlLen: html.length,
            textLen: text.length,
          })
        }
      }
      onUpdate(html, text)
    },
  })

  useEffect(() => {
    onEditorReady(documentId, editor)
    return () => {
      onEditorReady(documentId, null)
    }
  }, [documentId, editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    if (!collaborationEnabled) {
      if (didSeedRef.current) return
      if (!initialHtml) return
      if (debugEnabled) {
        console.log('[DocEditor] plain seed setContent', {
          documentId,
          initialHtmlLen: initialHtml.length,
        })
      }
      editor.commands.setContent(initialHtml, false)
      didSeedRef.current = true
      lastAppliedHtmlRef.current = editor.getHTML()
      return
    }

    const fragment = ydoc.getXmlFragment(documentId)
    if (debugEnabled) {
      const now = Date.now()
      if (now - debugRef.current.lastLogAt > 800) {
        debugRef.current.lastLogAt = now
        console.log('[DocEditor] seed-check', {
          documentId,
          seedReady,
          canSeedInitialContent,
          hasReceivedSync,
          hasRemoteUpdates,
          didSeed: didSeedRef.current,
          fragmentLen: fragment.toString().length,
          initialHtmlLen: initialHtml?.length ?? 0,
        })
      }
    }
    if (didSeedRef.current) return

    const currentText = editor.getText().trim()
    const editorIsEmpty = currentText.length === 0

    const clearFallbackTimer = () => {
      if (!fallbackSeedTimerRef.current) return
      window.clearTimeout(fallbackSeedTimerRef.current)
      fallbackSeedTimerRef.current = null
    }

    // While we wait for WS/presence (seedReady) we must NOT seed immediately in multiple tabs,
    // otherwise each tab will insert the same snapshot into Yjs and the merge duplicates text.
    // Instead, wait briefly and only seed if we can acquire a lock.
    if (!seedReady) {
      clearFallbackTimer()
      if (editorIsEmpty && initialHtml && fragment.length === 0 && !hasRemoteUpdates) {
        fallbackSeedTimerRef.current = window.setTimeout(() => {
          fallbackSeedTimerRef.current = null
          if (didSeedRef.current) return
          if (!editor) return
          const nowText = editor.getText().trim()
          const stillEmpty = nowText.length === 0
          const stillNoRemote = !hasRemoteUpdates
          const stillEmptyFragment = ydoc.getXmlFragment(documentId).length === 0
          if (!stillEmpty || !stillNoRemote || !stillEmptyFragment) return
          if (!tryAcquireSeedLock()) {
            if (debugEnabled) {
              console.log('[DocEditor] seed-lock held (waiting for remote)', { documentId })
            }
            return
          }
          if (debugEnabled) {
            console.log('[DocEditor] delayed seed setContent (seedReady=false)', {
              documentId,
              initialHtmlLen: initialHtml.length,
            })
          }
          editor.commands.setContent(initialHtml, false)
          didSeedRef.current = true
          lastAppliedHtmlRef.current = editor.getHTML()
        }, 1200)

        return () => {
          clearFallbackTimer()
        }
      }
      return () => {
        clearFallbackTimer()
      }
    }

    // If presence is ready and we are not the designated seeder, give the seeder a short
    // window to push Yjs updates. If nothing arrives and the fragment is still empty,
    // seed anyway so cross-device users don't get stuck with a blank document.
    if (seedReady && !canSeedInitialContent) {
      clearFallbackTimer()
      if (editorIsEmpty && initialHtml && fragment.length === 0 && !hasRemoteUpdates) {
        fallbackSeedTimerRef.current = window.setTimeout(() => {
          fallbackSeedTimerRef.current = null
          if (didSeedRef.current) return
          if (!editor) return
          const nowText = editor.getText().trim()
          const stillEmpty = nowText.length === 0
          const stillNoRemote = !hasRemoteUpdates
          const stillEmptyFragment = ydoc.getXmlFragment(documentId).length === 0
          if (!stillEmpty || !stillNoRemote || !stillEmptyFragment) return
          if (!tryAcquireSeedLock()) {
            if (debugEnabled) {
              console.log('[DocEditor] seed-lock held (skip fallback seed)', { documentId })
            }
            return
          }
          if (debugEnabled) {
            console.log('[DocEditor] fallback seed setContent', {
              documentId,
              initialHtmlLen: initialHtml.length,
            })
          }
          editor.commands.setContent(initialHtml, false)
          didSeedRef.current = true
        }, 1200)

        return () => {
          clearFallbackTimer()
        }
      }
      return () => {
        clearFallbackTimer()
      }
    }

    clearFallbackTimer()

    // If we are the designated seeder, we can seed immediately.
    // Do not require hasReceivedSync here; in some network races yjs:sync can be delayed/missed,
    // and blocking seeding leaves the editor blank even though we have snapshot HTML.
    if (editorIsEmpty && initialHtml) {
      if (!tryAcquireSeedLock()) {
        if (debugEnabled) {
          console.log('[DocEditor] seed-lock held (skip designated seed)', { documentId })
        }
        return
      }
      if (debugEnabled) {
        console.log('[DocEditor] seeding setContent', {
          documentId,
          initialHtmlLen: initialHtml.length,
        })
      }
      editor.commands.setContent(initialHtml, false)
      didSeedRef.current = true
      lastAppliedHtmlRef.current = editor.getHTML()
    }

    if (!editorIsEmpty) {
      // Editor already has content (from Yjs). Mark as seeded.
      didSeedRef.current = true
    } else if (fragment.length > 0) {
      if (debugEnabled && !didSeedRef.current) {
        console.log('[DocEditor] seed-skip fragment-not-empty', {
          documentId,
          fragmentLen: fragment.length,
        })
      }
      didSeedRef.current = true
    }
  }, [
    editor,
    documentId,
    initialHtml,
    ydoc,
    collaborationEnabled,
    canSeedInitialContent,
    seedReady,
    hasRemoteUpdates,
    hasReceivedSync,
  ])

  useEffect(() => {
    if (!editor) return
    if (collaborationEnabled) return
    if (!didSeedRef.current) return

    // In plain editor mode (no Yjs Collaboration extension), remote collaborators
    // update `initialHtml` via project snapshots. Keep the editor in sync when the
    // user isn't actively editing.
    const hasFocus = editor.view?.hasFocus?.() ?? false
    if (hasFocus) return

    const next = (initialHtml ?? '').trim()
    const last = (lastAppliedHtmlRef.current ?? '').trim()
    if (!next) return
    if (next === last) return

    if (debugEnabled) {
      console.log('[DocEditor] plain remote sync setContent', {
        documentId,
        nextLen: next.length,
        lastLen: last.length,
      })
    }

    editor.commands.setContent(next, false)
    lastAppliedHtmlRef.current = editor.getHTML()
  }, [collaborationEnabled, debugEnabled, documentId, editor, initialHtml])

  useEffect(() => {
    return () => {
      if (fallbackSeedTimerRef.current) {
        window.clearTimeout(fallbackSeedTimerRef.current)
        fallbackSeedTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    if (!hasReceivedSync) return
    if (didSyncRef.current) return
    const html = editor.getHTML()
    const text = editor.getText()
    if (!html && !text) return
    onUpdate(html, text)
    didSyncRef.current = true
  }, [editor, hasReceivedSync, onUpdate])

  const runCommand = (command: string, value?: string) => {
    if (!editor) return
    const chain = editor.chain().focus()
    switch (command) {
      case 'bold':
        chain.toggleBold().run()
        break
      case 'italic':
        chain.toggleItalic().run()
        break
      case 'underline':
        chain.toggleUnderline?.().run()
        break
      case 'fontSize':
        break
      case 'foreColor':
        break
      default:
        break
    }
    if (value) {
      void value
    }
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editor && event.target === event.currentTarget) {
      editor.commands.focus('end')
    }
    onMouseDown?.(event)
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    onMouseUp?.(event)
  }

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => runCommand('bold')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => runCommand('italic')}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Italic
        </button>
        <select
          id="doc-font-size"
          name="doc-font-size"
          onChange={(event) => runCommand('fontSize', event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          defaultValue="3"
        >
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
        </select>
        <select
          id="doc-font-family"
          name="doc-font-family"
          value={fontFamilyValue}
          onChange={(event) => setFontFamily(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="__mixed__" disabled>
            Mixed
          </option>
          <option value="Inter, ui-sans-serif, system-ui">Inter</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica Neue</option>
          <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">Segoe UI</option>
          <option value="Roboto, 'Helvetica Neue', Arial, sans-serif">Roboto</option>
          <option value="'Open Sans', Arial, sans-serif">Open Sans</option>
          <option value="Lato, Arial, sans-serif">Lato</option>
          <option value="'Montserrat', Arial, sans-serif">Montserrat</option>
          <option value="'Noto Sans', Arial, sans-serif">Noto Sans</option>
          <option value="'Source Sans Pro', Arial, sans-serif">Source Sans Pro</option>
          <option value="'Times New Roman', Times, serif">Times New Roman</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Garamond, 'Times New Roman', serif">Garamond</option>
          <option value="'Palatino Linotype', 'Book Antiqua', Palatino, serif">Palatino</option>
          <option value="'Book Antiqua', 'Palatino Linotype', serif">Book Antiqua</option>
          <option value="'Courier New', Courier, monospace">Courier New</option>
          <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
          <option value="'Consolas', 'Courier New', monospace">Consolas</option>
          <option value="'Tahoma', Geneva, sans-serif">Tahoma</option>
          <option value="'Verdana', Geneva, sans-serif">Verdana</option>
        </select>
        <select
          id="doc-line-height"
          name="doc-line-height"
          value={lineHeight}
          onChange={(event) => setLineHeight(event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="1.4">Tight</option>
          <option value="1.6">Normal</option>
          <option value="1.75">Relaxed</option>
          <option value="2">Loose</option>
        </select>
      </div>
      <EditorContent
        editor={editor}
        className="document-content relative min-h-[220px] whitespace-pre-wrap px-3 pb-3 pt-2 text-sm leading-7 text-slate-800 outline-none dark:text-slate-100"
        style={{ fontFamily, lineHeight }}
        data-editor="tiptap"
        ref={editorRef}
        spellCheck={false}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={onClick}
      />
    </div>
  )
}
