import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Удаление пользователя (только заведующий)
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const { id } = await ctx.params
  const userId = Number(id)
  if (!Number.isInteger(userId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  if (user.role === 'HEAD') {
    return NextResponse.json({ error: 'Учётную запись заведующего удалить нельзя' }, { status: 400 })
  }

  await db.user.delete({ where: { id: userId } })
  return NextResponse.json({ ok: true })
}
