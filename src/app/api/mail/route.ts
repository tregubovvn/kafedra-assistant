import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'
import { todayStr } from '@/lib/schedule'

// Журнал исходящих писем (только заведующий)
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const items = await db.mailLog.findMany({ orderBy: { id: 'desc' }, take: 300 })
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
  const assignments = await db.assignment.findMany({
    where: { dueDate: today },
    include: { statuses: { include: { teacher: true } } },
  })

  let sent = 0
  for (const a of assignments) {
    for (const s of a.statuses) {
      if (s.completed) continue
      await db.mailLog.create({
        data: {
          toEmail: s.teacher.email,
          toName: s.teacher.fullName,
          type: 'ASSIGNMENT_REMINDER',
          subject: 'Последний день: поручение',
          body: `Здравствуйте, ${s.teacher.fullName}!\n\nСегодня последний день срока поручения:\n«${a.description}»\n\nЕсли оно уже выполнено, отметьте это в приложении «Ассистент кафедры ПМН».`,
        },
      })
      sent++
    }
  }
  return NextResponse.json({ sent })
}
