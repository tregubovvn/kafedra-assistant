import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr, pairTime } from '@/lib/schedule'

// Расписание на дату: преподаватель или группа, с учётом замен
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)

  // Список групп кафедры (для выбора в клиенте заведующего)
  if (url.searchParams.get('list') === 'groups') {
    const rows = await db.scheduleEntry.findMany({
      where: { ownerType: 'GROUP' },
      distinct: ['ownerId'],
      select: { ownerId: true },
    })
    return NextResponse.json({ groups: rows.map((r) => r.ownerId).sort() })
  }

  const mode = url.searchParams.get('mode') // teacher | group
  const id = url.searchParams.get('id') ?? ''
  const date = url.searchParams.get('date') ?? ''

  if (!isValidDateStr(date)) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
  if (mode !== 'teacher' && mode !== 'group') {
    return NextResponse.json({ error: 'Некорректный режим' }, { status: 400 })
  }
  if (mode === 'teacher') {
    if (me.role === 'TEACHER' && Number(id) !== me.id) {
      return NextResponse.json({ error: 'Доступно только к своему расписанию' }, { status: 403 })
    }
  }
  if (!id) return NextResponse.json({ error: 'Не указан объект расписания' }, { status: 400 })

  const lessons: {
    pairNumber: number
    start: string
    end: string
    discipline: string
    kind: string
    groupId: string
    room: string | null
    teacherName?: string | null
    isSubstitution?: boolean
    replacedBy?: string | null
    searching?: boolean
  }[] = []

  if (mode === 'teacher') {
    const teacherId = Number(id)
    const base = await db.scheduleEntry.findMany({
      where: { ownerType: 'TEACHER', ownerId: String(teacherId), date },
      orderBy: { pairNumber: 'asc' },
    })
    const replacements = await db.replacement.findMany({
      where: { initiatorId: teacherId, lessonDate: date, status: { not: 'CANCELLED' } },
      include: { substitute: { select: { fullName: true } } },
    })

    for (const e of base) {
      const r = replacements.find((x) => x.pairNumber === e.pairNumber)
      lessons.push({
        pairNumber: e.pairNumber,
        ...pairTime(e.pairNumber),
        discipline: e.discipline,
        kind: e.kind,
        groupId: e.groupId,
        room: e.room,
        replacedBy: r?.status === 'FOUND' ? r.substitute?.fullName ?? '—' : null,
        searching: r?.status === 'SEARCHING',
      })
    }

    // Занятия, взятые как замена
    const taken = await db.replacement.findMany({
      where: { substituteId: teacherId, lessonDate: date, status: 'FOUND' },
      orderBy: { pairNumber: 'asc' },
    })
    for (const r of taken) {
      lessons.push({
        pairNumber: r.pairNumber,
        ...pairTime(r.pairNumber),
        discipline: r.discipline,
        kind: r.kind,
        groupId: r.groupId,
        room: r.room,
        isSubstitution: true,
      })
    }
  } else {
    const base = await db.scheduleEntry.findMany({
      where: { ownerType: 'GROUP', ownerId: id, date },
      orderBy: { pairNumber: 'asc' },
    })
    const replacements = await db.replacement.findMany({
      where: { groupId: id, lessonDate: date, status: { not: 'CANCELLED' } },
      include: {
        substitute: { select: { fullName: true } },
        initiator: { select: { fullName: true } },
      },
    })
    for (const e of base) {
      const r = replacements.find((x) => x.pairNumber === e.pairNumber)
      lessons.push({
        pairNumber: e.pairNumber,
        ...pairTime(e.pairNumber),
        discipline: e.discipline,
        kind: e.kind,
        groupId: e.groupId,
        room: e.room,
        teacherName:
          r?.status === 'FOUND' ? `${r.substitute?.fullName ?? '—'} (замена)` : e.teacherName,
        searching: r?.status === 'SEARCHING',
      })
    }
  }

  lessons.sort((a, b) => a.pairNumber - b.pairNumber)
  return NextResponse.json({ date, mode, lessons })
}
