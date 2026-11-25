'use client'

// Вкладка «Работа» заведующего: журнал работ всех преподавателей с фильтрами

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { WORK_TYPES, WORK_TYPE_LABEL, fmtDate, weekdayName } from '@/lib/schedule'
import type { AppUser, WorkItem } from '@/lib/types'
import { EmptyState, Spinner, WorkTypeBadge } from '@/components/app/bits'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export function HeadWorksTab() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [works, setWorks] = useState<WorkItem[] | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [teacherId, setTeacherId] = useState('all')
  const [month, setMonth] = useState('all')
  const [type, setType] = useState('all')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const filterKey = `${teacherId}|${month}|${type}`

  useEffect(() => {
    void api<{ users: AppUser[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]))
  }, [])

  const monthOptions = useMemo(() => {
    const now = new Date()
    const opts: { value: string; label: string }[] = []
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      })
    }
    return opts
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (teacherId !== 'all') params.set('teacherId', teacherId)
    if (month !== 'all') params.set('month', month)
    if (type !== 'all') params.set('type', type)
    api<{ works: WorkItem[] }>(`/api/works?${params.toString()}`).then(
      (res) => {
        if (cancelled) return
        setWorks(res.works)
        setLoadedKey(filterKey)
      },
      (e) => {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить журнал')
        setWorks([])
        setLoadedKey(filterKey)
      }
    )
    return () => {
      cancelled = true
    }
  }, [teacherId, month, type, filterKey, reloadKey])

  return (
    <div className="grid gap-4">
      <Card className="py-0">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Преподаватель</Label>
            <Select
              value={teacherId}
              onValueChange={(v) => {
                setTeacherId(v)
                reload()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все преподаватели</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Месяц</Label>
            <Select
              value={month}
              onValueChange={(v) => {
                setMonth(v)
                reload()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все месяцы</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Вид работы</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v)
                reload()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все виды</SelectItem>
                {WORK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WORK_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-medium">Журнал работ</p>
            {works && <span className="text-xs text-muted-foreground">Найдено: {works.length}</span>}
          </div>
          {works === null || loadedKey !== filterKey ? (
            <Spinner label="Загрузка…" />
          ) : works.length === 0 ? (
            <EmptyState title="Записей не найдено" hint="Измените фильтры" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Дата</TableHead>
                    <TableHead className="w-56">Преподаватель</TableHead>
                    <TableHead className="w-52">Вид работы</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead className="w-28">Новость</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {works.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{fmtDate(w.date)}</span>
                          <span className="text-xs text-muted-foreground">{weekdayName(w.date).toLowerCase()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{w.userFullName}</TableCell>
                      <TableCell>
                        <WorkTypeBadge type={w.type} />
                        {w.autoGenerated && (
                          <span className="ml-1.5 rounded-full border border-green-400 bg-green-50 px-2 py-0.5 text-xs text-green-800">
                            замена
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">{w.description}</TableCell>
                      <TableCell>
                        {w.newsUrl ? (
                          <a
                            href={w.newsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                            aria-label="Открыть новость"
                          >
                            <ArrowUpRight className="size-4" aria-hidden />
                            открыть
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
