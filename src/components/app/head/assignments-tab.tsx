'use client'

// Вкладка «Поручения» заведующего: создание (с помощью DeepSeek) и контроль исполнения

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, todayStr } from '@/lib/schedule'
import type { AppUser, AssignmentItem } from '@/lib/types'
import { EmptyState, Spinner, UrgencyBadge, UrgencyLegend } from '@/components/app/bits'

export function HeadAssignmentsTab() {
  const [items, setItems] = useState<AssignmentItem[] | null>(null)
  const [teachers, setTeachers] = useState<AppUser[]>([])
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

  function Row({ it, isActive }: { it: AssignmentItem; isActive: boolean }) {
    const [expanded, setExpanded] = useState(false)
    const notDone = it.statuses.filter((s) => !s.completed)
    const doneCount = it.statuses.length - notDone.length
    return (
      <>
        <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
          <TableCell className="max-w-md">
            <p className="font-medium leading-snug">{it.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {it.forAll ? 'Всем преподавателям' : `Избранным (${it.statuses.length})`}
            </p>
          </TableCell>
          <TableCell>
            <div className="flex flex-col items-start gap-1">
              <UrgencyBadge dueDate={it.dueDate} />
              <span className="text-xs text-muted-foreground">до {fmtDate(it.dueDate)}</span>
            </div>
          </TableCell>
          <TableCell>
            {it.statuses.length === 0 ? (
              '—'
            ) : (
              <div className="flex flex-col gap-1">
                <span className={`text-sm font-medium ${doneCount === it.statuses.length ? 'text-green-700' : ''}`}>
                  {doneCount} из {it.statuses.length}
                </span>
                {isActive && notDone.length > 0 && (
                  <button
                    type="button"
                    className="text-left text-xs text-red-700 underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded((v) => !v)
                    }}
                  >
                    не выполнили: {notDone.length}
                  </button>
                )}
              </div>
            )}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{fmtDate(it.createdAt.slice(0, 10))}</TableCell>
        </TableRow>
        {expanded && (
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={4}>
              <div className="grid gap-1.5 py-1 sm:grid-cols-2 lg:grid-cols-3">
                {it.statuses.map((s) => (
                  <span key={s.teacherId} className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${s.completed ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
                    <Users className="size-3.5 shrink-0" aria-hidden />
                    {s.teacherFullName}
                    <span className="ml-auto shrink-0 font-medium">{s.completed ? 'выполнил' : 'не выполнил'}</span>
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
        <Button onClick={() => setOpen(true)}>
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
                      <TableHead>Срочность</TableHead>
                      <TableHead>Исполнение</TableHead>
                      <TableHead>Создано</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((it) => (
                      <Row key={it.id} it={it} isActive />
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
                      <TableHead>Исполнение</TableHead>
                      <TableHead>Создано</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {done.map((it) => (
                      <Row key={it.id} it={it} isActive={false} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateAssignmentDialog
        open={open}
        teachers={teachers}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function CreateAssignmentDialog({
  open,
  teachers,
  onClose,
  onCreated,
}: {
  open: boolean
  teachers: AppUser[]
  onClose: () => void
  onCreated: () => void
}) {
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [forAll, setForAll] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDescription('')
      setDueDate('')
      setForAll(true)
      setSelected([])
    }
  }, [open])

  async function improve() {
    if (description.trim().length < 3) {
      toast.error('Сначала напишите черновик поручения')
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
      await api('/api/assignments', {
        method: 'POST',
        body: { description, dueDate, forAll, teacherIds: forAll ? [] : selected },
      })
      toast.success(forAll ? 'Поручение отправлено всем преподавателям' : `Поручение отправлено (${selected.length})`)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать поручение')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новое поручение</DialogTitle>
          <DialogDescription>Опишите суть, установите срок и выберите адресатов</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="a-desc">Суть поручения</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={aiLoading}
                onClick={() => void improve()}
                title="Переписать черновик кратко и официально через DeepSeek"
              >
                <Sparkles aria-hidden />
                {aiLoading ? 'DeepSeek думает…' : 'Улучшить через DeepSeek'}
              </Button>
            </div>
            <Textarea
              id="a-desc"
              rows={3}
              placeholder="Например: подготовить отчёт по НИР за первое полугодие"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              DeepSeek перепишет черновик кратко и официально. Ключ задаётся во вкладке «Настройки».
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="a-due">Срок выполнения</Label>
            <Input id="a-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Кому адресовано</Label>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={forAll} onCheckedChange={(v) => setForAll(Boolean(v))} aria-label="Всем преподавателям" />
              <span className="text-sm font-medium">Всем преподавателям кафедры ({teachers.length})</span>
            </label>
            {!forAll && (
              <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border p-3 scroll-thin sm:grid-cols-2">
                {teachers.map((t) => (
                  <label key={t.id} className="flex min-h-9 items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={selected.includes(t.id)}
                      onCheckedChange={(v) => setSelected((prev) => (v ? [...prev, t.id] : prev.filter((x) => x !== t.id)))}
                      aria-label={`Выбрать ${t.fullName}`}
                    />
                    {t.fullName}
                  </label>
                ))}
                {teachers.length === 0 && <p className="text-sm text-muted-foreground">Список преподавателей загружается…</p>}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || description.trim().length < 5 || !dueDate || (!forAll && selected.length === 0)}
          >
            {saving ? 'Отправка…' : 'Отправить поручение'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
