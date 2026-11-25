import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return `${key.slice(0, 2)}••••`
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}

export async function GET(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  let settings = await db.settings.findUnique({ where: { id: 1 } })
  if (!settings) {
    settings = await db.settings.create({ data: { id: 1, deepseekApiKey: '' } })
  }
  return NextResponse.json({
    keySet: Boolean(settings.deepseekApiKey),
    maskedKey: maskKey(settings.deepseekApiKey),
  })
}

export async function PUT(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const deepseekApiKey = typeof body?.deepseekApiKey === 'string' ? body.deepseekApiKey.trim() : ''

  await db.settings.upsert({
    where: { id: 1 },
    update: { deepseekApiKey },
    create: { id: 1, deepseekApiKey },
  })
  return NextResponse.json({ keySet: Boolean(deepseekApiKey), maskedKey: maskKey(deepseekApiKey) })
}
