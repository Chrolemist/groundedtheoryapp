export type DocumentViewMode = 'single' | 'all'

export type DocumentItem = {
  id: string
  title: string
  text: string
  html: string
}

export type PresenceUser = {
  id: string
  name: string
  color: string
}

export type CursorPresence = {
  x: number
  y: number
  documentId?: string
  updatedAt: number
}
