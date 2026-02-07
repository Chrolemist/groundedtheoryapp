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
  fieldId?: string
  documentId?: string
  docPos?: number
  height?: number
  absolute?: boolean
  updatedAt: number
}

export type SelectionPresence = {
  documentId: string
  from: number
  to: number
  rects?: Array<{ x: number; y: number; width: number; height: number }>
  updatedAt: number
}
