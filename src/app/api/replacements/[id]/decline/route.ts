import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Отклонение просьбы о замене
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  const replacementId = Number(id)
  if (!Number.isInteger(replacementId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const myRequest = await db.replacementRequest.findFirst({
    where: { replacementId, teacherId: me.id, status: 'PENDING' },
  })
  if (!myRequest) {
    return NextResponse.json({ error: 'Просьба не найдена или уже обработана' }, { status: 400 })
  }

  await db.replacementRequest.update({ where: { id: myRequest.id }, data: { status: 'DECLINED' } })
  return NextResponse.json({ ok: true })
}
