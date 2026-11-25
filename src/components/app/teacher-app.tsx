'use client'

// Мобильный клиент преподавателя: нижняя навигация из трёх вкладок

import { useState } from 'react'
import { BadgeCheck, CalendarDays, ClipboardList, LogOut } from 'lucide-react'
import type { AppUser } from '@/lib/types'
import { WorksTab } from '@/components/app/teacher/works-tab'
import { AssignmentsTab } from '@/components/app/teacher/assignments-tab'
import { ScheduleTab } from '@/components/app/teacher/schedule-tab'

type Tab = 'works' | 'assignments' | 'schedule'

const NAV: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'works', label: 'Работа', icon: ClipboardList },
  { key: 'assignments', label: 'Поручения', icon: BadgeCheck },
  { key: 'schedule', label: 'Расписание', icon: CalendarDays },
]

export function TeacherApp({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('works')

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-sm">
        <header className="sticky top-0 z-30 bg-primary text-primary-foreground">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold leading-tight">Ассистент кафедры ПМН</p>
              <p className="text-xs opacity-80">{user.fullName}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Выйти"
              className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 active:bg-white/25"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-28">
          {tab === 'works' && <WorksTab />}
          {tab === 'assignments' && <AssignmentsTab userId={user.id} />}
          {tab === 'schedule' && <ScheduleTab userId={user.id} />}
        </main>

        <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background">
          <div className="mx-auto grid max-w-md grid-cols-3">
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-2 text-xs font-medium transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <span className={`flex size-8 items-center justify-center rounded-full ${active ? 'bg-primary/10' : ''}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
