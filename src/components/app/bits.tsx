'use client'

// Общие мелкие UI-элементы обоих клиентов

import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { URGENCY_BADGE_CLASS, URGENCY_LABEL, WORK_TYPE_LABEL, urgencyOf, daysLeft, type Urgency } from '@/lib/schedule'

export function UrgencyBadge({ dueDate }: { dueDate: string }) {
  const u: Urgency = urgencyOf(dueDate)
  const dl = daysLeft(dueDate)
  const label =
    u === 'today' ? 'Срок сегодня' : u === 'soon' ? `Осталось ${dl} дн.` : u === 'overdue' ? 'Срок истёк' : 'В работе'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${URGENCY_BADGE_CLASS[u]}`}
    >
      {label}
    </span>
  )
}

export function WorkTypeBadge({ type }: { type: string }) {
  const cls: Record<string, string> = {
    TEACHING: 'bg-green-100 text-green-900 border-green-300',
    TEACHING_METHODICAL: 'bg-amber-100 text-amber-900 border-amber-300',
    ORG_METHODICAL: 'bg-stone-100 text-stone-700 border-stone-300',
    RESEARCH: 'bg-rose-100 text-rose-900 border-rose-300',
    EDUCATIONAL: 'bg-teal-100 text-teal-900 border-teal-300',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls[type] ?? 'bg-muted'}`}
    >
      {WORK_TYPE_LABEL[type] ?? type}
    </span>
  )
}

export function ReplacementStatusBadge({ status }: { status: string }) {
  if (status === 'SEARCHING') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-0.5 text-xs font-medium">
        Поиск преподавателя
      </span>
    )
  }
  if (status === 'FOUND') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 border border-green-400 text-green-900 px-2.5 py-0.5 text-xs font-medium">
        Замена подобрана
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 border border-stone-300 text-stone-600 px-2.5 py-0.5 text-xs font-medium">
      Отменено
    </span>
  )
}

export function KindBadge({ kind }: { kind: string }) {
  return <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{kind}</span>
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed py-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function UrgencyLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-red-600" />
        срок сегодня
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-violet-600" />
        меньше 3 дней
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-green-700" />
        остальные
      </span>
    </div>
  )
}

export { URGENCY_LABEL }
