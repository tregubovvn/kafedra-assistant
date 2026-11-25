import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Отметка исполнения поручения преподавателем
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Отметку ставит преподаватель' }, { status: 403 })
  }

  const { id } = await ctx.params
  const assignmentId = Number(id)
  if (!Number.isInteger(assignmentId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { statuses: true },
  })
  if (!assignment) return NextResponse.json({ error: 'Поручение не найдено' }, { status: 404 })

  const my = assignment.statuses.find((s) => s.teacherId === me.id)
  if (!my) return NextResponse.json({ error: 'Это поручение вам не адресовано' }, { status: 403 })

  const updated = await db.assignmentStatus.update({
    where: { id: my.id },
    data: { completed: true, completedAt: new Date() },
  })

  return NextResponse.json({ completed: updated.completed, completedAt: updated.completedAt?.toISOString() ?? null })
}
