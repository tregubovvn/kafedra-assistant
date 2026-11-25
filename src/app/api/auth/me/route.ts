import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/server/auth'

export async function GET(req: Request) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  return NextResponse.json({ user })
}
