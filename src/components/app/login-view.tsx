'use client'

// Экран входа с быстрым демо-доступом

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { GraduationCap, LogIn } from 'lucide-react'
import { api, setToken } from '@/lib/client'
import type { AppUser } from '@/lib/types'
import { toast } from 'sonner'

const DEMO_USERS: { email: string; name: string; role: string }[] = [
  { email: 'slavnetskova@pmn.demo', name: 'Славнецкова Людмила Владимировна', role: 'Заведующая кафедрой' },
  { email: 'slavnetskova.docent@pmn.demo', name: 'Славнецкова Людмила Владимировна', role: 'Доцент' },
  { email: 'grimashevich@pmn.demo', name: 'Гримашевич Ольга Николаевна', role: 'Преподаватель' },
  { email: 'goryacheva@pmn.demo', name: 'Горячева Ирина Алексеевна', role: 'Преподаватель' },
  { email: 'uchuvatkin@pmn.demo', name: 'Учуваткин Александр Александрович', role: 'Преподаватель' },
  { email: 'umanskij@pmn.demo', name: 'Уманский Вячеслав Юрьевич', role: 'Преподаватель' },
  { email: 'lysikova@pmn.demo', name: 'Лысикова Ольга Валерьевна', role: 'Преподаватель' },
  { email: 'podsumkova@pmn.demo', name: 'Подсумкова Людмила Алексеевна', role: 'Преподаватель' },
  { email: 'glushkova@pmn.demo', name: 'Глушкова Юлия Олеговна', role: 'Преподаватель' },
  { email: 'tregubovvn@outlook.com', name: 'Трегубов Владимир Николаевич', role: 'Преподаватель' },
  { email: 'makarova@pmn.demo', name: 'Макарова Светлана Николаевна', role: 'Преподаватель' },
]

export function LoginView({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function login(mail: string, pwd: string) {
    setLoading(true)
    try {
      const res = await api<{ token: string; user: AppUser }>('/api/auth/login', {
        method: 'POST',
        body: { email: mail, password: pwd },
      })
      setToken(res.token)
      onLogin(res.user)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-green-50 via-background to-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-8" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Цифровой помощник зав. кафедрой</h1>
          <p className="text-sm text-muted-foreground">
            Кафедра «Производственный менеджмент»
            <br />
            СГТУ имени Гагарина Ю.А.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Вход в систему</CardTitle>
            <CardDescription>Заведующий — в браузере на компьютере, преподаватель — на телефоне.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void login(email.trim(), password)
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading}>
                <LogIn aria-hidden />
                Войти
              </Button>
            </form>

            <div className="relative">
              <Separator />
              <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">демо-доступ</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="demo-user">Выберите пользователя</Label>
              <Select value={demoEmail} onValueChange={(v) => setDemoEmail(v)}>
                <SelectTrigger id="demo-user">
                  <SelectValue placeholder="ФИО и роль" />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_USERS.map((u) => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.name} — {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                disabled={!demoEmail || loading}
                onClick={() => void login(demoEmail, 'demo1234')}
              >
                Войти как выбранный (пароль demo1234)
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">Прототип. Публикация: tregubovvn.ru</p>
      </div>
    </div>
  )
}
