'use client'

// Вкладка «Настройки» заведующего: преподаватели, ключ DeepSeek, источники расписаний

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Copy, KeyRound, Link2, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { AppUser } from '@/lib/types'
import { EmptyState, Spinner } from '@/components/app/bits'

export function HeadSettingsTab() {
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pwdDialog, setPwdDialog] = useState<{ name: string; password: string } | null>(null)
  const [deleteFor, setDeleteFor] = useState<AppUser | null>(null)

  // DeepSeek
  const [keySet, setKeySet] = useState(false)
  const [maskedKey, setMaskedKey] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const res = await api<{ users: (AppUser & { createdAt: string })[] }>('/api/users')
      setUsers(res.users)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить пользователей')
      setUsers([])
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<{ keySet: boolean; maskedKey: string }>('/api/settings')
      setKeySet(res.keySet)
      setMaskedKey(res.maskedKey)
    } catch {
      // не критично
    }
  }, [])

  useEffect(() => {
    void loadUsers()
    void loadSettings()
  }, [loadUsers, loadSettings])

  async function saveKey() {
    setSavingKey(true)
    try {
      const res = await api<{ keySet: boolean; maskedKey: string }>('/api/settings', {
        method: 'PUT',
        body: { deepseekApiKey: apiKey },
      })
      setKeySet(res.keySet)
      setMaskedKey(res.maskedKey)
      setApiKey('')
      toast.success(res.keySet ? 'Ключ DeepSeek сохранён' : 'Ключ DeepSeek удалён')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить ключ')
    } finally {
      setSavingKey(false)
    }
  }

  async function resetPassword(id: number, name: string) {
    try {
      const res = await api<{ password: string }>(`/api/users/${id}/reset-password`, { method: 'POST' })
      setPwdDialog({ name, password: res.password })
      toast.success('Пароль сброшен, письмо добавлено в журнал «Почта»')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сбросить пароль')
    }
  }

  async function deleteUser(u: AppUser) {
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      toast.success(`${u.fullName} удалён(а)`)
      setDeleteFor(null)
      void loadUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Преподаватели кафедры</CardTitle>
            <CardDescription>Учётные записи создаёт заведующий. Пароль показывается один раз.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus aria-hidden />
            Добавить преподавателя
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {users === null ? (
            <Spinner label="Загрузка…" />
          ) : users.length === 0 ? (
            <EmptyState title="Пользователей нет" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="w-64 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.fullName}
                        {(u.position || u.degree) && (
                          <div className="text-xs font-normal text-muted-foreground">
                            {[u.position, u.degree].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.role === 'HEAD' ? 'Заведующий' : 'Преподаватель'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => void resetPassword(u.id, u.fullName)}>
                            <KeyRound aria-hidden />
                            Сбросить пароль
                          </Button>
                          {u.role !== 'HEAD' && (
                            <Button size="sm" variant="outline" className="text-red-700" onClick={() => setDeleteFor(u)}>
                              <Trash2 aria-hidden />
                              Удалить
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DeepSeek</CardTitle>
          <CardDescription>
            Ключ используется для помощи в формулировании поручений (кнопка «Улучшить через DeepSeek» в поручениях).
            Позже область применения расширится.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm">
            Текущий ключ:{' '}
            {keySet ? (
              <span className="font-mono text-xs text-muted-foreground">{maskedKey}</span>
            ) : (
              <span className="text-muted-foreground">не задан</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              className="max-w-xs"
              placeholder={keySet ? 'Новый ключ (пусто — удалить)' : 'sk-…'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-label="Ключ DeepSeek"
            />
            <Button onClick={() => void saveKey()} disabled={savingKey || (!keySet && apiKey.trim().length === 0)}>
              {savingKey ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ключ хранится на сервере и передаётся только в DeepSeek API.
          </p>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" aria-hidden />
            Источники расписаний
          </CardTitle>
          <CardDescription>
            Загрузка расписаний преподавателей и групп из внешних источников (rasp.sstu.ru) будет подключена отдельным
            адаптером. Сейчас в прототипе используется демо-расписание, загружаемое один раз в день — при открытии
            раздела расписаний любым пользователем.
          </CardDescription>
        </CardHeader>
      </Card>

      <AddTeacherDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(name, password) => {
          setAddOpen(false)
          setPwdDialog({ name, password })
          void loadUsers()
        }}
      />

      {pwdDialog && (
        <Dialog open onOpenChange={(o) => (!o ? setPwdDialog(null) : undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Пароль для {pwdDialog.name}</DialogTitle>
              <DialogDescription>Передайте пароль преподавателю. Повторно он показан не будет.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
              <code className="flex-1 font-mono text-sm">{pwdDialog.password}</code>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Скопировать пароль"
                onClick={() => {
                  void navigator.clipboard?.writeText(pwdDialog.password)
                  toast.success('Скопировано')
                }}
              >
                <Copy className="size-4" aria-hidden />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setPwdDialog(null)}>Готово</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteFor && (
        <Dialog open onOpenChange={(o) => (!o ? setDeleteFor(null) : undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Удалить {deleteFor.fullName}?</DialogTitle>
              <DialogDescription>
                Вместе с пользователем удалятся его записи в журнале работ, отметки поручений и просьбы о замене.
                Действие необратимо.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteFor(null)}>
                Отмена
              </Button>
              <Button variant="destructive" onClick={() => void deleteUser(deleteFor)}>
                Удалить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AddTeacherDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string, password: string) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFullName('')
      setEmail('')
    }
  }, [open])

  async function save() {
    setSaving(true)
    try {
      const res = await api<{ user: AppUser; password: string }>('/api/users', {
        method: 'POST',
        body: { fullName, email },
      })
      toast.success(`${res.user.fullName} добавлен(а)`)
      onCreated(res.user.fullName, res.password)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Новый преподаватель</DialogTitle>
          <DialogDescription>Учётная запись создаётся сразу с паролем</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="t-name">ФИО</Label>
            <Input id="t-name" placeholder="Иванов Иван Иванович" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-email">E-mail</Label>
            <Input id="t-email" type="email" placeholder="ivanov@sstu.ru" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void save()} disabled={saving || fullName.trim().length < 3 || !email.includes('@')}>
            {saving ? 'Создание…' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
