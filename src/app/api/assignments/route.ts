import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr } from '@/lib/schedule'

function toDTO(a: {
  id: number
  description: string
  dueDate: string
  forAll: boolean
  createdAt: Date
  statuses: {
    teacherId: number
    completed: boolean
    completedAt: Date | null
    teacher: { fullName: string }
  }[]
}) {
  return {
    id: a.id,
    description: a.description,
    dueDate: a.dueDate,
    forAll: a.forAll,
    createdAt: a.createdAt.toISOString(),
    statuses: a.statuses.map((s) => ({
      teacherId: s.teacherId,
      teacherFullName: s.teacher.fullName,
      completed: s.completed,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    })),
  }
}

// Поручения: преподавателю — адресованные ему, заведующему — все
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const include = {
    statuses: {
      include: { teacher: { select: { fullName: true } } },
      orderBy: { teacherId: 'asc' as const },
    },
  }

  if (me.role === 'TEACHER') {
    const list = await db.assignment.findMany({
      where: { statuses: { some: { teacherId: me.id } } },
      include,
      orderBy: { dueDate: 'desc' },
    })
    return NextResponse.json({ assignments: list.map(toDTO) })
  }

  const list = await db.assignment.findMany({ include, orderBy: [{ dueDate: 'desc' }, { id: 'desc' }] })
  return NextResponse.json({ assignments: list.map(toDTO) })
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

  let recipients = await db.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, email: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  if (!forAll) {
    recipients = recipients.filter((t) => teacherIds.includes(t.id))
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Выберите адресатов поручения' }, { status: 400 })
    }
  }

  const assignment = await db.assignment.create({
    data: {
      description,
      dueDate,
      forAll,
      createdBy: me.id,
      statuses: {
        create: recipients.map((t) => ({ teacherId: t.id })),
      },
    },
    include: { statuses: { include: { teacher: { select: { fullName: true } } } } },
  })

  for (const t of recipients) {
    await db.mailLog.create({
      data: {
        toEmail: t.email,
        toName: t.fullName,
        type: 'ASSIGNMENT_NEW',
        subject: 'Новое поручение',
        body: `Здравствуйте, ${t.fullName}!\n\nВам назначено новое поручение:\n«${description}»\n\nСрок выполнения: ${dueDate}.\nПроверить можно в приложении «Ассистент кафедры ПМН».`,
      },
    })
  }

  return NextResponse.json({ assignment: toDTO(assignment) })
}
