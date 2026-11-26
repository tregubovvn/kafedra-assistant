'use client'

// Вкладка «Расписание» преподавателя: только свои занятия одним списком по дням от сегодня.
// У каждого занятия — кнопка «Замена»; на карточке видны поиск замены, «Вас заменяют» и взятые замены.

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
import { SearchX, UserCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, pairTime, todayStr, weekdayName } from '@/lib/schedule'
import type {
  CandidateGroup,
  IncomingRequest,
  RaspLesson,
  ReplacementItem,
  ScheduleLesson,
} from '@/lib/types'
import { EmptyState, KindBadge, Spinner } from '@/components/app/bits'

type ReplacementsResponse = {
  mine: ReplacementItem[]
  incoming: IncomingRequest[]
  substitutions?: ReplacementItem[]
}

type Row = {
  key: string
  date: string
  pairNumber: number
  discipline: string
  kind: string
  groupId: string
  room: string
  own: boolean
  searching: boolean
  replacedBy: string | null
  coveringFor: string | null
}

// ФИО сравниваем без учёта регистра и «ё»
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
  return norm(a) === norm(b)
}

export function ScheduleTab({ userId, fullName }: { userId: number; fullName: string }) {
  const [rasp, setRasp] = useState<RaspLesson[] | null>(null)
  const [repl, setRepl] = useState<ReplacementsResponse | null>(null)
  const [reloading, setReloading] = useState(false)
  const [wizard, setWizard] = useState<{ date: string; pair: number; lesson: ScheduleLesson } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const today = todayStr()

  const load = useCallback(async () => {
    try {
      const [schedule, replacements] = await Promise.all([
        api<{ lessons: RaspLesson[] }>('/api/rasp'),
        api<ReplacementsResponse>('/api/replacements'),
      ])
      setRasp(schedule.lessons)
      setRepl({
        mine: replacements.mine ?? [],
        incoming: replacements.incoming ?? [],
        substitutions: replacements.substitutions ?? [],
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить расписание')
      setRasp([])
      setRepl({ mine: [], incoming: [], substitutions: [] })
    }
  }, [])

  const refresh = useCallback(async () => {
    setReloading(true)
    await load()
    setReloading(false)
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  const incoming = repl?.incoming ?? []

  async function respond(requestId: number, replacementId: number, accept: boolean) {
    try {
      await api(`/api/replacements/${replacementId}/${accept ? 'accept' : 'decline'}`, { method: 'POST' })
      toast.success(accept ? 'Вы согласились на замену. Занятие появилось в расписании.' : 'Просьба отклонена')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось выполнить')
    }
  }

  async function cancelSearch(date: string, pairNumber: number) {
    setCancelling(true)
    try {
      const target = (repl?.mine ?? []).find(
        (r) => r.lessonDate === date && r.pairNumber === pairNumber && r.status === 'SEARCHING'
      )
      if (!target) {
        toast.error('Поиск не найден')
        return
      }
      await api(`/api/replacements/${target.id}/cancel`, { method: 'POST' })
      toast.success('Поиск замены отменён')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отменить')
    } finally {
      setCancelling(false)
    }
  }

  const rows = useMemo(() => {
    const list: Row[] = []
    const seen = new Set<string>()
    const mineBySlot = new Map<string, ReplacementItem>()
    for (const r of repl?.mine ?? []) mineBySlot.set(`${r.lessonDate}|${r.pairNumber}`, r)

    for (const l of rasp ?? []) {
      if (!sameName(l.teacherName, fullName) || l.date < today) continue
      const key = `${l.date}|${l.pairNumber}`
      const r = mineBySlot.get(key)
      list.push({
        key,
        date: l.date,
        pairNumber: l.pairNumber,
        discipline: l.discipline,
        kind: l.kind ?? '',
        groupId: l.groupId ?? '',
        room: l.room ?? '',
        own: true,
        searching: r?.status === 'SEARCHING',
        replacedBy: r?.status === 'FOUND' ? r.substituteFullName ?? '—' : null,
        coveringFor: null,
      })
      seen.add(key)
    }

    for (const r of repl?.substitutions ?? []) {
      if (r.status !== 'FOUND') continue
      const key = `${r.lessonDate}|${r.pairNumber}`
      if (seen.has(key)) continue
      list.push({
        key: `sub-${r.id}`,
        date: r.lessonDate,
        pairNumber: r.pairNumber,
        discipline: r.discipline,
        kind: r.kind ?? '',
        groupId: r.groupId ?? '',
        room: r.room ?? '',
        own: false,
        searching: false,
        replacedBy: null,
        coveringFor: r.initiatorFullName,
      })
      seen.add(key)
    }

    return list
      .filter((r) => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.pairNumber - b.pairNumber)
  }, [rasp, repl, fullName, today])

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const list = map.get(r.date) ?? []
      list.push(r)
      map.set(r.date, list)
    }
    return [...map.entries()]
  }, [rows])

  return (
    <section aria-label="Расписание" className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Моё расписание</h2>
          <p className="text-xs text-muted-foreground">
            Источник: rasp.sstu.ru, кафедра ПМН. Все дни с {fmtDate(today)}, только ваши занятия.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={reloading} onClick={() => void refresh()}>
          {reloading ? 'Обновление…' : 'Обновить'}
        </Button>
      </div>

      {incoming.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 py-0">
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

      {rasp === null || repl === null ? (
        <Spinner label="Загрузка расписания…" />
      ) : byDate.length === 0 ? (
        <EmptyState
          title="Ваших занятий в опубликованном расписании нет"
          hint="Данные берутся с rasp.sstu.ru и обновляются синхронизацией"
        />
      ) : (
        <div className="grid gap-4">
          {byDate.map(([date, list]) => (
            <div key={date} className="grid gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {weekdayName(date)}, {fmtDate(date)}
                </h3>
                {date === today && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">сегодня</span>
                )}
                <span className="text-xs text-muted-foreground">{list.length} занятий</span>
              </div>

              {list.map((r) => {
                const t = pairTime(r.pairNumber)
                const canReplace = r.own && !r.searching && !r.replacedBy
                return (
                  <Card
                    key={r.key}
                    className={`py-0 ${r.coveringFor ? 'border-green-400 bg-green-50' : r.replacedBy ? 'border-stone-300' : ''}`}
                  >
                    <CardContent className="flex items-start gap-3 p-3">
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
                        <span className="text-[10px] text-muted-foreground">пара</span>
                        <span className="text-base leading-none font-semibold">{r.pairNumber}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {t.start}–{t.end}
                          </span>
                          {r.kind && <KindBadge kind={r.kind} />}
                        </div>
                        <p className={`mt-1 text-sm font-medium leading-snug ${r.replacedBy ? 'line-through decoration-foreground/50' : ''}`}>
                          {r.discipline}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.groupId ? `группа ${r.groupId}` : ''}
                          {r.room ? `${r.groupId ? ' · ' : ''}ауд. ${r.room}` : ''}
                        </p>

                        {r.searching && (
                          <p className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Идёт поиск замены
                          </p>
                        )}
                        {r.replacedBy && (
                          <p className="mt-2 inline-flex rounded-full border border-green-400 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                            Вас заменяют — {r.replacedBy}
                          </p>
                        )}
                        {r.coveringFor && (
                          <p className="mt-2 inline-flex rounded-full border border-green-400 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">
                            Замена — {r.coveringFor}
                          </p>
                        )}
                      </div>

                      {canReplace && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() =>
                            setWizard({
                              date: r.date,
                              pair: r.pairNumber,
                              lesson: {
                                pairNumber: r.pairNumber,
                                start: '',
                                end: '',
                                discipline: r.discipline,
                                kind: r.kind,
                                groupId: r.groupId,
                                room: r.room || null,
                              },
                            })
                          }
                        >
                          Замена
                        </Button>
                      )}

                      {r.searching && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={cancelling}
                          onClick={() => void cancelSearch(r.date, r.pairNumber)}
                        >
                          <SearchX aria-hidden />
                          Отменить
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {wizard && (
        <ReplacementWizard
          date={wizard.date}
          pair={wizard.pair}
          lesson={wizard.lesson}
          onClose={() => setWizard(null)}
          onCreated={() => {
            setWizard(null)
            // даём запросу закрепиться в базе
            setTimeout(() => void load(), 400)
          }}
        />
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
        body: {
          date,
          pairNumber: pair,
          candidateIds: selected,
          discipline: lesson.discipline,
          groupId: lesson.groupId,
          kind: lesson.kind,
          room: lesson.room ?? '',
        },
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
            {lesson.discipline}
            {lesson.kind ? ` (${lesson.kind})` : ''}, группа {lesson.groupId}
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
