import { Tag, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { type Code } from '../types'

export function CodeChip({
  code,
  onRemove,
}: {
  code: Code
  onRemove?: (codeId: string) => void
}) {
  const handleDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
    event.dataTransfer.setData('application/x-code-id', code.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <span
      draggable
      onDragStart={handleDragStart}
      style={{
        backgroundColor: code.colorHex ?? undefined,
        color: code.textHex ?? undefined,
        boxShadow: code.ringHex
          ? `inset 0 0 0 1px ${code.ringHex}`
          : undefined,
      }}
      className={cn(
        'inline-flex cursor-grab items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-sm transition-colors',
        code.colorClass,
      )}
    >
      <Tag className="h-3 w-3" />
      {code.label}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(code.id)
          }}
          className="ml-1 rounded-full p-0.5 text-slate-500 transition hover:bg-white/70"
          title="Remove code"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
