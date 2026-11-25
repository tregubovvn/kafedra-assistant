'use client'

// Вкладка «Расписание» преподавателя: своё расписание с заменами,
// входящие просьбы о замене и мастер подбора замены.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, SearchX, UserCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { addDaysStr, fmtDate, pairTime, todayStr, weekdayName } from '@/lib/schedule'
import type { CandidateGroup, IncomingRequest, ReplacementItem, ScheduleLesson } from '@/lib/types'
import { EmptyState, KindBadge, Spinner } from '@/components/app/bits'

export function ScheduleTab({ userId }: { userId: number }) {
  const [date, setDate] = useState(todayStr())
  const [lessons, setLessons] = useState<ScheduleLesson[] | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [wizard, setWizard] = useState<{ pair: number; lesson: ScheduleLesson } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const today = todayStr()
  const currentKey = `${userId}|${date}`

  const loadSchedule = useCallback(async () => {
    try {
      const res = await api<{ lessons: ScheduleLesson[] }>(`/api/schedule?mode=teacher&id=${userId}&date=${date}`)
      setLessons(res.lessons)
      setLoadedKey(currentKey)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить расписание')
      setLessons([])
      setLoadedKey(currentKey)
    }
  }, [userId, date, currentKey])

  const loadIncoming = useCallback(async () => {
    try {
      const res = await api<{ incoming: IncomingRequest[] }>('/api/replacements')
      setIncoming(res.incoming)
    } catch {
      // тихо: вкладка не об ошибке
    }
  }, [])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])

  useEffect(() => {
    void loadIncoming()
  }, [loadIncoming])

  async function respond(requestId: number, replacementId: number, accept: boolean) {
    try {
      await api(`/api/replacements/${replacementId}/${accept ? 'accept' : 'decline'}`, { method: 'POST' })
      toast.success(accept ? 'Вы согласились на замену. Занятие добавлено в ваш журнал работ.' : 'Просьба отклонена')
      void loadIncoming()
      void loadSchedule()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось выполнить')
    }
  }

  async function cancelSearch(pair: number) {
    setCancelling(true)
    try {
      const res = await api<{ mine: ReplacementItem[] }>('/api/replacements')
      const target = res.mine.find((r) => r.lessonDate === date && r.pairNumber === pair && r.status === 'SEARCHING')
      if (!target) {
        toast.error('Поиск не найден')
        return
      }
      await api(`/api/replacements/${target.id}/cancel`, { method: 'POST' })
      toast.success('Поиск замены отменён')
      void loadSchedule()
      void loadIncoming()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отменить')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <section aria-label="Расписание">
      <h2 className="mb-3 text-base font-semibold">Моё расписание</h2>

      {incoming.length > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 py-0">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold text-amber-900">Просьбы о замене ({incoming.length})</p>
            <div className="grid gap-3">
              {incoming.map(({ requestId, replacement: r }) => {
                const t = pairTime(r.pairNumber)
                return (
                  <div key={requestId} className="rounded-lg border border-amber-300 bg-white p-3">
                    <p className="text-sm font-medium">{r.discipline}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {weekdayName(r.lessonDate)}, {fmtDate(r.lessonDate)}, {r.pairNumber}-я пара ({t.start}–{t.end}), группа {r.groupId}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Просит: {r.initiatorFullName}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={() => void respond(requestId, r.id, true)}>
                        <UserCheck aria-hidden />
                        Согласиться
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void respond(requestId, r.id, false)}>
                        Отклонить
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Предыдущий день" onClick={() => setDate(addDaysStr(date, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted"
          onClick={() => setDate(todayStr())}
        >
          {date === today ? 'Сегодня' : date < today ? 'Назад' : 'Впереди'} · {weekdayName(date)}, {fmtDate(date)}
        </button>
        <Button variant="outline" size="icon" aria-label="Следующий день" onClick={() => setDate(addDaysStr(date, 1))}>
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {lessons === null || loadedKey !== currentKey ? (
        <Spinner label="Загрузка расписания…" />
      ) : lessons.length === 0 ? (
        <EmptyState title="Занятий в этот день нет" />
      ) : (
        <div className="grid gap-2">
          {lessons.map((l, i) => {
            const t = pairTime(l.pairNumber)
            const replaceable = date >= today && !l.searching && !l.replacedBy && !l.isSubstitution
            return (
              <Card
                key={`${l.pairNumber}-${i}`}
                className={`py-0 ${l.isSubstitution ? 'border-green-400 bg-green-50' : ''}`}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
                    <span className="text-[10px] text-muted-foreground">пара</span>
                    <span className="text-base leading-none font-semibold">{l.pairNumber}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t.start}–{t.end}</span>
                      <KindBadge kind={l.kind} />
                    </div>
                    <p className={`mt-1 text-sm font-medium leading-snug ${l.replacedBy ? 'line-through decoration-foreground/50' : ''}`}>
                      {l.discipline}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      группа {l.groupId}
                      {l.room ? ` · ауд. ${l.room}` : ''}
                    </p>
                    {l.searching && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Идёт поиск замены
                        </span>
                      </div>
                    )}
                    {l.replacedBy && (
                      <p className="mt-2 rounded-full border border-green-400 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                        Заменяет: {l.replacedBy}
                      </p>
                    )}
                    {l.isSubstitution && (
                      <p className="mt-2 rounded-full border border-green-400 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                        Вы заменяете
                      </p>
                    )}
                  </div>
                  {replaceable && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => setWizard({ pair: l.pairNumber, lesson: l })}>
                      Заменить
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {wizard && (
        <ReplacementWizard
          date={date}
          pair={wizard.pair}
          lesson={wizard.lesson}
          onClose={() => setWizard(null)}
          onCreated={() => {
            setWizard(null)
            void loadSchedule()
          }}
        />
      )}

      {lessons !== null && loadedKey === currentKey && lessons.some((l) => l.searching) && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled={cancelling}
          onClick={() => {
            const l = lessons.find((x) => x.searching)
            if (l) void cancelSearch(l.pairNumber)
          }}
        >
          <SearchX aria-hidden />
          {cancelling ? 'Отмена…' : 'Отменить поиск замены на этот день'}
        </Button>
      )}
    </section>
  )
}

// Мастер подбора замены: список свободных преподавателей по приоритету
function ReplacementWizard({
  date,
  pair,
  lesson,
  onClose,
  onCreated,
}: {
  date: string
  pair: number
  lesson: ScheduleLesson
  onClose: () => void
  onCreated: () => void
}) {
  const [groups, setGroups] = useState<CandidateGroup[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api<{ groups: CandidateGroup[] }>(`/api/replacements/candidates?date=${date}&pair=${pair}`)
        if (!cancelled) setGroups(res.groups)
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Не удалось подобрать кандидатов')
          setGroups([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [date, pair])

  const total = useMemo(() => (groups ?? []).reduce((acc, g) => acc + g.teachers.length, 0), [groups])

  async function send() {
    if (selected.length === 0) return
    setSending(true)
    try {
      await api('/api/replacements', {
        method: 'POST',
        body: { date, pairNumber: pair, candidateIds: selected },
      })
      setSent(true)
      toast.success(`Просьба отправлена (${selected.length})`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  const t = pairTime(pair)

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle>Замена занятия</DialogTitle>
          <DialogDescription>
            {lesson.discipline} ({lesson.kind}), группа {lesson.groupId}
            <br />
            {weekdayName(date)}, {fmtDate(date)}, {pair}-я пара ({t.start}–{t.end})
            {lesson.room ? `, ауд. ${lesson.room}` : ''}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="grid gap-3 py-2 text-center">
            <p className="text-sm font-medium">Просьбы отправлены выбранным преподавателям.</p>
            <p className="text-xs text-muted-foreground">
              Как только кто-то согласится, замена закрепится за ним, а остальные просьбы пропадут. Статус виден в расписании и заведующему.
            </p>
            <Button onClick={onCreated}>Понятно</Button>
          </div>
        ) : groups === null ? (
          <Spinner label="Ищем свободных преподавателей…" />
        ) : total === 0 ? (
          <EmptyState title="Свободных преподавателей нет" hint="Попробуйте другой день или обратитесь к заведующему" />
        ) : (
          <>
            <div className="grid gap-4">
              {groups
                .filter((g) => g.teachers.length > 0)
                .map((g) => (
                  <div key={g.key} className="grid gap-1.5">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</p>
                    {g.teachers.map((c) => {
                      const checked = selected.includes(c.id)
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setSelected((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                            }
                            aria-label={`Выбрать ${c.fullName}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{c.fullName}</span>
                            <span className="block text-xs text-muted-foreground">{c.detail}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ))}
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                <X aria-hidden />
                Отмена
              </Button>
              <Button onClick={() => void send()} disabled={selected.length === 0 || sending}>
                {sending ? 'Отправка…' : `Отправить просьбу (${selected.length})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
