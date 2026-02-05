import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem, type DocumentViewMode } from '../components/DashboardLayout.types'

type StoredProjectState = {
  codes?: Code[]
  categories?: Category[]
  memos?: Memo[]
  documents?: DocumentItem[]
  activeDocumentId?: string
  documentViewMode?: DocumentViewMode
  theoryHtml?: string
  coreCategoryId?: string
}

export const loadStoredProjectState = (storageKey: string): StoredProjectState | null => {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem(storageKey)
  if (!saved) return null
  try {
    return JSON.parse(saved) as StoredProjectState
  } catch {
    return null
  }
}

export const saveStoredProjectState = (storageKey: string, state: StoredProjectState) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey, JSON.stringify(state))
}
