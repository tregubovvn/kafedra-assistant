import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sql } from '@/lib/db'
import { verifyPassword, publicUser } from '@/lib/server/auth'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Укажите e-mail и пароль' }, { status: 400 })
  }

  const rows = await sql<{ id: number; email: string; fullName: string; role: string; passwordHash: string }[]>`
    select id, email, "fullName", role, "passwordHash"
    from "User"
    where email = ${email}
    limit 1
  `
  const user = rows[0]
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Неверный e-mail или пароль' }, { status: 401 })
  }

  const token = randomBytes(24).toString('hex')
  await sql`insert into "Session" (token, "userId") values (${token}, ${user.id})`

  return NextResponse.json({ token, user: publicUser(user) })
}
