'use client'

// Журнал работ кафедры: фильтры и карточки с редактированием (включая DeepSeek)

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, WORK_TYPE_LABEL, WORK_TYPES } from '@/lib/schedule'
import type { AppUser, WorkItem } from '@/lib/types'
import { EmptyState, Spinner, WorkTypeBadge } from '@/components/app/bits'
import { WorkDialog } from '@/components/app/teacher/works-tab'

export function HeadWorksTab() {
  const [items, setItems] = useState<WorkItem[] | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [teacherId, setTeacherId] = useState('')
  const [month, setMonth] = useState('')
  const [type, setType] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WorkItem | null>(null)

  useEffect(() => {
    void api<{ users: AppUser[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]))
  }, [])

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams()
      if (teacherId) sp.set('teacherId', teacherId)
      if (month) sp.set('month', month)
      if (type) sp.set('type', type)
      const res = await api<{ works: WorkItem[] }>(`/api/works?${sp.toString()}`)
      setItems(res.works)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить журнал')
      setItems([])
    }
  }, [teacherId, month, type])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Преподаватель</span>
          <select
            className="h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">Все преподаватели</option>
            {users
              .filter((u) => u.role === 'TEACHER')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
          </select>
        </div>

        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Месяц</span>
          <Input type="month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Вид работы</span>
          <select
            className="h-9 min-w-52 rounded-md border border-input bg-transparent px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Все виды</option>
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORK_TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setTeacherId('')
            setMonth('')
            setType('')
          }}
        >
          Сбросить
        </Button>
      </div>

      {items === null ? (
        <Spinner label="Загрузка…" />
      ) : items.length === 0 ? (
        <EmptyState title="Работ не найдено" hint="Измените фильтры или добавьте работу" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((w) => (
            <Card key={w.id} className="py-0">
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{w.title || w.description.slice(0, 60)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {w.userFullName} · {fmtDate(w.date)}
                    </p>
                  </div>
                  <WorkTypeBadge type={w.type} />
                </div>

                <p className="text-sm whitespace-pre-line">{w.description}</p>

                {w.authorDescription && w.authorDescription !== w.description && (
                  <div className="rounded-lg border border-dashed p-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Описание автора
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line">{w.authorDescription}</p>
                  </div>
                )}

                {w.newsUrl && (
                  <a className="text-xs text-primary underline underline-offset-2" href={w.newsUrl} target="_blank" rel="noreferrer">
                    Ссылка на новость
                  </a>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(w)
                      setOpen(true)
                    }}
                  >
                    <Pencil aria-hidden />
                    Редактировать
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WorkDialog
        open={open}
        item={editing}
        headMode
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          void load()
        }}
      />
    </div>
  )
}
