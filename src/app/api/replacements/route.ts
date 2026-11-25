import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr, fmtDate, pairTime } from '@/lib/schedule'

function toDTO(
  r: {
    id: number
    discipline: string
    groupId: string
    kind: string
    room: string | null
    lessonDate: string
    pairNumber: number
    initiatorId: number
    substituteId: number | null
    status: string
    assignedByHead: boolean
    createdAt: Date
    initiator: { fullName: string }
    substitute: { fullName: string } | null
    requests: {
      id: number
      teacherId: number
      status: string
      teacher: { fullName: string }
    }[]
  }
) {
  return {
    id: r.id,
    discipline: r.discipline,
    groupId: r.groupId,
    kind: r.kind,
    room: r.room,
    lessonDate: r.lessonDate,
    pairNumber: r.pairNumber,
    initiatorId: r.initiatorId,
    initiatorFullName: r.initiator.fullName,
    substituteId: r.substituteId,
    substituteFullName: r.substitute?.fullName ?? null,
    status: r.status,
    assignedByHead: r.assignedByHead,
    createdAt: r.createdAt.toISOString(),
    requests: r.requests.map((q) => ({
      id: q.id,
      teacherId: q.teacherId,
      teacherFullName: q.teacher.fullName,
      status: q.status,
    })),
  }
}

const include = {
  initiator: { select: { fullName: true } },
  substitute: { select: { fullName: true } },
  requests: {
    include: { teacher: { select: { fullName: true } } },
    orderBy: { id: 'asc' as const },
  },
}

// Замены: преподавателю — свои и входящие просьбы, заведующему — все
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  if (me.role === 'HEAD') {
    const list = await db.replacement.findMany({
      where: { status: { not: 'CANCELLED' } },
      include,
      orderBy: [{ lessonDate: 'asc' }, { pairNumber: 'asc' }],
    })
    return NextResponse.json({ replacements: list.map(toDTO) })
  }

  const mine = await db.replacement.findMany({
    where: { initiatorId: me.id, status: { not: 'CANCELLED' } },
    include,
    orderBy: [{ lessonDate: 'asc' }, { pairNumber: 'asc' }],
  })

  const incomingRows = await db.replacementRequest.findMany({
    where: { teacherId: me.id, status: 'PENDING', replacement: { status: 'SEARCHING' } },
    include: { replacement: { include } },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json({
    mine: mine.map(toDTO),
    incoming: incomingRows.map((q) => ({ requestId: q.id, replacement: toDTO(q.replacement) })),
  })
}

// Создание поиска замены (инициирует преподаватель)
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Поиск замены инициирует преподаватель' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const date = body?.date
  const pairNumber = Number(body?.pairNumber)
  const candidateIds: number[] = Array.isArray(body?.candidateIds)
    ? [...new Set(body.candidateIds.map(Number))].filter((n: number) => Number.isInteger(n))
    : []

  if (!isValidDateStr(date)) return NextResponse.json({ error: 'Некорректная дата занятия' }, { status: 400 })
  if (!(pairNumber >= 1 && pairNumber <= 5)) return NextResponse.json({ error: 'Некорректная пара' }, { status: 400 })
  if (candidateIds.length === 0) {
    return NextResponse.json({ error: 'Выберите хотя бы одного кандидата' }, { status: 400 })
  }

  const lesson = await db.scheduleEntry.findFirst({
    where: { ownerType: 'TEACHER', ownerId: String(me.id), date, pairNumber },
  })
  if (!lesson) {
    return NextResponse.json({ error: 'Занятие не найдено в вашем расписании' }, { status: 400 })
  }

  const active = await db.replacement.findFirst({
    where: { initiatorId: me.id, lessonDate: date, pairNumber, status: { not: 'CANCELLED' } },
  })
  if (active) {
    return NextResponse.json({ error: 'Для этого занятия уже создан поиск замены' }, { status: 400 })
  }

  const candidates = await db.user.findMany({
    where: { id: { in: candidateIds.filter((n) => n !== me.id) } },
    select: { id: true, email: true, fullName: true },
  })
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Кандидаты не выбраны' }, { status: 400 })
  }

  const replacement = await db.replacement.create({
    data: {
      discipline: lesson.discipline,
      groupId: lesson.groupId,
      kind: lesson.kind,
      room: lesson.room,
      lessonDate: date,
      pairNumber,
      initiatorId: me.id,
      requests: { create: candidates.map((c) => ({ teacherId: c.id })) },
    },
    include,
  })

  const t = pairTime(pairNumber)
  for (const c of candidates) {
    await db.mailLog.create({
      data: {
        toEmail: c.email,
        toName: c.fullName,
        type: 'REPLACEMENT_REQUEST',
        subject: `Просьба о замене: ${lesson.discipline} (${fmtDate(date)})`,
        body: `Здравствуйте, ${c.fullName}!\n\n${me.fullName} просит заменить занятие:\n${lesson.discipline} (${lesson.kind}), группа ${lesson.groupId}\nДата: ${fmtDate(date)}, ${pairNumber}-я пара (${t.start}–${t.end}), ауд. ${lesson.room ?? '—'}\n\nОтветить можно в приложении «Ассистент кафедры ПМН».`,
      },
    })
  }

  return NextResponse.json({ replacement: toDTO(replacement) })
}
