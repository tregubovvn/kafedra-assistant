'use client'

// Вкладка «Почта (исходящие)»: журнал писем прототипа и демо-триггер напоминаний

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
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import { MAIL_TYPE_LABEL } from '@/lib/schedule'
import type { MailItem } from '@/lib/types'
import { EmptyState, Spinner } from '@/components/app/bits'

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const TYPE_CLASS: Record<string, string> = {
  ASSIGNMENT_NEW: 'border-green-300 bg-green-50 text-green-900',
  ASSIGNMENT_REMINDER: 'border-red-300 bg-red-50 text-red-800',
  REPLACEMENT_REQUEST: 'border-amber-300 bg-amber-50 text-amber-900',
  REPLACEMENT_FOUND: 'border-green-400 bg-green-100 text-green-900',
  REPLACEMENT_ASSIGNED: 'border-green-400 bg-green-100 text-green-900',
  ACCOUNT_CREATED: 'border-stone-300 bg-stone-50 text-stone-700',
  PASSWORD_RESET: 'border-stone-300 bg-stone-50 text-stone-700',
}

export function HeadMailTab() {
  const [items, setItems] = useState<MailItem[] | null>(null)
  const [details, setDetails] = useState<MailItem | null>(null)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: MailItem[] }>('/api/mail')
      setItems(res.items)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить журнал')
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function sendReminders() {
    setSending(true)
    try {
      const res = await api<{ sent: number }>('/api/mail', {
        method: 'POST',
        body: { action: 'send-reminders' },
      })
      toast.success(res.sent > 0 ? `Напоминания добавлены: ${res.sent}` : 'Нет поручений со сроком «сегодня» и неисполненных')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить напоминания')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          В прототипе письма не отправляются, а фиксируются в журнале. При публикации на сервере подключается SMTP;
          напоминания о поручениях в последний день срока отправляются автоматически по расписанию (cron).
        </p>
        <Button variant="outline" onClick={() => void sendReminders()} disabled={sending}>
          <BellRing aria-hidden />
          {sending ? 'Отправка…' : 'Отправить напоминания (срок — сегодня)'}
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {items === null ? (
            <Spinner label="Загрузка журнала…" />
          ) : items.length === 0 ? (
            <EmptyState title="Журнал пуст" />
          ) : (
            <div className="max-h-[70vh] divide-y overflow-y-auto scroll-thin">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => setDetails(m)}
                >
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">{fmtDateTime(m.createdAt)}</span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TYPE_CLASS[m.type] ?? 'border-border bg-muted'}`}
                  >
                    {MAIL_TYPE_LABEL[m.type] ?? m.type}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.toName} · {m.toEmail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {details && (
        <Dialog open onOpenChange={(o) => (!o ? setDetails(null) : undefined)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{details.subject}</DialogTitle>
              <DialogDescription>
                {MAIL_TYPE_LABEL[details.type] ?? details.type} · {details.toName} ({details.toEmail}) ·{' '}
                {fmtDateTime(details.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
              {details.body}
            </div>
            <DialogFooter>
              <Button onClick={() => setDetails(null)}>Закрыть</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
