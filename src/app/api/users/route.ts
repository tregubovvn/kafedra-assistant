import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser, hashPassword, generatePassword } from '@/lib/server/auth'

// Список пользователей (только заведующий)
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const users = await sql`
    select id, email, "fullName", role, "createdAt"
    from "User"
    order by role desc, "fullName" asc
  `
  return NextResponse.json({ users })
}

// Создание учётной записи преподавателя (только заведующий)
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!fullName || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Укажите ФИО и корректный e-mail' }, { status: 400 })
  }

  const exists = await sql`select 1 from "User" where email = ${email} limit 1`
  if (exists.length > 0) return NextResponse.json({ error: 'Пользователь с таким e-mail уже существует' }, { status: 400 })

  const password = generatePassword()
  const rows = await sql<{ id: number; email: string; fullName: string; role: string }[]>`
    insert into "User" ("fullName", email, role, "passwordHash")
    values (${fullName}, ${email}, 'TEACHER', ${hashPassword(password)})
    returning id, email, "fullName", role
  `
  const user = rows[0]

  await sql`
    insert into "MailLog" ("toEmail", "toName", type, subject, body)
    values (
      ${email},
      ${fullName},
      'ACCOUNT_CREATED',
      'Создана учётная запись преподавателя',
      ${`Здравствуйте, ${fullName}!\n\nДля вас создана учётная запись в приложении «Ассистент кафедры ПМН».\nВход: ${email}\nПароль: ${password}\n\nПриложение: https://tregubovvn.ru/`}
    )
  `

  return NextResponse.json({ user, password })
}
