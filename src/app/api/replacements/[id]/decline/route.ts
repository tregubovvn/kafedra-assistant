import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Отклонение просьбы о замене
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await ctx.params
  const replacementId = Number(id)
  if (!Number.isInteger(replacementId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const updated = await sql<{ id: number }[]>`
    update "ReplacementRequest" set status = 'DECLINED'
    where "replacementId" = ${replacementId} and "teacherId" = ${me.id} and status = 'PENDING'
    returning id
  `
  if (updated.length === 0) {
    return NextResponse.json({ error: 'Просьба не найдена или уже обработана' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
