import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Отмена поиска замены (инициатором)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  const replacementId = Number(id)
  if (!Number.isInteger(replacementId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const rows = await sql<{ initiatorId: number; status: string }[]>`
    select "initiatorId", status from "Replacement" where id = ${replacementId}
  `
  const replacement = rows[0]
  if (!replacement) return NextResponse.json({ error: 'Замена не найдена' }, { status: 404 })
  if (replacement.initiatorId !== me.id) {
    return NextResponse.json({ error: 'Отменить поиск может только инициатор' }, { status: 403 })
  }
  if (replacement.status !== 'SEARCHING') {
    return NextResponse.json({ error: 'Замена уже подобрана, отменить нельзя' }, { status: 400 })
  }

  const cancelled = await sql.begin(async (tx) => {
    const updated = await tx<{ id: number }[]>`
      update "Replacement" set status = 'CANCELLED'
      where id = ${replacementId} and status = 'SEARCHING'
      returning id
    `
    if (updated.length === 0) return false
    await tx`
      update "ReplacementRequest" set status = 'CANCELLED'
      where "replacementId" = ${replacementId} and status = 'PENDING'
    `
    return true
  })

  if (!cancelled) {
    return NextResponse.json({ error: 'Замена уже подобрана, отменить нельзя' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
