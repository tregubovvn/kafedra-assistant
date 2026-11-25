import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
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

  // upsert-заглушка: строка настроек всегда существует
  const rows = await sql<{ deepseekApiKey: string }[]>`
    insert into "Settings" (id, "deepseekApiKey")
    values (1, '')
    on conflict (id) do update set "deepseekApiKey" = "Settings"."deepseekApiKey"
    returning "deepseekApiKey"
  `
  const settings = rows[0]
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

  await sql`
    insert into "Settings" (id, "deepseekApiKey")
    values (1, ${deepseekApiKey})
    on conflict (id) do update set "deepseekApiKey" = excluded."deepseekApiKey"
  `
  return NextResponse.json({ keySet: Boolean(deepseekApiKey), maskedKey: maskKey(deepseekApiKey) })
}
