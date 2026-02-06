import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from '../components/DashboardLayout.types'

export type ProjectSnapshot = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos: Memo[]
  activeDocumentId: string
  documentViewMode: DocumentViewMode
  theoryHtml: string
  coreCategoryId: string
}

export function isSameProjectSnapshot(a: ProjectSnapshot, b: ProjectSnapshot) {
  if (a.activeDocumentId !== b.activeDocumentId) return false
  if (a.documentViewMode !== b.documentViewMode) return false
  if (a.theoryHtml !== b.theoryHtml) return false
  if (a.coreCategoryId !== b.coreCategoryId) return false
  if (a.documents.length !== b.documents.length) return false
  if (a.codes.length !== b.codes.length) return false
  if (a.categories.length !== b.categories.length) return false
  if (a.memos.length !== b.memos.length) return false

  for (let i = 0; i < a.documents.length; i += 1) {
    const docA = a.documents[i]
    const docB = b.documents[i]
    if (docA.id !== docB.id) return false
    if (docA.title !== docB.title) return false
    if (docA.text !== docB.text) return false
    if (docA.html !== docB.html) return false
  }

  for (let i = 0; i < a.codes.length; i += 1) {
    const codeA = a.codes[i]
    const codeB = b.codes[i]
    if (codeA.id !== codeB.id) return false
    if (codeA.label !== codeB.label) return false
    if (codeA.description !== codeB.description) return false
    if (codeA.colorHex !== codeB.colorHex) return false
    if (codeA.textHex !== codeB.textHex) return false
    if (codeA.ringHex !== codeB.ringHex) return false
  }

  for (let i = 0; i < a.categories.length; i += 1) {
    const catA = a.categories[i]
    const catB = b.categories[i]
    if (catA.id !== catB.id) return false
    if (catA.name !== catB.name) return false
    if (catA.codeIds.length !== catB.codeIds.length) return false
    for (let j = 0; j < catA.codeIds.length; j += 1) {
      if (catA.codeIds[j] !== catB.codeIds[j]) return false
    }
  }

  for (let i = 0; i < a.memos.length; i += 1) {
    const memoA = a.memos[i]
    const memoB = b.memos[i]
    if (memoA.id !== memoB.id) return false
    if (memoA.type !== memoB.type) return false
    if (memoA.refId !== memoB.refId) return false
    if (memoA.title !== memoB.title) return false
    if (memoA.body !== memoB.body) return false
    if (memoA.createdAt !== memoB.createdAt) return false
    if (memoA.updatedAt !== memoB.updatedAt) return false
  }

  return true
}
