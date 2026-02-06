export type Code = {
  id: string
  label: string
  description: string
  colorClass: string
  colorHex?: string
  textHex?: string
  ringHex?: string
}

export type Category = {
  id: string
  name: string
  codeIds: string[]
  precondition: string
  action: string
  consequence: string
}

export type Memo = {
  id: string
  type: 'code' | 'category' | 'global'
  refId?: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}
