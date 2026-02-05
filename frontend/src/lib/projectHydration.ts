import { type Category, type Code, type Memo } from '../types'
import { type DocumentItem } from '../components/DashboardLayout.types'

type HydratedProject = {
  documents: DocumentItem[]
  codes: Code[]
  categories: Category[]
  memos?: Memo[]
  coreCategoryId?: string
  theoryHtml?: string
}

// Normalize remote project payloads into the app's state shape.
export function hydrateRemoteProject(
  project: Record<string, unknown>,
  getReadableTextColor: (hex: string) => string,
): HydratedProject {
  const documents = Array.isArray(project.documents)
    ? (project.documents as Array<Record<string, unknown>>).map((doc) => ({
        id: String(doc.id ?? ''),
        title: String(doc.title ?? ''),
        html: String(doc.html ?? ''),
        text: String(doc.text ?? doc.content ?? ''),
      }))
    : []

  const codes = Array.isArray(project.codes)
    ? (project.codes as Array<Record<string, unknown>>).map((code) => {
        const colorHex = String(code.colorHex ?? code.color ?? '#E2E8F0')
        const textHex = String(code.textHex ?? getReadableTextColor(colorHex))
        return {
          id: String(code.id ?? ''),
          label: String(code.label ?? code.name ?? 'Untitled'),
          description: String(code.description ?? ''),
          colorClass: String(code.colorClass ?? 'bg-slate-100 text-slate-700 ring-slate-200'),
          colorHex,
          textHex,
          ringHex: String(code.ringHex ?? `${textHex}33`),
        }
      })
    : []

  const categories = Array.isArray(project.categories)
    ? (project.categories as Array<Record<string, unknown>>).map((category) => ({
        id: String(category.id ?? ''),
        name: String(category.name ?? ''),
        codeIds: Array.isArray(category.codeIds)
          ? (category.codeIds as string[])
          : Array.isArray(category.contained_code_ids)
            ? (category.contained_code_ids as string[])
            : [],
        precondition: String(category.precondition ?? ''),
        action: String(category.action ?? ''),
        consequence: String(category.consequence ?? ''),
      }))
    : []

  const memos = Array.isArray(project.memos)
    ? (project.memos as Array<Record<string, unknown>>).map((memo) => ({
        id: String(memo.id ?? ''),
        title: String(memo.title ?? 'Untitled memo'),
        body: String(memo.body ?? ''),
        createdAt: String(memo.createdAt ?? memo.created_at ?? ''),
        updatedAt: String(memo.updatedAt ?? memo.updated_at ?? ''),
      }))
    : undefined

  const coreCategoryId =
    typeof project.coreCategoryId === 'string'
      ? project.coreCategoryId
      : typeof project.core_category_id === 'string'
        ? project.core_category_id
        : undefined

  const theoryHtml =
    typeof project.theoryHtml === 'string'
      ? project.theoryHtml
      : typeof project.theory_description === 'string'
        ? project.theory_description
        : undefined

  return {
    documents,
    codes,
    categories,
    memos,
    coreCategoryId,
    theoryHtml,
  }
}
