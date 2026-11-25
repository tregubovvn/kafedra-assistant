'use client'

import { useEffect, useState } from 'react'
import { api, getToken, setToken } from '@/lib/client'
import type { AppUser } from '@/lib/types'
import { LoginView } from '@/components/app/login-view'
import { TeacherApp } from '@/components/app/teacher-app'
import { HeadApp } from '@/components/app/head-app'
import { Spinner } from '@/components/app/bits'

export default function Page() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!getToken()) {
        if (!cancelled) setReady(true)
        return
      }
      try {
        const res = await api<{ user: AppUser }>('/api/auth/me')
        if (!cancelled) setUser(res.user)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner label="Загрузка…" />
      </div>
    )
  }

  if (!user) return <LoginView onLogin={setUser} />
  if (user.role === 'HEAD') {
    return (
      <HeadApp
        user={user}
        onLogout={() => {
          setToken(null)
          setUser(null)
        }}
      />
    )
  }
  return (
    <TeacherApp
      user={user}
      onLogout={() => {
        setToken(null)
        setUser(null)
      }}
    />
  )
}
