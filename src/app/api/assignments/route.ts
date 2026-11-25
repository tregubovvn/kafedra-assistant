import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr } from '@/lib/schedule'

type AssignmentRow = {
  id: number
  description: string
  dueDate: string
  forAll: boolean
  createdAt: Date
}

type StatusRow = {
  assignmentId: number
  teacherId: number
  completed: boolean
  completedAt: Date | null
  teacherFullName: string
}

function toDTO(a: AssignmentRow, statuses: StatusRow[]) {
  return {
    id: a.id,
    description: a.description,
    dueDate: a.dueDate,
    forAll: a.forAll,
    createdAt: a.createdAt.toISOString(),
    statuses: statuses.map((s) => ({
      teacherId: s.teacherId,
      teacherFullName: s.teacherFullName,
      completed: s.completed,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    })),
  }
}

// Статусы исполнения для набора поручений (с ФИО преподавателя)
async function loadStatuses(assignmentIds: number[]): Promise<StatusRow[]> {
  if (assignmentIds.length === 0) return []
  return sql<StatusRow[]>`
    select s."assignmentId",
           s."teacherId",
           s.completed,
           s."completedAt",
           u."fullName" as "teacherFullName"
    from "AssignmentStatus" s
    join "User" u on u.id = s."teacherId"
    where s."assignmentId" in ${sql(assignmentIds)}
    order by s."assignmentId", s."teacherId" asc
  `
}

// Поручения: преподавателю — адресованные ему, заведующему — все
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const list = me.role === 'TEACHER'
    ? await sql<AssignmentRow[]>`
        select a.id, a.description, a."dueDate", a."forAll", a."createdAt"
        from "Assignment" a
        where exists (
          select 1 from "AssignmentStatus" s
          where s."assignmentId" = a.id and s."teacherId" = ${me.id}
        )
        order by a."dueDate" desc
      `
    : await sql<AssignmentRow[]>`
        select a.id, a.description, a."dueDate", a."forAll", a."createdAt"
        from "Assignment" a
        order by a."dueDate" desc, a.id desc
      `

  const statuses = await loadStatuses(list.map((a) => a.id))
  const byAssignment = new Map<number, StatusRow[]>()
  for (const s of statuses) {
    const bucket = byAssignment.get(s.assignmentId)
    if (bucket) bucket.push(s)
    else byAssignment.set(s.assignmentId, [s])
  }

  return NextResponse.json({
    assignments: list.map((a) => toDTO(a, byAssignment.get(a.id) ?? [])),
  })
}

// Создание поручения (только заведующий)
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const dueDate = body?.dueDate
  const forAll = body?.forAll === true
  const teacherIds: number[] = Array.isArray(body?.teacherIds)
    ? body.teacherIds.map(Number).filter((n: number) => Number.isInteger(n))
    : []

  if (description.length < 5) return NextResponse.json({ error: 'Опишите поручение' }, { status: 400 })
  if (!isValidDateStr(dueDate)) return NextResponse.json({ error: 'Укажите срок выполнения' }, { status: 400 })

  const teachers = await sql<{ id: number; email: string; fullName: string }[]>`
    select id, email, "fullName"
    from "User"
    where role = 'TEACHER'
    order by "fullName" asc
  `
  const recipients = forAll ? teachers : teachers.filter((t) => teacherIds.includes(t.id))
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Выберите адресатов поручения' }, { status: 400 })
  }

  const assignment = await sql.begin(async (tx) => {
    const rows = await tx<AssignmentRow[]>`
      insert into "Assignment" (description, "dueDate", "forAll", "createdBy")
      values (${description}, ${dueDate}, ${forAll}, ${me.id})
      returning id, description, "dueDate", "forAll", "createdAt"
    `
    const created = rows[0]
    await tx`
      insert into "AssignmentStatus" ("assignmentId", "teacherId")
      values ${tx(recipients.map((t) => [created.id, t.id]))}
    `
    return created
  })

  for (const t of recipients) {
    await sql`
      insert into "MailLog" ("toEmail", "toName", type, subject, body)
      values (
        ${t.email},
        ${t.fullName},
        'ASSIGNMENT_NEW',
        'Новое поручение',
        ${`Здравствуйте, ${t.fullName}!\n\nВам назначено новое поручение:\n«${description}»\n\nСрок выполнения: ${dueDate}.\nПроверить можно в приложении «Ассистент кафедры ПМН».`}
      )
    `
  }

  const statuses = await loadStatuses([assignment.id])
  return NextResponse.json({ assignment: toDTO(assignment, statuses) })
}
