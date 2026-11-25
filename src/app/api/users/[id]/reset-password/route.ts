import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, hashPassword, generatePassword } from '@/lib/server/auth'

// Сброс пароля преподавателя (только заведующий)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const { id } = await ctx.params
  const userId = Number(id)
  if (!Number.isInteger(userId)) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  const password = generatePassword()
  await db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password) } })
  await db.session.deleteMany({ where: { userId } })

  await db.mailLog.create({
    data: {
      toEmail: user.email,
      toName: user.fullName,
      type: 'PASSWORD_RESET',
      subject: 'Сброс пароля',
      body: `Здравствуйте, ${user.fullName}!\n\nВаш пароль в приложении «Ассистент кафедры ПМН» сброшен.\nНовый пароль: ${password}`,
    },
  })

  return NextResponse.json({ password })
}
