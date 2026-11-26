'use client'

// Десктоп-клиент заведующего кафедрой: боковая навигация

import { useState } from 'react'
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Mail,
  Settings,
} from 'lucide-react'
import type { AppUser } from '@/lib/types'
import { HeadAssignmentsTab } from '@/components/app/head/assignments-tab'
import { HeadScheduleTab } from '@/components/app/head/schedule-tab'
import { HeadReplacementsTab } from '@/components/app/head/replacements-tab'
import { HeadWorksTab } from '@/components/app/head/works-tab'
import { HeadSettingsTab } from '@/components/app/head/settings-tab'
import { HeadMailTab } from '@/components/app/head/mail-tab'

type Tab = 'assignments' | 'schedule' | 'replacements' | 'works' | 'mail' | 'settings'

const NAV: { key: Tab; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'assignments', label: 'Поручения', icon: ClipboardCheck },
  { key: 'schedule', label: 'Расписание', icon: CalendarDays },
  { key: 'replacements', label: 'Замены', icon: ArrowLeftRight },
  { key: 'works', label: 'Работа', icon: Briefcase },
  { key: 'mail', label: 'Почта (исходящие)', icon: Mail },
  { key: 'settings', label: 'Настройки', icon: Settings },
]

const TITLES: Record<Tab, { title: string; subtitle: string }> = {
  assignments: { title: 'Поручения', subtitle: 'Создание и контроль исполнения поручений преподавателям' },
  schedule: { title: 'Расписание', subtitle: 'Расписание по преподавателю или группе на дату или день недели' },
  replacements: { title: 'Замены', subtitle: 'Все текущие замены кафедры со статусами поиска и экспортом в CSV' },
  works: { title: 'Работа', subtitle: 'Журнал работ преподавателей кафедры с фильтрами' },
  mail: { title: 'Исходящая почта', subtitle: 'Журнал писем: новые поручения, напоминания, просьбы о замене' },
  settings: { title: 'Настройки', subtitle: 'Преподаватели, ключ DeepSeek, источники расписаний' },
}

export function HeadApp({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('assignments')

  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      <aside className="border-b bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex flex-col lg:h-full">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-tight font-semibold">Цифровой помощник зав. кафедрой</p>
              <p className="text-xs leading-tight text-muted-foreground">клиент заведующего</p>
            </div>
          </div>

          <nav aria-label="Разделы" className="flex gap-1 overflow-x-auto px-3 pb-3 scroll-thin lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  <span className="lg:hidden xl:inline">{label}</span>
                  <span className="hidden lg:inline xl:hidden">{label.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto hidden border-t p-3 lg:block">
            <div className="mb-2 rounded-lg bg-background p-3">
              <p className="text-sm leading-tight font-medium">{user.fullName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Заведующий кафедрой</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
            >
              <LogOut className="size-4.5" aria-hidden />
              Выйти
            </button>
          </div>
          <div className="pb-3 lg:hidden">
            <button
              type="button"
              onClick={onLogout}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground/80 hover:bg-accent"
            >
              <LogOut className="size-4" aria-hidden />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background px-6 py-5">
          <h1 className="text-xl font-semibold tracking-tight">{TITLES[tab].title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{TITLES[tab].subtitle}</p>
        </header>
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto max-w-6xl">
            {tab === 'assignments' && <HeadAssignmentsTab />}
            {tab === 'schedule' && <HeadScheduleTab />}
            {tab === 'replacements' && <HeadReplacementsTab />}
            {tab === 'works' && <HeadWorksTab />}
            {tab === 'mail' && <HeadMailTab />}
            {tab === 'settings' && <HeadSettingsTab />}
          </div>
        </main>
        <footer className="mt-auto border-t bg-background px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Кафедра «Производственный менеджмент» · СГТУ имени Гагарина Ю.А. · прототип для tregubovvn.ru
          </p>
        </footer>
      </div>
    </div>
  )
}
