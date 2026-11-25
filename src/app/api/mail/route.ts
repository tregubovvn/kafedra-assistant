import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { todayStr } from '@/lib/schedule'

// Журнал исходящих писем (только заведующий)
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const items = await sql<{
    id: number
    toEmail: string
    toName: string
    type: string
    subject: string
    body: string
    createdAt: Date
  }[]>`
    select id, "toEmail", "toName", type, subject, body, "createdAt"
    from "MailLog"
    order by id desc
    limit 300
  `

  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id,
      toEmail: m.toEmail,
      toName: m.toName,
      type: m.type,
      subject: m.subject,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}

// Демо-триггер напоминаний о поручениях (в продакшене — ежедневный cron).
// Отправляет напоминание тем, кто не выполнил поручение со сроком «сегодня».
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (body?.action !== 'send-reminders') {
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  }

  const today = todayStr()
  const pending = await sql<{
    description: string
    email: string
    fullName: string
  }[]>`
    select a.description, u.email, u."fullName"
    from "Assignment" a
    join "AssignmentStatus" s on s."assignmentId" = a.id
    join "User" u on u.id = s."teacherId"
    where a."dueDate" = ${today} and s.completed = false
  `

  for (const p of pending) {
    await sql`
      insert into "MailLog" ("toEmail", "toName", type, subject, body)
      values (
        ${p.email},
        ${p.fullName},
        'ASSIGNMENT_REMINDER',
        'Последний день: поручение',
        ${`Здравствуйте, ${p.fullName}!\n\nСегодня последний день срока поручения:\n«${p.description}»\n\nЕсли оно уже выполнено, отметьте это в приложении «Ассистент кафедры ПМН».`}
      )
    `
  }

  return NextResponse.json({ sent: pending.length })
}
