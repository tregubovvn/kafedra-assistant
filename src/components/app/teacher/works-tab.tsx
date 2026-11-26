'use client'

// Журнал работ преподавателя: карточки; при добавлении — только авторское описание,
// ссылка на новость, дата и вид работы

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { fmtDate, todayStr, WORK_TYPE_LABEL, WORK_TYPES } from '@/lib/schedule'
import type { WorkItem } from '@/lib/types'
import { EmptyState, Spinner, WorkTypeBadge } from '@/components/app/bits'

export function WorksTab() {
  const [items, setItems] = useState<WorkItem[] | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WorkItem | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<{ works: WorkItem[] }>('/api/works?mine=1')
      setItems(res.works)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить работы')
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section aria-label="Журнал работ" className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items ? `${items.length} записей` : ''}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus aria-hidden />
          Добавить работу
        </Button>
      </div>

      {items === null ? (
        <Spinner label="Загрузка…" />
      ) : items.length === 0 ? (
        <EmptyState title="Журнал пуст" hint="Зафиксируйте первую выполненную работу" />
      ) : (
        items.map((w) => (
          <WorkCard
            key={w.id}
            work={w}
            onEdit={() => {
              setEditing(w)
              setOpen(true)
            }}
          />
        ))
      )}

      <AuthorWorkDialog
        open={open}
        item={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          void load()
        }}
      />
    </section>
  )
}

// Карточка работы — общая для преподавателя и заведующего
export function WorkCard({
  work: w,
  onEdit,
  showAuthor = false,
}: {
  work: WorkItem
  onEdit: () => void
  showAuthor?: boolean
}) {
  const heading = w.title || w.authorDescription || w.description
  const authorText = w.authorDescription.trim()
  const officialText = w.description.trim()
  const sameText = !authorText || !officialText || authorText === officialText

  return (
    <Card className="py-0">
      <CardContent className="grid gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{heading}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {showAuthor ? `${w.userFullName} · ` : ''}
              {fmtDate(w.date)}
            </p>
          </div>
          <WorkTypeBadge type={w.type} />
        </div>

        {!sameText && officialText && <p className="text-sm whitespace-pre-line">{officialText}</p>}

        {!sameText && authorText && (
          <div className="rounded-lg border border-dashed p-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Описание автора</p>
            <p className="mt-1 text-sm whitespace-pre-line">{authorText}</p>
          </div>
        )}

        {w.newsUrl && (
          <a className="text-xs text-primary underline underline-offset-2" href={w.newsUrl} target="_blank" rel="noreferrer">
            Ссылка на новость
          </a>
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Редактировать
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Форма автора: описание создателя (оно же название), ссылка на новость, дата и вид работы
function AuthorWorkDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean
  item: WorkItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(item)
  const [authorDescription, setAuthorDescription] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('TEACHING')
  const [newsUrl, setNewsUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAuthorDescription(item?.authorDescription || item?.description || '')
    setDate(item?.date ?? todayStr())
    setType(item?.type ?? 'TEACHING')
    setNewsUrl(item?.newsUrl ?? '')
  }, [open, item])

  async function save() {
    setSaving(true)
    try {
      const title = authorDescription.split('\n')[0].slice(0, 120).trim()
      const body = {
        title,
        authorDescription,
        description: item?.description || authorDescription,
        date,
        type,
        newsUrl: newsUrl || null,
      }
      if (isEdit && item) {
        await api(`/api/works/${item.id}`, { method: 'PATCH', body })
        toast.success('Работа обновлена')
      } else {
        await api('/api/works', { method: 'POST', body })
        toast.success('Работа добавлена в журнал')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить работу')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать работу' : 'Новая работа'}</DialogTitle>
          <DialogDescription>
            Опишите работу своими словами — этот текст станет названием карточки.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="aw-author">Описание работы создателем (используется как название)</Label>
            <Textarea
              id="aw-author"
              rows={4}
              value={authorDescription}
              onChange={(e) => setAuthorDescription(e.target.value)}
              placeholder="Например: проведено практическое занятие по экономической теории для группы б1-МЕНЖ-11"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="aw-news">Ссылка на новость</Label>
            <Input id="aw-news" value={newsUrl} onChange={(e) => setNewsUrl(e.target.value)} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="aw-date">Дата выполнения</Label>
              <Input id="aw-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aw-type">Вид работы</Label>
              <select
                id="aw-type"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={saving || authorDescription.trim().length < 3 || !date} onClick={() => void save()}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Форма заведующего: полное редактирование, включая официальное описание и DeepSeek
export function WorkDialog({
  open,
  item,
  onClose,
  onSaved,
  headMode = false,
}: {
  open: boolean
  item: WorkItem | null
  onClose: () => void
  onSaved: () => void
  headMode?: boolean
}) {
  const isEdit = Boolean(item)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('TEACHING')
  const [description, setDescription] = useState('')
  const [authorDescription, setAuthorDescription] = useState('')
  const [newsUrl, setNewsUrl] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setDate(item?.date ?? todayStr())
    setType(item?.type ?? 'TEACHING')
    setDescription(item?.description ?? '')
    setAuthorDescription(item?.authorDescription ?? '')
    setNewsUrl(item?.newsUrl ?? '')
  }, [open, item])

  async function improve() {
    if (description.trim().length < 3) {
      toast.error('Сначала напишите описание')
      return
    }
    setAiLoading(true)
    try {
      const res = await api<{ text: string }>('/api/deepseek/assist', {
        method: 'POST',
        body: { draft: description },
      })
      setDescription(res.text)
      toast.success('Описание обновлено через DeepSeek')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'DeepSeek недоступен')
    } finally {
      setAiLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const body = { title, date, type, description, authorDescription, newsUrl: newsUrl || null }
      if (isEdit && item) {
        await api(`/api/works/${item.id}`, { method: 'PATCH', body })
        toast.success('Работа обновлена')
      } else {
        await api('/api/works', { method: 'POST', body })
        toast.success('Работа добавлена в журнал')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить работу')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать работу' : 'Новая работа'}</DialogTitle>
          <DialogDescription>
            {headMode
              ? 'Заведующий может уточнить описание работы — в том числе через DeepSeek.'
              : 'Название, описание, авторская формулировка и дата выполнения.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="w-title">Название работы</Label>
            <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="w-date">Дата выполнения</Label>
              <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="w-type">Вид работы</Label>
              <select
                id="w-type"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="w-desc">Описание работы</Label>
            <Textarea id="w-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            {headMode && (
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" disabled={aiLoading} onClick={() => void improve()}>
                  <Sparkles aria-hidden />
                  {aiLoading ? 'DeepSeek…' : 'Улучшить через DeepSeek'}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="w-author">Описание работы создателем (как написал автор)</Label>
            <Textarea
              id="w-author"
              rows={3}
              value={authorDescription}
              onChange={(e) => setAuthorDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="w-news">Ссылка на новость (необязательно)</Label>
            <Input id="w-news" value={newsUrl} onChange={(e) => setNewsUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={saving || title.trim().length < 3 || description.trim().length < 3 || !date}
            onClick={() => void save()}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
