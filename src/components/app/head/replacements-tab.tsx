'use client'

// Вкладка «Замены» заведующего: все текущие замены, статусы поиска,
// ручное назначение и экспорт в CSV.

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, pairTime, REQUEST_STATUS_LABEL, weekdayName } from '@/lib/schedule'
import type { AppUser, ReplacementItem } from '@/lib/types'
import { EmptyState, ReplacementStatusBadge, Spinner } from '@/components/app/bits'

export function HeadReplacementsTab() {
  const [items, setItems] = useState<ReplacementItem[] | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [details, setDetails] = useState<ReplacementItem | null>(null)
  const [assignFor, setAssignFor] = useState<ReplacementItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    api<{ replacements: ReplacementItem[] }>('/api/replacements').then(
      (res) => {
        if (!cancelled) setItems(res.replacements)
      },
      (e) => {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить замены')
        setItems([])
      }
    )
    void api<{ users: AppUser[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function exportCsv() {
    if (!items || items.length === 0) {
      toast.error('Нет данных для экспорта')
      return
    }
    const header = ['Дисциплина', 'Дата', 'День недели', 'Время', 'Пара', 'Группа', 'Аудитория', 'Ведёт', 'Заменяет', 'Способ подбора', 'Статус']
    const rows = items.map((r) => {
      const t = pairTime(r.pairNumber)
      return [
        r.discipline,
        fmtDate(r.lessonDate),
        weekdayName(r.lessonDate),
        `${t.start}–${t.end}`,
        String(r.pairNumber),
        r.groupId,
        r.room ?? '',
        r.initiatorFullName,
        r.substituteFullName ?? '',
        r.assignedByHead ? 'Назначена заведующим' : 'По согласию',
        r.status === 'FOUND' ? 'Замена подобрана' : 'Поиск преподавателя',
      ]
    })
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zameny_kafedry_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV выгружен (UTF-8, разделитель «;» — откроется в Excel)')
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items
            ? `${items.filter((r) => r.status === 'SEARCHING').length} в поиске · ${items.filter((r) => r.status === 'FOUND').length} подобрано`
            : ''}
        </p>
        <Button variant="outline" onClick={exportCsv}>
          <Download aria-hidden />
          Экспорт в CSV
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {items === null ? (
            <Spinner label="Загрузка замен…" />
          ) : items.length === 0 ? (
            <EmptyState title="Замен нет" hint="Когда преподаватели начнут искать замены, они появятся здесь" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3">Дисциплина</TableHead>
                    <TableHead className="px-3">Дата и время</TableHead>
                    <TableHead className="px-3">Группа</TableHead>
                    <TableHead className="px-3">Ведёт</TableHead>
                    <TableHead className="px-3">Заменяет</TableHead>
                    <TableHead className="px-3">Статус</TableHead>
                    <TableHead className="px-3 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => {
                    const t = pairTime(r.pairNumber)
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetails(r)}>
                        <TableCell className="max-w-[240px] px-3 font-medium">
                          {r.discipline} <span className="text-xs text-muted-foreground">({r.kind})</span>
                        </TableCell>
                        <TableCell className="px-3">
                          <span className="whitespace-nowrap">{fmtDate(r.lessonDate)}, {weekdayName(r.lessonDate).slice(0, 3).toLowerCase()}.</span>
                          <span className="block whitespace-nowrap text-xs text-muted-foreground">
                            {r.pairNumber} пара · {t.start}–{t.end}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 text-nowrap">{r.groupId}</TableCell>
                        <TableCell className="max-w-[180px] px-3">{r.initiatorFullName}</TableCell>
                        <TableCell className="max-w-[180px] px-3">
                          {r.substituteFullName ? (
                            <span>
                              {r.substituteFullName}
                              {r.assignedByHead && <span className="ml-1 text-xs text-muted-foreground">(назначено)</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 whitespace-nowrap">
                          <ReplacementStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {r.status === 'SEARCHING' ? (
                            <Button size="sm" variant="outline" onClick={() => setAssignFor(r)}>
                              <UserCog aria-hidden />
                              Назначить
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {details && (
        <Dialog open onOpenChange={(o) => (!o ? setDetails(null) : undefined)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{details.discipline}</DialogTitle>
              <DialogDescription>
                {details.kind}, группа {details.groupId}, ауд. {details.room ?? '—'}
                <br />
                {weekdayName(details.lessonDate)}, {fmtDate(details.lessonDate)}, {details.pairNumber}-я пара (
                {pairTime(details.pairNumber).start}–{pairTime(details.pairNumber).end})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <p>
                <span className="text-muted-foreground">Ведёт:</span> {details.initiatorFullName}
              </p>
              <p>
                <span className="text-muted-foreground">Заменяет:</span>{' '}
                {details.substituteFullName ?? 'ещё не найден'}
              </p>
              <p>
                <span className="text-muted-foreground">Статус:</span> <ReplacementStatusBadge status={details.status} />
              </p>
              <div>
                <p className="mb-1.5 text-muted-foreground">Просьбы о замене:</p>
                <div className="grid gap-1">
                  {details.requests.length === 0 && <p className="text-sm text-muted-foreground">Не отправлялись</p>}
                  {details.requests.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span>{q.teacherFullName}</span>
                      <span
                        className={`text-xs font-medium ${
                          q.status === 'ACCEPTED'
                            ? 'text-green-700'
                            : q.status === 'PENDING'
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {REQUEST_STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              {details.status === 'SEARCHING' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssignFor(details)
                    setDetails(null)
                  }}
                >
                  <UserCog aria-hidden />
                  Назначить вручную
                </Button>
              )}
              <Button variant="secondary" onClick={() => setDetails(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {assignFor && (
        <AssignDialog
          replacement={assignFor}
          users={users}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function AssignDialog({
  replacement,
  users,
  onClose,
  onAssigned,
}: {
  replacement: ReplacementItem
  users: AppUser[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [teacherId, setTeacherId] = useState('')
  const [saving, setSaving] = useState(false)
  const candidates = users.filter((u) => u.id !== replacement.initiatorId)

  async function assign() {
    if (!teacherId) return
    setSaving(true)
    try {
      await api(`/api/replacements/${replacement.id}/assign`, {
        method: 'POST',
        body: { teacherId: Number(teacherId) },
      })
      toast.success('Замена назначена. Преподавателю добавлена работа в журнал.')
      onAssigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось назначить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить замену вручную</DialogTitle>
          <DialogDescription>
            {replacement.discipline}, группа {replacement.groupId}, {fmtDate(replacement.lessonDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="assign-teacher">Преподаватель</Label>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger id="assign-teacher">
              <SelectValue placeholder="Выберите" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.fullName}
                  {u.role === 'HEAD' ? ' (зав.)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Занятость проверяется автоматически: если у преподавателя есть занятие в это время, назначение не пройдёт.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void assign()} disabled={!teacherId || saving}>
            {saving ? 'Назначение…' : 'Назначить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
