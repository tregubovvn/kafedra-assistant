import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
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

  const assignment = await sql`select id from "Assignment" where id = ${assignmentId}`
  if (assignment.length === 0) return NextResponse.json({ error: 'Поручение не найдено' }, { status: 404 })

  const my = await sql<{ id: number }[]>`
    select id from "AssignmentStatus"
    where "assignmentId" = ${assignmentId} and "teacherId" = ${me.id}
    limit 1
  `
  if (my.length === 0) return NextResponse.json({ error: 'Это поручение вам не адресовано' }, { status: 403 })

  const updated = await sql<{ completed: boolean; completedAt: Date | null }[]>`
    update "AssignmentStatus"
    set completed = true, "completedAt" = now()
    where id = ${my[0].id}
    returning completed, "completedAt"
  `
  const row = updated[0]

  return NextResponse.json({
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  })
}
