import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/server/auth'

// Помощь DeepSeek в формулировании поручения (только заведующий)
export async function POST(req: Request) {
  const me = await getSessionUser(req)
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (me.role !== 'HEAD') return NextResponse.json({ error: 'Доступно только заведующему' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const draft = typeof body?.draft === 'string' ? body.draft.trim() : ''
  if (draft.length < 3) return NextResponse.json({ error: 'Введите черновик поручения' }, { status: 400 })

  const settings = await db.settings.findUnique({ where: { id: 1 } })
  const key = settings?.deepseekApiKey ?? ''
  if (!key) {
    return NextResponse.json({ error: 'Ключ DeepSeek не задан. Укажите его во вкладке «Настройки».' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'Ты — помощник заведующего кафедрой университета. Перепиши черновик поручения преподавателям: кратко, конкретно, официально-деловым стилем, 1–3 предложения, с чёткой формулировкой задачи. Верни только текст поручения, без приветствий, подписей и кавычек.',
          },
          { role: 'user', content: draft },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const detail = res.status === 401 ? 'Ключ DeepSeek отклонён (проверьте его в настройках)' : `DeepSeek вернул ошибку ${res.status} ${errText.slice(0, 200)}`
      return NextResponse.json({ error: detail }, { status: 502 })
    }

    const data = await res.json()
    const text: string | undefined = data?.choices?.[0]?.message?.content
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'DeepSeek вернул пустой ответ' }, { status: 502 })
    }
    return NextResponse.json({ text: text.trim() })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'Превышено время ожидания DeepSeek (30 с)' : 'Не удалось связаться с DeepSeek API'
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
