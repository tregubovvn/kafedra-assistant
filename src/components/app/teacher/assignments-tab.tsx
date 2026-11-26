'use client'

// Поручения преподавателя: карточка с названием, описанием, критериями и сроком (дата + время)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CalendarClock, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, todayStr, urgencyOf, URGENCY_CLASS } from '@/lib/schedule'
import type { AssignmentItem } from '@/lib/types'
import { EmptyState, Spinner, UrgencyLegend } from '@/components/app/bits'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function AssignmentsTab({ userId }: { userId: number }) {
  const [items, setItems] = useState<AssignmentItem[] | null>(null)
  const [completing, setCompleting] = useState<number | null>(null)
  const [resultFor, setResultFor] = useState<AssignmentItem | null>(null)
  const [resultText, setResultText] = useState('')
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

  async function complete(id: number, result = '') {
    setCompleting(id)
    try {
      await api(`/api/assignments/${id}/complete`, { method: 'POST', body: { result } })
      toast.success('Исполнение отмечено')
      setResultFor(null)
      setResultText('')
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
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm leading-snug font-semibold">{it.title || 'Поручение'}</p>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden />
              до {fmtDate(it.dueDate)}{it.dueTime ? `, ${it.dueTime}` : ''}
            </span>
          </div>
          {it.forAll ? (
            <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">Всем</span>
          ) : (
            <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]">Избранным</span>
          )}
        </div>

        <p className="mt-2 text-sm leading-snug whitespace-pre-line">{it.description}</p>

        {it.completionCriteria && (
          <div className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Что нужно сделать</p>
            <p className="mt-1 text-sm whitespace-pre-line">{it.completionCriteria}</p>
          </div>
        )}

        {it.requireResult && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
            <ClipboardList className="size-3.5" aria-hidden />
            Обязательно описать результат
          </p>
        )}

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
              onClick={() => {
                if (it.requireResult) {
                  setResultFor(it)
                  setResultText('')
                } else {
                  void complete(it.id)
                }
              }}
            >
              <BadgeCheck aria-hidden />
              {completing === it.id ? 'Сохранение…' : 'Выполнено'}
            </Button>
          </>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">
            {my?.completed
              ? `Выполнено${my.completedAt ? ` ${fmtDate(my.completedAt.slice(0, 10))}` : ''}`
              : 'Не выполнено в срок'}
            {my?.result ? <p className="mt-1 text-foreground">Результат: {my.result}</p> : null}
          </div>
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

      <Dialog open={Boolean(resultFor)} onOpenChange={(o) => (!o ? setResultFor(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Опишите результат</DialogTitle>
            <DialogDescription>
              По этому поручению обязательно указать, что именно сделано.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="result">Что сделано</Label>
            <Textarea
              id="result"
              rows={4}
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Например: данные по 4 группам внесены, подтверждение в системе получено"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultFor(null)}>
              Отмена
            </Button>
            <Button
              disabled={resultText.trim().length < 3 || completing === resultFor?.id}
              onClick={() => resultFor && void complete(resultFor.id, resultText.trim())}
            >
              Отметить выполненным
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
