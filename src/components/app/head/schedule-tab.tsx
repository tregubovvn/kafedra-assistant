'use client'

// Вкладка «Расписание» заведующего: по преподавателю или группе, дата или день недели

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { addDaysStr, fmtDate, pairTime, todayStr, weekdayIndex, weekdayName, WEEKDAYS } from '@/lib/schedule'
import type { AppUser, ScheduleLesson } from '@/lib/types'
import { EmptyState, KindBadge, Spinner } from '@/components/app/bits'

type ObjMode = 'teacher' | 'group'
type DateMode = 'date' | 'weekday'

export function HeadScheduleTab() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [objMode, setObjMode] = useState<ObjMode>('teacher')
  const [teacherId, setTeacherId] = useState<string>('')
  const [group, setGroup] = useState<string>('')
  const [dateMode, setDateMode] = useState<DateMode>('date')
  const [date, setDate] = useState(todayStr())
  const [weekday, setWeekday] = useState('0')
  const [lessons, setLessons] = useState<ScheduleLesson[] | null>(null)
  const [loadedKey, setLoadedKey] = useState('')

  useEffect(() => {
    void api<{ users: AppUser[] }>('/api/users')
      .then((r) => {
        setUsers(r.users)
        setTeacherId(String(r.users[0]?.id ?? ''))
      })
      .catch(() => toast.error('Не удалось загрузить список преподавателей'))
    void api<{ groups: string[] }>('/api/schedule?list=groups')
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]))
  }, [])

  // Ближайшая дата выбранного дня недели
  const effectiveDate = useMemo(() => {
    if (dateMode === 'date') return date
    const today = todayStr()
    const wd = Number(weekday)
    for (let i = 0; i < 7; i++) {
      const d = addDaysStr(today, i)
      if (weekdayIndex(d) === wd) return d
    }
    return today
  }, [dateMode, date, weekday])

  const targetId = objMode === 'teacher' ? teacherId : group
  const currentKey = `${objMode}|${targetId}|${effectiveDate}`

  useEffect(() => {
    if (!targetId) return
    let cancelled = false
    api<{ lessons: ScheduleLesson[] }>(
      `/api/schedule?mode=${objMode}&id=${encodeURIComponent(targetId)}&date=${effectiveDate}`
    ).then(
      (res) => {
        if (cancelled) return
        setLessons(res.lessons)
        setLoadedKey(currentKey)
      },
      (e) => {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить расписание')
        setLessons([])
        setLoadedKey(currentKey)
      }
    )
    return () => {
      cancelled = true
    }
  }, [objMode, targetId, effectiveDate, currentKey])

  const objectName = objMode === 'teacher' ? users.find((u) => String(u.id) === teacherId)?.fullName : group

  return (
    <div className="grid gap-4">
      <Card className="py-0">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_1fr_1.2fr] md:items-end">
          <div className="grid gap-1.5">
            <Label>Кого смотрим</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={objMode === 'teacher' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setObjMode('teacher')}
              >
                Преподаватель
              </Button>
              <Button variant={objMode === 'group' ? 'default' : 'outline'} size="sm" onClick={() => setObjMode('group')}>
                Группа
              </Button>
            </div>
          </div>

          {objMode === 'teacher' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="hs-teacher">Преподаватель</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger id="hs-teacher">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullName}
                      {u.role === 'HEAD' ? ' (зав.)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="hs-group">Группа</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger id="hs-group">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Период</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant={dateMode === 'date' ? 'default' : 'outline'} size="sm" onClick={() => setDateMode('date')}>
                  Дата
                </Button>
                <Button variant={dateMode === 'weekday' ? 'default' : 'outline'} size="sm" onClick={() => setDateMode('weekday')}>
                  День недели
                </Button>
              </div>
              {dateMode === 'date' ? (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" aria-label="Предыдущий день" onClick={() => setDate(addDaysStr(date, -1))}>
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Input
                    type="date"
                    className="w-40"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Дата"
                  />
                  <Button variant="outline" size="icon" aria-label="Следующий день" onClick={() => setDate(addDaysStr(date, 1))}>
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-44">
                    <Select value={weekday} onValueChange={setWeekday}>
                      <SelectTrigger aria-label="День недели">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.slice(0, 6).map((d, i) => (
                          <SelectItem key={d} value={String(i)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-muted-foreground">ближайшая дата: {fmtDate(effectiveDate)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <p className="text-sm font-medium">
              {objectName ?? '—'} · {weekdayName(effectiveDate)}, {fmtDate(effectiveDate)}
            </p>
            {lessons && <span className="text-xs text-muted-foreground">{lessons.length} занятий</span>}
          </div>
          {lessons === null || loadedKey !== currentKey ? (
            <Spinner label="Загрузка расписания…" />
          ) : lessons.length === 0 ? (
            <EmptyState title="Занятий в этот день нет" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Пара</TableHead>
                  <TableHead className="w-32">Время</TableHead>
                  <TableHead>Дисциплина</TableHead>
                  <TableHead className="w-16">Тип</TableHead>
                  <TableHead>{objMode === 'teacher' ? 'Группа' : 'Преподаватель'}</TableHead>
                  <TableHead className="w-20">Ауд.</TableHead>
                  <TableHead className="w-56">Замена</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((l, i) => {
                  const t = pairTime(l.pairNumber)
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{l.pairNumber}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.start}–{t.end}
                      </TableCell>
                      <TableCell className="font-medium">
                        {l.discipline}
                        {l.isSubstitution && (
                          <span className="ml-2 rounded-full border border-green-400 bg-green-50 px-2 py-0.5 text-xs text-green-800">
                            замена
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <KindBadge kind={l.kind} />
                      </TableCell>
                      <TableCell>{objMode === 'teacher' ? l.groupId : l.teacherName ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{l.room ?? '—'}</TableCell>
                      <TableCell>
                        {l.replacedBy ? (
                          <span className="rounded-full border border-green-400 bg-green-50 px-2 py-0.5 text-xs text-green-800">
                            заменяет {l.replacedBy}
                          </span>
                        ) : l.searching ? (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                            идёт поиск замены
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
