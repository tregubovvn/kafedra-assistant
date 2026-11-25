// Клиентский хелпер для вызова API

const TOKEN_KEY = 'kafedra_token'

// Если приложение опубликовано по подпути (basePath), /api тоже идёт с префиксом
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (opts?.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(BASE_PATH + path, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError('Нет связи с сервером', 0)
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // пустой ответ
  }

  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Ошибка запроса (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}
