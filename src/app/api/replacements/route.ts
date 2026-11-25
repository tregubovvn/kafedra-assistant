import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr, fmtDate, pairTime } from '@/lib/schedule'

type ReplacementRow = {
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
  initiatorFullName: string
  substituteFullName: string | null
}

type RequestRow = {
  id: number
  replacementId: number
  teacherId: number
  status: string
  teacherFullName: string
}

// Замена + ФИО инициатора и заменяющего одним запросом
const replacementSelect = sql`
  select r.*,
         i."fullName" as "initiatorFullName",
         s."fullName" as "substituteFullName"
  from "Replacement" r
  join "User" i on i.id = r."initiatorId"
  left join "User" s on s.id = r."substituteId"
`

// То же, но сразу с id просьбы — для входящих заявок преподавателя
const incomingSelect = sql`
  select r.*,
         q.id as "requestId",
         i."fullName" as "initiatorFullName",
         s."fullName" as "substituteFullName"
  from "Replacement" r
  join "User" i on i.id = r."initiatorId"
  left join "User" s on s.id = r."substituteId"
  join "ReplacementRequest" q on q."replacementId" = r.id
`

function toDTO(r: ReplacementRow, requests: RequestRow[]) {
  return {
    id: r.id,
    discipline: r.discipline,
    groupId: r.groupId,
    kind: r.kind,
    room: r.room,
    lessonDate: r.lessonDate,
    pairNumber: r.pairNumber,
    initiatorId: r.initiatorId,
    initiatorFullName: r.initiatorFullName,
    substituteId: r.substituteId,
    substituteFullName: r.substituteFullName,
    status: r.status,
    assignedByHead: r.assignedByHead,
    createdAt: r.createdAt.toISOString(),
    requests: requests.map((q) => ({
      id: q.id,
      teacherId: q.teacherId,
      teacherFullName: q.teacherFullName,
      status: q.status,
    })),
  }
}

// Просьбы по набору замен
async function loadRequests(replacementIds: number[]): Promise<RequestRow[]> {
  if (replacementIds.length === 0) return []
  return sql<RequestRow[]>`
    select q.id, q."replacementId", q."teacherId", q.status, u."fullName" as "teacherFullName"
    from "ReplacementRequest" q
    join "User" u on u.id = q."teacherId"
    where q."replacementId" in ${sql(replacementIds)}
    order by q.id asc
  `
}

function groupByReplacement(rows: RequestRow[]): Map<number, RequestRow[]> {
  const map = new Map<number, RequestRow[]>()
  for (const r of rows) {
    const bucket = map.get(r.replacementId)
    if (bucket) bucket.push(r)
    else map.set(r.replacementId, [r])
  }
  return map
}

// Замены: преподавателю — свои и входящие просьбы, заведующему — все
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  if (me.role === 'HEAD') {
    const list = await sql<ReplacementRow[]>`
      ${replacementSelect}
      where r.status <> 'CANCELLED'
      order by r."lessonDate" asc, r."pairNumber" asc
    `
    const requests = groupByReplacement(await loadRequests(list.map((r) => r.id)))
    return NextResponse.json({
      replacements: list.map((r) => toDTO(r, requests.get(r.id) ?? [])),
    })
  }

  const mine = await sql<ReplacementRow[]>`
    ${replacementSelect}
    where r."initiatorId" = ${me.id} and r.status <> 'CANCELLED'
    order by r."lessonDate" asc, r."pairNumber" asc
  `

  const incomingRows = await sql<(ReplacementRow & { requestId: number })[]>`
    ${incomingSelect}
    where q."teacherId" = ${me.id} and q.status = 'PENDING' and r.status = 'SEARCHING'
    order by q.id asc
  `

  const ids = [...new Set([...mine.map((r) => r.id), ...incomingRows.map((r) => r.id)])]
  const requests = groupByReplacement(await loadRequests(ids))

  return NextResponse.json({
    mine: mine.map((r) => toDTO(r, requests.get(r.id) ?? [])),
    incoming: incomingRows.map((r) => ({
      requestId: r.requestId,
      replacement: toDTO(r, requests.get(r.id) ?? []),
    })),
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

  const lessonRows = await sql<{
    discipline: string
    groupId: string
    kind: string
    room: string | null
  }[]>`
    select discipline, "groupId", kind, room
    from "ScheduleEntry"
    where "ownerType" = 'TEACHER' and "ownerId" = ${String(me.id)} and date = ${date} and "pairNumber" = ${pairNumber}
    limit 1
  `
  const lesson = lessonRows[0]
  if (!lesson) {
    return NextResponse.json({ error: 'Занятие не найдено в вашем расписании' }, { status: 400 })
  }

  const active = await sql`
    select 1 from "Replacement"
    where "initiatorId" = ${me.id} and "lessonDate" = ${date} and "pairNumber" = ${pairNumber}
      and status <> 'CANCELLED'
    limit 1
  `
  if (active.length > 0) {
    return NextResponse.json({ error: 'Для этого занятия уже создан поиск замены' }, { status: 400 })
  }

  const candidates = await sql<{ id: number; email: string; fullName: string }[]>`
    select id, email, "fullName"
    from "User"
    where id in ${sql(candidateIds.filter((n) => n !== me.id))}
  `
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Кандидаты не выбраны' }, { status: 400 })
  }

  const replacementId = await sql.begin(async (tx) => {
    const rows = await tx<{ id: number }[]>`
      insert into "Replacement" (discipline, "groupId", kind, room, "lessonDate", "pairNumber", "initiatorId")
      values (${lesson.discipline}, ${lesson.groupId}, ${lesson.kind}, ${lesson.room}, ${date}, ${pairNumber}, ${me.id})
      returning id
    `
    const id = rows[0].id
    await tx`
      insert into "ReplacementRequest" ("replacementId", "teacherId")
      values ${tx(candidates.map((c) => [id, c.id]))}
    `
    return id
  })

  const t = pairTime(pairNumber)
  for (const c of candidates) {
    await sql`
      insert into "MailLog" ("toEmail", "toName", type, subject, body)
      values (
        ${c.email},
        ${c.fullName},
        'REPLACEMENT_REQUEST',
        ${`Просьба о замене: ${lesson.discipline} (${fmtDate(date)})`},
        ${`Здравствуйте, ${c.fullName}!\n\n${me.fullName} просит заменить занятие:\n${lesson.discipline} (${lesson.kind}), группа ${lesson.groupId}\nДата: ${fmtDate(date)}, ${pairNumber}-я пара (${t.start}–${t.end}), ауд. ${lesson.room ?? '—'}\n\nОтветить можно в приложении «Ассистент кафедры ПМН».`}
      )
    `
  }

  const created = await sql<ReplacementRow[]>`${replacementSelect} where r.id = ${replacementId}`
  const requests = await loadRequests([replacementId])

  return NextResponse.json({ replacement: toDTO(created[0], requests) })
}
