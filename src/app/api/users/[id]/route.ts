import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Удаление пользователя (только заведующий)
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const { id } = await ctx.params
  const userId = Number(id)
  if (!Number.isInteger(userId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const rows = await sql<{ id: number; role: string }[]>`select id, role from "User" where id = ${userId}`
  const user = rows[0]
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  if (user.role === 'HEAD') {
    return NextResponse.json({ error: 'Учётную запись заведующего удалить нельзя' }, { status: 400 })
  }

  await sql`delete from "User" where id = ${userId}`
  return NextResponse.json({ ok: true })
}
