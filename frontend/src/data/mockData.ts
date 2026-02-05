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
}

export type DocumentSegment = {
  text: string
  codeId?: string
}

export const mockCodes: Code[] = [
  {
    id: 'code-meaning-making',
    label: 'Meaning Making',
    description: 'Participant reflects on interpreting events or emotions.',
    colorClass: 'bg-amber-100 text-amber-700 ring-amber-200',
    colorHex: '#FEF3C7',
    textHex: '#92400E',
    ringHex: 'rgba(146, 64, 14, 0.2)',
  },
  {
    id: 'code-trust',
    label: 'Trust Signals',
    description: 'Mentions of credibility, safety, or reliability.',
    colorClass: 'bg-sky-100 text-sky-700 ring-sky-200',
    colorHex: '#E0F2FE',
    textHex: '#075985',
    ringHex: 'rgba(7, 89, 133, 0.2)',
  },
  {
    id: 'code-identity',
    label: 'Identity Shift',
    description: 'Changes in how they see themselves or their role.',
    colorClass: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    colorHex: '#D1FAE5',
    textHex: '#065F46',
    ringHex: 'rgba(6, 95, 70, 0.2)',
  },
  {
    id: 'code-barrier',
    label: 'Barriers',
    description: 'Obstacles or friction in their process.',
    colorClass: 'bg-rose-100 text-rose-700 ring-rose-200',
    colorHex: '#FFE4E6',
    textHex: '#9F1239',
    ringHex: 'rgba(159, 18, 57, 0.2)',
  },
  {
    id: 'code-support',
    label: 'Support Systems',
    description: 'People, tools, or processes that helped.',
    colorClass: 'bg-violet-100 text-violet-700 ring-violet-200',
    colorHex: '#EDE9FE',
    textHex: '#5B21B6',
    ringHex: 'rgba(91, 33, 182, 0.2)',
  },
]

export const mockCategories: Category[] = [
  {
    id: 'category-journey',
    name: 'Sensemaking Journey',
    codeIds: ['code-meaning-making', 'code-identity'],
  },
  {
    id: 'category-conditions',
    name: 'Conditions & Context',
    codeIds: ['code-barrier', 'code-support'],
  },
]

export const mockDocumentSegments: DocumentSegment[] = [
  {
    text: 'When I first joined the program, I felt uncertain about how to contribute. ',
  },
  {
    text: 'Over time, I started to reinterpret the feedback as an opportunity ',
    codeId: 'code-meaning-making',
  },
  {
    text: 'rather than criticism. ',
  },
  {
    text: 'That shift made me feel more confident in my role. ',
    codeId: 'code-identity',
  },
  {
    text: 'The hardest part was the lack of clear guidance in the early weeks, ',
    codeId: 'code-barrier',
  },
  {
    text: 'but weekly check-ins with my mentor made a huge difference. ',
    codeId: 'code-support',
  },
  {
    text: 'Knowing I could rely on the team helped me take bigger risks. ',
    codeId: 'code-trust',
  },
]
