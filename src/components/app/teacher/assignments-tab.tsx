'use client'

// Вкладка «Поручения» преподавателя: активные (с цветами) и завершённые

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, todayStr, urgencyOf, URGENCY_CLASS } from '@/lib/schedule'
import type { AssignmentItem } from '@/lib/types'
import { EmptyState, Spinner, UrgencyLegend } from '@/components/app/bits'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AssignmentsTab({ userId }: { userId: number }) {
  const [items, setItems] = useState<AssignmentItem[] | null>(null)
  const [completing, setCompleting] = useState<number | null>(null)
  const today = todayStr()

  const load = useCallback(async () => {
    try {
      const res = await api<{ assignments: AssignmentItem[] }>('/api/assignments')
      setItems(res.assignments)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить поручения')
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function complete(id: number) {
    setCompleting(id)
    try {
      await api(`/api/assignments/${id}/complete`, { method: 'POST' })
      toast.success('Исполнение отмечено')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отметить исполнение')
    } finally {
      setCompleting(null)
    }
  }

  const { active, done } = useMemo(() => {
    const a: AssignmentItem[] = []
    const d: AssignmentItem[] = []
    for (const it of items ?? []) {
      const my = it.statuses.find((s) => s.teacherId === userId)
      const completed = my?.completed ?? false
      const overdue = it.dueDate < today
      if (completed || overdue) d.push(it)
      else a.push(it)
    }
    a.sort((x, y) => x.dueDate.localeCompare(y.dueDate))
    return { active: a, done: d }
  }, [items, userId, today])

  function CardInner({ it, isActive }: { it: AssignmentItem; isActive: boolean }) {
    const my = it.statuses.find((s) => s.teacherId === userId)
    const u = urgencyOf(it.dueDate)
    return (
      <div className={`rounded-xl border p-4 ${isActive ? URGENCY_CLASS[u] : 'border-border bg-card'}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            до {fmtDate(it.dueDate)}
          </span>
          {it.forAll ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">Всем кафедрой</span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">Избранным</span>
          )}
        </div>
        <p className="text-sm leading-snug font-medium">{it.description}</p>
        {isActive ? (
          <>
            <p className="mt-2 text-xs font-medium">
              {u === 'today' && <span className="text-red-700">Срок сегодня!</span>}
              {u === 'soon' && <span className="text-violet-700">Осталось меньше 3 дней</span>}
              {u === 'normal' && <span className="text-green-800">Выполняется в срок</span>}
            </p>
            <Button
              size="sm"
              className="mt-3 w-full"
              variant={u === 'today' ? 'default' : 'secondary'}
              disabled={completing === it.id}
              onClick={() => void complete(it.id)}
            >
              <BadgeCheck aria-hidden />
              {completing === it.id ? 'Сохранение…' : 'Выполнено'}
            </Button>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {my?.completed
              ? `Выполнено${my.completedAt ? ` ${fmtDate(my.completedAt.slice(0, 10))}` : ''}`
              : 'Не выполнено в срок'}
          </p>
        )}
      </div>
    )
  }

  return (
    <section aria-label="Поручения">
      <Tabs defaultValue="active">
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            Активные {active.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{active.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1">
            Завершённые
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 grid gap-3">
          <UrgencyLegend />
          {items === null ? (
            <Spinner label="Загрузка…" />
          ) : active.length === 0 ? (
            <EmptyState title="Активных поручений нет" />
          ) : (
            active.map((it) => <CardInner key={it.id} it={it} isActive />)
          )}
        </TabsContent>

        <TabsContent value="done" className="mt-4 grid gap-3">
          {items === null ? (
            <Spinner label="Загрузка…" />
          ) : done.length === 0 ? (
            <EmptyState title="Завершённых поручений нет" />
          ) : (
            done.map((it) => <CardInner key={it.id} it={it} isActive={false} />)
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
