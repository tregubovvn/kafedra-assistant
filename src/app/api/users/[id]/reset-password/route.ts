import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSessionUser, hashPassword, generatePassword } from '@/lib/server/auth'

// Сброс пароля преподавателя (только заведующий)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const { id } = await ctx.params
  const userId = Number(id)
  if (!Number.isInteger(userId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const rows = await sql<{ id: number; email: string; fullName: string }[]>`
    select id, email, "fullName" from "User" where id = ${userId}
  `
  const user = rows[0]
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  const password = generatePassword()
  await sql.begin(async (tx) => {
    await tx`update "User" set "passwordHash" = ${hashPassword(password)} where id = ${userId}`
    await tx`delete from "Session" where "userId" = ${userId}`
    await tx`
      insert into "MailLog" ("toEmail", "toName", type, subject, body)
      values (
        ${user.email},
        ${user.fullName},
        'PASSWORD_RESET',
        'Сброс пароля',
        ${`Здравствуйте, ${user.fullName}!\n\nВаш пароль в приложении «Ассистент кафедры ПМН» сброшен.\nНовый пароль: ${password}`}
      )
    `
  })

  return NextResponse.json({ password })
}
