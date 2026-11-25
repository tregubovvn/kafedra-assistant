import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, hashPassword, generatePassword } from '@/lib/server/auth'

// Список пользователей (только заведующий)
export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const users = await db.user.findMany({
    orderBy: [{ role: 'desc' }, { fullName: 'asc' }],
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
  })
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
  const exists = await db.user.findUnique({ where: { email } })
  if (exists) return NextResponse.json({ error: 'Пользователь с таким e-mail уже существует' }, { status: 400 })

  const password = generatePassword()
  const user = await db.user.create({
    data: { fullName, email, role: 'TEACHER', passwordHash: hashPassword(password) },
  })

  await db.mailLog.create({
    data: {
      toEmail: email,
      toName: fullName,
      type: 'ACCOUNT_CREATED',
      subject: 'Создана учётная запись преподавателя',
      body: `Здравствуйте, ${fullName}!\n\nДля вас создана учётная запись в приложении «Ассистент кафедры ПМН».\nВход: ${email}\nПароль: ${password}\n\nПриложение: https://tregubovvn.ru/`,
    },
  })

  return NextResponse.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    password,
  })
}
