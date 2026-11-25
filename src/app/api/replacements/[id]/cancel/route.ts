import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Отмена поиска замены (инициатором)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  const replacementId = Number(id)
  if (!Number.isInteger(replacementId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const replacement = await db.replacement.findUnique({ where: { id: replacementId } })
  if (!replacement) return NextResponse.json({ error: 'Замена не найдена' }, { status: 404 })
  if (replacement.initiatorId !== me.id) {
    return NextResponse.json({ error: 'Отменить поиск может только инициатор' }, { status: 403 })
  }
  if (replacement.status !== 'SEARCHING') {
    return NextResponse.json({ error: 'Замена уже подобрана, отменить нельзя' }, { status: 400 })
  }

  await db.replacement.update({ where: { id: replacementId }, data: { status: 'CANCELLED' } })
  await db.replacementRequest.updateMany({
    where: { replacementId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
  return NextResponse.json({ ok: true })
}
