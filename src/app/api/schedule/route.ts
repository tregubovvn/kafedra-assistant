import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr, pairTime } from '@/lib/schedule'

// Расписание на дату: преподаватель или группа, с учётом замен
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)

  // Список групп кафедры (для выбора в клиенте заведующего)
  if (url.searchParams.get('list') === 'groups') {
    const rows = await sql<{ ownerId: string }[]>`
      select distinct "ownerId"
      from "ScheduleEntry"
      where "ownerType" = 'GROUP'
    `
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
    const base = await sql<{
      pairNumber: number
      discipline: string
      kind: string
      groupId: string
      room: string | null
    }[]>`
      select "pairNumber", discipline, kind, "groupId", room
      from "ScheduleEntry"
      where "ownerType" = 'TEACHER' and "ownerId" = ${String(teacherId)} and date = ${date}
      order by "pairNumber" asc
    `

    const replacements = await sql<{
      pairNumber: number
      status: string
      substituteFullName: string | null
    }[]>`
      select r."pairNumber", r.status, s."fullName" as "substituteFullName"
      from "Replacement" r
      left join "User" s on s.id = r."substituteId"
      where r."initiatorId" = ${teacherId} and r."lessonDate" = ${date} and r.status <> 'CANCELLED'
    `

    for (const e of base) {
      const r = replacements.find((x) => x.pairNumber === e.pairNumber)
      lessons.push({
        pairNumber: e.pairNumber,
        ...pairTime(e.pairNumber),
        discipline: e.discipline,
        kind: e.kind,
        groupId: e.groupId,
        room: e.room,
        replacedBy: r?.status === 'FOUND' ? r.substituteFullName ?? '—' : null,
        searching: r?.status === 'SEARCHING',
      })
    }

    // Занятия, взятые как замена
    const taken = await sql<{
      pairNumber: number
      discipline: string
      kind: string
      groupId: string
      room: string | null
    }[]>`
      select "pairNumber", discipline, kind, "groupId", room
      from "Replacement"
      where "substituteId" = ${teacherId} and "lessonDate" = ${date} and status = 'FOUND'
      order by "pairNumber" asc
    `
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
    const base = await sql<{
      pairNumber: number
      discipline: string
      kind: string
      groupId: string
      room: string | null
      teacherName: string | null
    }[]>`
      select "pairNumber", discipline, kind, "groupId", room, "teacherName"
      from "ScheduleEntry"
      where "ownerType" = 'GROUP' and "ownerId" = ${id} and date = ${date}
      order by "pairNumber" asc
    `

    const replacements = await sql<{
      pairNumber: number
      status: string
      substituteFullName: string | null
    }[]>`
      select r."pairNumber", r.status, s."fullName" as "substituteFullName"
      from "Replacement" r
      left join "User" s on s.id = r."substituteId"
      where r."groupId" = ${id} and r."lessonDate" = ${date} and r.status <> 'CANCELLED'
    `

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
          r?.status === 'FOUND' ? `${r.substituteFullName ?? '—'} (замена)` : e.teacherName,
        searching: r?.status === 'SEARCHING',
      })
    }
  }

  lessons.sort((a, b) => a.pairNumber - b.pairNumber)
  return NextResponse.json({ date, mode, lessons })
}
