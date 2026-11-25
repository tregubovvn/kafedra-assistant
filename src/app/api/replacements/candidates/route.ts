import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { isValidDateStr } from '@/lib/schedule'

// Подбор кандидатов на замену для конкретного занятия.
// Сортировка: следующая пара -> предыдущая пара -> нет занятий в этот день -> другие.
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get('date') ?? ''
  const pair = Number(url.searchParams.get('pair'))
  if (!isValidDateStr(date)) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
  if (!(pair >= 1 && pair <= 5)) return NextResponse.json({ error: 'Некорректная пара' }, { status: 400 })

  const users = await sql<{ id: number; fullName: string; role: string }[]>`
    select id, "fullName", role
    from "User"
    where id <> ${me.id}
    order by "fullName" asc
  `

  // Занятость кандидатов в этот день
  const dayEntries = await sql<{
    ownerId: string
    pairNumber: number
    discipline: string
    groupId: string
  }[]>`
    select "ownerId", "pairNumber", discipline, "groupId"
    from "ScheduleEntry"
    where "ownerType" = 'TEACHER' and date = ${date}
  `
  const foundReplacements = await sql<{
    initiatorId: number
    substituteId: number | null
    pairNumber: number
  }[]>`
    select "initiatorId", "substituteId", "pairNumber"
    from "Replacement"
    where "lessonDate" = ${date} and status = 'FOUND'
  `

  const baseByUser = new Map<number, { pairNumber: number; discipline: string; groupId: string }[]>()
  for (const e of dayEntries) {
    const uid = Number(e.ownerId)
    if (!baseByUser.has(uid)) baseByUser.set(uid, [])
    baseByUser.get(uid)!.push({ pairNumber: e.pairNumber, discipline: e.discipline, groupId: e.groupId })
  }

  const isBusyAtSlot = (userId: number) => {
    const base = baseByUser.get(userId)?.some((e) => e.pairNumber === pair)
    if (base) {
      // своё занятие в эту пару уже заменяют — преподаватель свободен
      const freed = foundReplacements.some((r) => r.initiatorId === userId && r.pairNumber === pair)
      if (!freed) return true
    }
    // уже взял замену на эту пару
    if (foundReplacements.some((r) => r.substituteId === userId && r.pairNumber === pair)) return true
    return false
  }

  const groups: { key: 'next' | 'prev' | 'free' | 'other'; label: string; teachers: { id: number; fullName: string; role: string; detail: string; dayLoad: number }[] }[] = [
    { key: 'next', label: 'Следующая пара — уже в вузе', teachers: [] },
    { key: 'prev', label: 'Предыдущая пара', teachers: [] },
    { key: 'free', label: 'В этот день занятий нет', teachers: [] },
    { key: 'other', label: 'Другие преподаватели', teachers: [] },
  ]
  const g = (k: 'next' | 'prev' | 'free' | 'other') => groups.find((x) => x.key === k)!

  for (const u of users) {
    if (isBusyAtSlot(u.id)) continue
    const day = baseByUser.get(u.id) ?? []
    const hasNext = day.some((e) => e.pairNumber === pair + 1)
    const hasPrev = day.some((e) => e.pairNumber === pair - 1)

    let key: 'next' | 'prev' | 'free' | 'other' = 'other'
    let detail = ''
    if (hasNext) {
      key = 'next'
      const e = day.find((x) => x.pairNumber === pair + 1)!
      detail = `После замены: ${pair + 1}-я пара — ${e.discipline} (${e.groupId})`
    } else if (hasPrev) {
      key = 'prev'
      const e = day.find((x) => x.pairNumber === pair - 1)!
      detail = `Перед заменой: ${pair - 1}-я пара — ${e.discipline} (${e.groupId})`
    } else if (day.length === 0) {
      key = 'free'
      detail = u.role === 'HEAD' ? 'Заведующий кафедрой, в этот день занятий нет' : 'В этот день занятий нет'
    } else {
      const pairs = [...new Set(day.map((e) => e.pairNumber))].sort((a, b) => a - b).join(', ')
      detail = u.role === 'HEAD' ? `Заведующий кафедрой. Занятия этого дня: пары ${pairs}` : `Занятия этого дня: пары ${pairs}`
    }
    g(key).teachers.push({ id: u.id, fullName: u.fullName, role: u.role, detail, dayLoad: day.length })
  }

  for (const grp of groups) {
    grp.teachers.sort((a, b) => a.dayLoad - b.dayLoad || a.fullName.localeCompare(b.fullName, 'ru'))
  }

  return NextResponse.json({
    groups: groups.map((grp) => ({
      key: grp.key,
      label: grp.label,
      teachers: grp.teachers.map(({ id, fullName, role, detail }) => ({ id, fullName, role, detail })),
    })),
  })
}
