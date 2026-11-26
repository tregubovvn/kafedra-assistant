'use client'

// Журнал работ кафедры: фильтры, карточки и редактирование (включая DeepSeek)

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { WORK_TYPE_LABEL, WORK_TYPES } from '@/lib/schedule'
import type { AppUser, WorkItem } from '@/lib/types'
import { EmptyState, Spinner } from '@/components/app/bits'
import { WorkCard, WorkDialog } from '@/components/app/teacher/works-tab'

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
            <WorkCard
              key={w.id}
              work={w}
              showAuthor
              onEdit={() => {
                setEditing(w)
                setOpen(true)
              }}
            />
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
