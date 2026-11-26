'use client'

// Поручения заведующего: карточка-таблица и редактирование всех полей

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Plus, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, fmtDateTime, todayStr } from '@/lib/schedule'
import type { AppUser, AssignmentItem } from '@/lib/types'
import { EmptyState, Spinner, UrgencyBadge, UrgencyLegend } from '@/components/app/bits'

export function HeadAssignmentsTab() {
  const [items, setItems] = useState<AssignmentItem[] | null>(null)
  const [teachers, setTeachers] = useState<AppUser[]>([])
  const [editing, setEditing] = useState<AssignmentItem | null>(null)
  const [open, setOpen] = useState(false)
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
    void api<{ users: AppUser[] }>('/api/users')
      .then((r) => setTeachers(r.users.filter((u) => u.role === 'TEACHER')))
      .catch(() => setTeachers([]))
  }, [load])

  const { active, done } = useMemo(() => {
    const a: AssignmentItem[] = []
    const d: AssignmentItem[] = []
    for (const it of items ?? []) {
      const allDone = it.statuses.length > 0 && it.statuses.every((s) => s.completed)
      if (allDone || it.dueDate < today) d.push(it)
      else a.push(it)
    }
    a.sort((x, y) => x.dueDate.localeCompare(y.dueDate))
    return { active: a, done: d }
  }, [items, today])

  function Row({ it }: { it: AssignmentItem }) {
    const [expanded, setExpanded] = useState(false)
    const notDone = it.statuses.filter((s) => !s.completed)
    const doneCount = it.statuses.length - notDone.length
    return (
      <>
        <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <TableCell className="max-w-md">
            <p className="font-medium leading-snug">{it.title || it.description.slice(0, 60)}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.description}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {it.forAll ? 'Всем преподавателям' : `Избранным (${it.statuses.length})`}
            </p>
          </TableCell>
          <TableCell>
            <div className="flex flex-col items-start gap-1">
              <UrgencyBadge dueDate={it.dueDate} />
              <span className="text-xs text-muted-foreground">
                до {fmtDate(it.dueDate)}{it.dueTime ? `, ${it.dueTime}` : ''}
              </span>
            </div>
          </TableCell>
          <TableCell className="text-xs">
            {it.requireResult ? 'обязателен' : '—'}
          </TableCell>
          <TableCell>
            {it.statuses.length === 0 ? (
              '—'
            ) : (
              <div className="flex flex-col gap-1">
                <span className={`text-sm font-medium ${doneCount === it.statuses.length ? 'text-green-700' : ''}`}>
                  {doneCount} из {it.statuses.length}
                </span>
                {notDone.length > 0 && (
                  <span className="text-xs text-red-700">не выполнили: {notDone.length}</span>
                )}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(it)
                setOpen(true)
              }}
            >
              <Pencil aria-hidden />
              Изменить
            </Button>
          </TableCell>
        </TableRow>
        {expanded && (
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={5}>
              <div className="grid gap-2 py-1 sm:grid-cols-2 lg:grid-cols-3">
                {it.completionCriteria && (
                  <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                    <span className="font-medium text-foreground">Что сделать: </span>
                    {it.completionCriteria}
                  </p>
                )}
                {it.statuses.map((s) => (
                  <span
                    key={s.teacherId}
                    className={`inline-flex flex-col gap-0.5 rounded-md border px-2 py-1 text-xs ${
                      s.completed ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      {s.teacherFullName}
                      <span className="ml-auto shrink-0 font-medium">{s.completed ? 'выполнил' : 'не выполнил'}</span>
                    </span>
                    {s.completed && s.completedAt && (
                      <span className="text-[11px] opacity-80">{fmtDateTime(s.completedAt)}</span>
                    )}
                    {s.result && <span className="text-[11px] opacity-80">Результат: {s.result}</span>}
                  </span>
                ))}
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UrgencyLegend />
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus aria-hidden />
          Создать поручение
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Активные {active.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{active.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="done">Завершённые</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="py-0">
            <CardContent className="p-0">
              {items === null ? (
                <Spinner label="Загрузка…" />
              ) : active.length === 0 ? (
                <EmptyState title="Активных поручений нет" hint="Создайте первое поручение кнопкой выше" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Поручение</TableHead>
                      <TableHead>Срок</TableHead>
                      <TableHead>Результат</TableHead>
                      <TableHead>Исполнение</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((it) => (
                      <Row key={it.id} it={it} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="done">
          <Card className="py-0">
            <CardContent className="p-0">
              {items === null ? (
                <Spinner label="Загрузка…" />
              ) : done.length === 0 ? (
                <EmptyState title="Завершённых поручений нет" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Поручение</TableHead>
                      <TableHead>Срок</TableHead>
                      <TableHead>Результат</TableHead>
                      <TableHead>Исполнение</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {done.map((it) => (
                      <Row key={it.id} it={it} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssignmentDialog
        open={open}
        item={editing}
        teachers={teachers}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function AssignmentDialog({
  open,
  item,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean
  item: AssignmentItem | null
  teachers: AppUser[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(item)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [requireResult, setRequireResult] = useState(false)
  const [forAll, setForAll] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setDescription(item?.description ?? '')
    setCriteria(item?.completionCriteria ?? '')
    setDueDate(item?.dueDate ?? '')
    setDueTime(item?.dueTime ?? '')
    setRequireResult(item?.requireResult ?? false)
    setForAll(item?.forAll ?? true)
    setSelected(item ? item.statuses.map((s) => s.teacherId) : [])
  }, [open, item])

  async function improve() {
    if (description.trim().length < 3) {
      toast.error('Сначала напишите черновик описания')
      return
    }
    setAiLoading(true)
    try {
      const res = await api<{ text: string }>('/api/deepseek/assist', {
        method: 'POST',
        body: { draft: description },
      })
      setDescription(res.text)
      toast.success('Формулировка обновлена через DeepSeek')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'DeepSeek недоступен')
    } finally {
      setAiLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      if (isEdit && item) {
        await api(`/api/assignments/${item.id}`, {
          method: 'PATCH',
          body: { title, description, completionCriteria: criteria, dueDate, dueTime, requireResult },
        })
        toast.success('Поручение обновлено')
      } else {
        await api('/api/assignments', {
          method: 'POST',
          body: { title, description, completionCriteria: criteria, dueDate, dueTime, requireResult, forAll, teacherIds: forAll ? [] : selected },
        })
        toast.success(forAll ? 'Поручение отправлено всем преподавателям' : `Поручение отправлено (${selected.length})`)
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить поручение')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать поручение' : 'Новое поручение'}</DialogTitle>
          <DialogDescription>
            Название, описание, критерии завершения и срок с точностью до времени.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="a-title">Название поручения</Label>
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Сведения об успеваемости" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="a-desc">Описание поручения</Label>
            <Textarea id="a-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" disabled={aiLoading} onClick={() => void improve()}>
                <Sparkles aria-hidden />
                {aiLoading ? 'DeepSeek…' : 'Улучшить через DeepSeek'}
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="a-criteria">Что конкретно сделать, чтобы завершить</Label>
            <Textarea id="a-criteria" rows={2} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-date">Срок: дата</Label>
              <Input id="a-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-time">Срок: время</Label>
              <Input id="a-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={requireResult}
              onChange={(e) => setRequireResult(e.target.checked)}
            />
            Обязательно описать результат при отметке «Выполнено»
          </label>

          {!isEdit && (
            <div className="grid gap-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={forAll} onChange={(e) => setForAll(e.target.checked)} />
                Всем преподавателям
              </label>
              {!forAll && (
                <div className="grid max-h-40 gap-1 overflow-y-auto">
                  {teachers.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selected.includes(t.id)}
                        onChange={(e) =>
                          setSelected((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                        }
                      />
                      {t.fullName}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving || title.trim().length < 3 || !dueDate}
            onClick={() => void save()}
          >
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
