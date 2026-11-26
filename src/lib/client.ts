// Клиентский слой данных.
// Node-сервера больше нет: браузер ходит в Supabase REST (PostgREST) напрямую.
// Настройки (URL, anon key, общий пароль) лежат в /config.js — его можно править на сервере без пересборки.

import type { AppUser } from './types'

const TOKEN_KEY = 'kafedra_token'
const USER_KEY = 'kafedra_user'

// Приложение публикуется по подпути (/kafedra-assistant)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

type Config = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SHARED_PASSWORD: string }

function config(): Config {
  const fromWindow =
    typeof window !== 'undefined'
      ? (window as unknown as { KAFEDRA_CONFIG?: Partial<Config> }).KAFEDRA_CONFIG
      : undefined
  return {
    SUPABASE_URL: fromWindow?.SUPABASE_URL ?? 'https://jxhwppkpymdzgsqhmxgn.supabase.co',
    SUPABASE_ANON_KEY: fromWindow?.SUPABASE_ANON_KEY ?? '',
    SHARED_PASSWORD: fromWindow?.SHARED_PASSWORD ?? 'demo1234',
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
  }
}

function getStoredUser(): AppUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AppUser
  } catch {
    return null
  }
}

function setStoredUser(user: AppUser | null) {
  if (typeof window === 'undefined') return
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  else window.localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function requireUser(): AppUser {
  const user = getStoredUser()
  if (!user) throw new ApiError('Не авторизован', 401)
  return user
}

function requireHead(): AppUser {
  const user = requireUser()
  if (user.role !== 'HEAD') throw new ApiError('Доступно только заведующему', 403)
  return user
}

// --- низкоуровневый доступ к PostgREST -------------------------------------

async function rest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<T> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = config()
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('ВСТАВЬТЕ')) {
    throw new ApiError(
      'Не заполнен config.js: вставьте anon public key проекта Supabase в SUPABASE_ANON_KEY',
      500
    )
  }

  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: init.method ?? 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: init.prefer ?? 'return=representation',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError('Нет связи с Supabase', 0)
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg = (data as { message?: string } | null)?.message ?? `Ошибка Supabase (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

const q = (s: string) => encodeURIComponent(s)

// --- утилиты ---------------------------------------------------------------

const iso = (v: unknown) => (typeof v === 'string' ? v : new Date(v as string).toISOString())

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return `${key.slice(0, 2)}••••`
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}

// --- API (совместимо с прежними путями /api/...) ---------------------------

export async function api<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const url = new URL(path, 'http://local')
  const p = url.pathname
  const params = url.searchParams
  const method = opts?.method ?? 'GET'
  const body = (opts?.body ?? {}) as Record<string, unknown>

  // ---------- вход ----------
  if (p === '/api/auth/login' && method === 'POST') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (!email || !password) throw new ApiError('Укажите e-mail и пароль', 400)
    if (password !== config().SHARED_PASSWORD) throw new ApiError('Неверный пароль', 401)

    const rows = await rest<AppUser[]>(`User?select=id,email,"fullName",role&email=eq.${q(email)}&limit=1`)
    const user = rows[0]
    if (!user) throw new ApiError('Пользователь с таким e-mail не найден', 401)

    const token = `shared.${user.id}.${Date.now()}`
    setToken(token)
    setStoredUser(user)
    return { token, user } as T
  }

  if (p === '/api/auth/me') {
    const user = requireUser()
    return { user } as T
  }

  // ---------- пользователи ----------
  if (p === '/api/users' && method === 'GET') {
    requireHead()
    const users = await rest(
      'User?select=id,email,"fullName",role,position,degree,"createdAt"&order=role.desc,"fullName".asc'
    )
    return { users } as T
  }

  if (p === '/api/users' && method === 'POST') {
    requireHead()
    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!fullName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ApiError('Укажите ФИО и корректный e-mail', 400)
    }
    const exists = await rest(`User?select=id&email=eq.${q(email)}&limit=1`)
    if ((exists as unknown[]).length > 0) throw new ApiError('Пользователь с таким e-mail уже существует', 400)

    const rows = await rest<{ id: number; email: string; fullName: string; role: string }[]>(
      'User',
      {
        method: 'POST',
        body: { fullName, email, role: 'TEACHER', passwordHash: 'shared', position: body.position ?? '', degree: body.degree ?? '' },
        prefer: 'return=representation',
      }
    )
    const user = rows[0]

    await rest('MailLog', {
      method: 'POST',
      body: {
        toEmail: email,
        toName: fullName,
        type: 'ACCOUNT_CREATED',
        subject: 'Создана учётная запись преподавателя',
        body: `Здравствуйте, ${fullName}!\n\nДля вас создана учётная запись. Вход: ${email}, пароль общий для кафедры.`,
      },
      prefer: 'return=minimal',
    })

    return { user, password: config().SHARED_PASSWORD } as T
  }

  const userMatch = p.match(/^\/api\/users\/(\d+)$/)
  if (userMatch && method === 'DELETE') {
    requireHead()
    const id = Number(userMatch[1])
    const rows = await rest<{ role: string }[]>(`User?select=role&id=eq.${id}`)
    if (!rows[0]) throw new ApiError('Пользователь не найден', 404)
    if (rows[0].role === 'HEAD') throw new ApiError('Учётную запись заведующего удалить нельзя', 400)
    await rest(`User?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' })
    return { ok: true } as T
  }

  const resetMatch = p.match(/^\/api\/users\/(\d+)\/reset-password$/)
  if (resetMatch && method === 'POST') {
    requireHead()
    const id = Number(resetMatch[1])
    const rows = await rest(`User?select=id&id=eq.${id}`)
    if ((rows as unknown[]).length === 0) throw new ApiError('Пользователь не найден', 404)
    // Пароль общий для всех — сбрасывать нечего
    return { password: config().SHARED_PASSWORD } as T
  }

  // ---------- настройки ----------
  if (p === '/api/settings' && method === 'GET') {
    requireHead()
    let rows = await rest<{ deepseekApiKey: string }[]>('Settings?select=*&id=eq.1')
    if (rows.length === 0) {
      rows = await rest<{ deepseekApiKey: string }[]>('Settings', {
        method: 'POST',
        body: { id: 1, deepseekApiKey: '' },
      })
    }
    const key = rows[0]?.deepseekApiKey ?? ''
    return { keySet: Boolean(key), maskedKey: maskKey(key) } as T
  }

  if (p === '/api/settings' && method === 'PUT') {
    requireHead()
    const deepseekApiKey = String(body.deepseekApiKey ?? '').trim()
    await rest('Settings', {
      method: 'POST',
      body: { id: 1, deepseekApiKey },
      prefer: 'resolution=merge-duplicates,return=minimal',
    })
    return { keySet: Boolean(deepseekApiKey), maskedKey: maskKey(deepseekApiKey) } as T
  }

  // ---------- журнал работ ----------
  if (p === '/api/works' && method === 'GET') {
    const me = requireUser()
    const mine = params.get('mine') === '1'
    const teacherId = params.get('teacherId')
    const month = params.get('month')
    const type = params.get('type')

    let userId: number | null = null
    if (mine || me.role === 'TEACHER') userId = me.id
    else if (teacherId && Number.isInteger(Number(teacherId))) userId = Number(teacherId)

    const sp = new URLSearchParams()
    sp.set('select', 'id,"userId",title,date,type,description,"authorDescription","newsUrl","replacementId","autoGenerated","createdAt",user:User("fullName")')
    sp.set('order', 'date.desc,id.desc')
    sp.set('limit', '500')
    if (userId !== null) sp.set('"userId"', `eq.${userId}`)
    if (month && /^\d{4}-\d{2}$/.test(month)) sp.set('date', `like.${month}%`)
    if (type) sp.set('type', `eq.${type}`)

    const rows = await rest<{
      id: number
      userId: number
      user: { fullName: string }
      title: string
      date: string
      type: string
      description: string
      authorDescription: string
      newsUrl: string | null
      replacementId: number | null
      autoGenerated: boolean
      createdAt: string
    }[]>(`Work?${sp.toString()}`)

    return {
      works: rows.map((w) => ({
        id: w.id,
        userId: w.userId,
        userFullName: w.user.fullName,
        title: w.title,
        date: w.date,
        type: w.type,
        description: w.description,
        authorDescription: w.authorDescription,
        newsUrl: w.newsUrl,
        replacementId: w.replacementId,
        autoGenerated: w.autoGenerated,
        createdAt: iso(w.createdAt),
      })),
    } as T
  }

  if (p === '/api/works' && method === 'POST') {
    const me = requireUser()
    const rows = await rest('Work', {
      method: 'POST',
      body: {
        userId: me.id,
        title: String(body.title ?? '').trim(),
        date: body.date,
        type: body.type,
        description: body.description,
        authorDescription: body.authorDescription ?? '',
        newsUrl: body.newsUrl ?? null,
      },
    })
    return { work: (rows as unknown[])[0] } as T
  }

  const workMatch = p.match(/^\/api\/works\/(\d+)$/)
  if (workMatch && method === 'PATCH') {
    const me = requireUser()
    const id = Number(workMatch[1])
    const found = await rest<any[]>(`Work?select=id,"userId"&id=eq.${id}`)
    if (!found[0]) throw new ApiError('Работа не найдена', 404)
    if (me.role !== 'HEAD' && found[0].userId !== me.id) {
      throw new ApiError('Можно редактировать только свои работы', 403)
    }

    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) patch.title = String(body.title)
    if (body.description !== undefined) patch.description = String(body.description)
    if (body.authorDescription !== undefined) patch.authorDescription = String(body.authorDescription)
    if (body.date !== undefined) patch.date = String(body.date)
    if (body.type !== undefined) patch.type = String(body.type)
    if (body.newsUrl !== undefined) patch.newsUrl = body.newsUrl || null

    const updated = await rest<any[]>(`Work?id=eq.${id}`, { method: 'PATCH', body: patch })
    return { work: updated[0] } as T
  }

  // ---------- поручения ----------
  if (p === '/api/assignments' && method === 'GET') {
    const me = requireUser()
    const rows = await rest<
      {
        id: number
        title: string
        description: string
        completionCriteria: string
        dueDate: string
        dueTime: string
        requireResult: boolean
        forAll: boolean
        createdAt: string
        statuses: {
          teacherId: number
          completed: boolean
          completedAt: string | null
          result: string
          teacher: { fullName: string }
        }[]
      }[]
    >(
      'Assignment?select=id,title,description,"completionCriteria","dueDate","dueTime","requireResult","forAll","createdAt",statuses:AssignmentStatus("teacherId",completed,"completedAt",result,teacher:User("fullName"))&order="dueDate".desc,id.desc'
    )

    const list = me.role === 'TEACHER' ? rows.filter((a) => a.statuses.some((s) => s.teacherId === me.id)) : rows

    return {
      assignments: list.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        completionCriteria: a.completionCriteria,
        dueDate: a.dueDate,
        dueTime: a.dueTime,
        requireResult: a.requireResult,
        forAll: a.forAll,
        createdAt: iso(a.createdAt),
        statuses: [...a.statuses]
          .sort((x, y) => x.teacherId - y.teacherId)
          .map((s) => ({
            teacherId: s.teacherId,
            teacherFullName: s.teacher.fullName,
            completed: s.completed,
            completedAt: s.completedAt ? iso(s.completedAt) : null,
            result: s.result ?? '',
          })),
      })),
    } as T
  }

  if (p === '/api/assignments' && method === 'POST') {
    const me = requireHead()
    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    const completionCriteria = String(body.completionCriteria ?? '').trim()
    const dueDate = body.dueDate as string
    const dueTime = String(body.dueTime ?? '')
    const requireResult = body.requireResult === true
    const forAll = body.forAll === true
    const teacherIds: number[] = Array.isArray(body.teacherIds) ? body.teacherIds.map(Number) : []

    if (title.length < 3) throw new ApiError('Укажите название поручения', 400)
    if (description.length < 5) throw new ApiError('Опишите поручение', 400)

    const teachers = await rest<{ id: number; email: string; fullName: string }[]>(
      'User?select=id,email,"fullName"&role=eq.TEACHER&order="fullName".asc'
    )
    const recipients = forAll ? teachers : teachers.filter((t) => teacherIds.includes(t.id))
    if (recipients.length === 0) throw new ApiError('Выберите адресатов поручения', 400)

    const created = await rest<any[]>('Assignment', {
      method: 'POST',
      body: {
        title,
        description,
        completionCriteria,
        dueDate,
        dueTime,
        requireResult,
        forAll,
        createdBy: me.id,
      },
    })
    const assignment = created[0]

    await rest('AssignmentStatus', {
      method: 'POST',
      body: recipients.map((t) => ({ assignmentId: assignment.id, teacherId: t.id })),
      prefer: 'return=minimal',
    })

    const deadline = dueTime ? `${dueDate} ${dueTime}` : dueDate
    for (const t of recipients) {
      await rest('MailLog', {
        method: 'POST',
        body: {
          toEmail: t.email,
          toName: t.fullName,
          type: 'ASSIGNMENT_NEW',
          subject: `Новое поручение: ${title}`,
          body: `Здравствуйте, ${t.fullName}!\n\nВам назначено поручение «${title}»:\n${description}\n\nЧто нужно сделать: ${completionCriteria || '—'}\nСрок: ${deadline}.${requireResult ? '\n\nПо завершении обязательно опишите результат.' : ''}`,
        },
        prefer: 'return=minimal',
      })
    }

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        completionCriteria: assignment.completionCriteria,
        dueDate: assignment.dueDate,
        dueTime: assignment.dueTime,
        requireResult: assignment.requireResult,
        forAll: assignment.forAll,
        createdAt: iso(assignment.createdAt),
        statuses: recipients
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((t) => ({
            teacherId: t.id,
            teacherFullName: t.fullName,
            completed: false,
            completedAt: null,
            result: '',
          })),
      },
    } as T
  }

  const assignmentMatch = p.match(/^\/api\/assignments\/(\d+)$/)
  if (assignmentMatch && method === 'PATCH') {
    requireHead()
    const id = Number(assignmentMatch[1])
    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) patch.title = String(body.title)
    if (body.description !== undefined) patch.description = String(body.description)
    if (body.completionCriteria !== undefined) patch.completionCriteria = String(body.completionCriteria)
    if (body.dueDate !== undefined) patch.dueDate = String(body.dueDate)
    if (body.dueTime !== undefined) patch.dueTime = String(body.dueTime)
    if (body.requireResult !== undefined) patch.requireResult = body.requireResult === true

    const updated = await rest<any[]>(`Assignment?id=eq.${id}`, { method: 'PATCH', body: patch })
    if (updated.length === 0) throw new ApiError('Поручение не найдено', 404)
    return { assignment: updated[0] } as T
  }

  const completeMatch = p.match(/^\/api\/assignments\/(\d+)\/complete$/)
  if (completeMatch && method === 'POST') {
    const me = requireUser()
    if (me.role !== 'TEACHER') throw new ApiError('Отметку ставит преподаватель', 403)
    const assignmentId = Number(completeMatch[1])
    const result = String(body.result ?? '').trim()

    const assignment = await rest<any[]>(`Assignment?select=id,"requireResult"&id=eq.${assignmentId}`)
    if (!assignment[0]) throw new ApiError('Поручение не найдено', 404)
    if (assignment[0].requireResult && result.length < 3) {
      throw new ApiError('Опишите результат выполнения — это обязательное условие поручения', 400)
    }

    const updated = await rest<{ completed: boolean; completedAt: string | null; result: string }[]>(
      `AssignmentStatus?assignmentId=eq.${assignmentId}&teacherId=eq.${me.id}`,
      {
        method: 'PATCH',
        body: { completed: true, completedAt: new Date().toISOString(), result },
      }
    )
    if (updated.length === 0) throw new ApiError('Это поручение вам не адресовано', 403)

    return {
      completed: updated[0].completed,
      completedAt: updated[0].completedAt ? iso(updated[0].completedAt) : null,
      result: updated[0].result ?? '',
    } as T
  }

  // ---------- замены ----------
  if (p === '/api/replacements' && method === 'GET') {
    const me = requireUser()
    const select =
      'select=*,initiator:User!Replacement_initiatorId_fkey("fullName"),substitute:User!Replacement_substituteId_fkey("fullName"),requests:ReplacementRequest(id,"teacherId",status,teacher:User("fullName"))&order="lessonDate".asc,"pairNumber".asc'

    const toDTO = (r: any) => ({
      id: r.id,
      discipline: r.discipline,
      groupId: r.groupId,
      kind: r.kind,
      room: r.room,
      lessonDate: r.lessonDate,
      pairNumber: r.pairNumber,
      initiatorId: r.initiatorId,
      initiatorFullName: r.initiator?.fullName ?? '',
      substituteId: r.substituteId,
      substituteFullName: r.substitute?.fullName ?? null,
      status: r.status,
      assignedByHead: r.assignedByHead,
      createdAt: iso(r.createdAt),
      requests: (r.requests ?? [])
        .slice()
        .sort((a: any, b: any) => a.id - b.id)
        .map((q2: any) => ({
          id: q2.id,
          teacherId: q2.teacherId,
          teacherFullName: q2.teacher?.fullName ?? '',
          status: q2.status,
        })),
    })

    if (me.role === 'HEAD') {
      const rows = await rest<any[]>(`Replacement?${select}&status=neq.CANCELLED`)
      return { replacements: rows.map(toDTO) } as T
    }

    const mine = await rest<any[]>(
      `Replacement?${select}&"initiatorId"=eq.${me.id}&status=neq.CANCELLED`
    )
    const incomingRows = await rest<any[]>(
      `ReplacementRequest?select=id,status,replacement:Replacement!inner(*,initiator:User!Replacement_initiatorId_fkey("fullName"),substitute:User!Replacement_substituteId_fkey("fullName"),requests:ReplacementRequest(id,"teacherId",status,teacher:User("fullName")))&teacherId=eq.${me.id}&status=eq.PENDING&replacement.status=eq.SEARCHING`
    )

    const incoming = incomingRows.map((row) => ({ requestId: row.id, replacement: toDTO(row.replacement) }))

    return { mine: mine.map(toDTO), incoming } as T
  }

  if (p === '/api/replacements' && method === 'POST') {
    const me = requireUser()
    if (me.role !== 'TEACHER') throw new ApiError('Поиск замены инициирует преподаватель', 403)

    const date = body.date as string
    const pairNumber = Number(body.pairNumber)
    const candidateIds: number[] = Array.isArray(body.candidateIds)
      ? [...new Set(body.candidateIds.map(Number))]
      : []

    const lessons = await rest<any[]>(
      `ScheduleEntry?select=discipline,"groupId",kind,room&"ownerType"=eq.TEACHER&"ownerId"=eq.${q(
        String(me.id)
      )}&date=eq.${q(String(date))}&"pairNumber"=eq.${pairNumber}&limit=1`
    )
    const lesson = lessons[0]
    if (!lesson) throw new ApiError('Занятие не найдено в вашем расписании', 400)

    const active = await rest<any[]>(
      `Replacement?select=id&"initiatorId"=eq.${me.id}&"lessonDate"=eq.${q(
        String(date)
      )}&"pairNumber"=eq.${pairNumber}&status=neq.CANCELLED&limit=1`
    )
    if (active.length > 0) throw new ApiError('Для этого занятия уже создан поиск замены', 400)

    const ids = candidateIds.filter((n) => n !== me.id)
    if (ids.length === 0) throw new ApiError('Кандидаты не выбраны', 400)

    const created = await rest<any[]>('Replacement', {
      method: 'POST',
      body: {
        discipline: lesson.discipline,
        groupId: lesson.groupId,
        kind: lesson.kind,
        room: lesson.room,
        lessonDate: date,
        pairNumber,
        initiatorId: me.id,
      },
    })
    const replacement = created[0]

    await rest('ReplacementRequest', {
      method: 'POST',
      body: ids.map((teacherId) => ({ replacementId: replacement.id, teacherId })),
      prefer: 'return=minimal',
    })

    for (const id of ids) {
      const user = await rest<any[]>(`User?select=id,email,"fullName"&id=eq.${id}`)
      if (!user[0]) continue
      await rest('MailLog', {
        method: 'POST',
        body: {
          toEmail: user[0].email,
          toName: user[0].fullName,
          type: 'REPLACEMENT_REQUEST',
          subject: `Просьба о замене: ${lesson.discipline}`,
          body: `Здравствуйте, ${user[0].fullName}!\n\n${me.fullName} просит заменить занятие: ${lesson.discipline} (${lesson.kind}), группа ${lesson.groupId}, ${date}, ${pairNumber}-я пара.`,
        },
        prefer: 'return=minimal',
      })
    }

    const full = await rest<any[]>(
      `Replacement?select=*,initiator:User!Replacement_initiatorId_fkey("fullName"),substitute:User!Replacement_substituteId_fkey("fullName"),requests:ReplacementRequest(id,"teacherId",status,teacher:User("fullName"))&id=eq.${replacement.id}`
    )
    const r = full[0]

    return {
      replacement: {
        id: r.id,
        discipline: r.discipline,
        groupId: r.groupId,
        kind: r.kind,
        room: r.room,
        lessonDate: r.lessonDate,
        pairNumber: r.pairNumber,
        initiatorId: r.initiatorId,
        initiatorFullName: r.initiator?.fullName ?? '',
        substituteId: r.substituteId,
        substituteFullName: r.substitute?.fullName ?? null,
        status: r.status,
        assignedByHead: r.assignedByHead,
        createdAt: iso(r.createdAt),
        requests: (r.requests ?? []).map((x: any) => ({
          id: x.id,
          teacherId: x.teacherId,
          teacherFullName: x.teacher?.fullName ?? '',
          status: x.status,
        })),
      },
    } as T
  }

  // принятие / назначение / отмена / отклонение
  const actionMatch = p.match(/^\/api\/replacements\/(\d+)\/(accept|assign|decline|cancel)$/)
  if (actionMatch && method === 'POST') {
    const me = requireUser()
    const id = Number(actionMatch[1])
    const action = actionMatch[2]

    const found = await rest<any[]>(`Replacement?select=*&id=eq.${id}`)
    const r = found[0]
    if (!r) throw new ApiError('Замена не найдена', 404)

    const today = new Date().toISOString().slice(0, 10)

    if (action === 'decline') {
      const updated = await rest<any[]>(
        `ReplacementRequest?replacementId=eq.${id}&teacherId=eq.${me.id}&status=eq.PENDING`,
        { method: 'PATCH', body: { status: 'DECLINED' } }
      )
      if (updated.length === 0) throw new ApiError('Просьба не найдена или уже обработана', 400)
      return { ok: true } as T
    }

    if (action === 'cancel') {
      if (r.initiatorId !== me.id) throw new ApiError('Отменить поиск может только инициатор', 403)
      if (r.status !== 'SEARCHING') throw new ApiError('Замена уже подобрана, отменить нельзя', 400)
      await rest(`Replacement?id=eq.${id}`, { method: 'PATCH', body: { status: 'CANCELLED' } })
      await rest(`ReplacementRequest?replacementId=eq.${id}&status=eq.PENDING`, {
        method: 'PATCH',
        body: { status: 'CANCELLED' },
        prefer: 'return=minimal',
      })
      return { ok: true } as T
    }

    // accept / assign
    const isAssign = action === 'assign'
    const teacherId = isAssign ? Number(body.teacherId) : me.id

    if (isAssign && me.role !== 'HEAD') throw new ApiError('Доступно только заведующему', 403)
    if (!isAssign && me.role !== 'TEACHER') throw new ApiError('Доступно преподавателю', 403)
    if (r.status !== 'SEARCHING') throw new ApiError('Замена уже подобрана', 409)

    const target = await rest<any[]>(`User?select=id,email,"fullName"&id=eq.${teacherId}`)
    if (!target[0]) throw new ApiError('Преподаватель не найден', 404)
    if (target[0].id === r.initiatorId) throw new ApiError('Нельзя назначить самого инициатора', 400)

    const base = await rest<any[]>(
      `ScheduleEntry?select=id&"ownerType"=eq.TEACHER&"ownerId"=eq.${q(
        String(teacherId)
      )}&date=eq.${q(String(r.lessonDate))}&"pairNumber"=eq.${r.pairNumber}&limit=1`
    )
    if (base.length > 0) {
      const freed = await rest<any[]>(
        `Replacement?select=id&"initiatorId"=eq.${teacherId}&"lessonDate"=eq.${q(
          String(r.lessonDate)
        )}&"pairNumber"=eq.${r.pairNumber}&status=eq.FOUND&limit=1`
      )
      if (freed.length === 0) throw new ApiError(`У ${target[0].fullName} есть занятие в это время`, 409)
    }

    const taken = await rest<any[]>(
      `Replacement?select=id&"substituteId"=eq.${teacherId}&"lessonDate"=eq.${q(
        String(r.lessonDate)
      )}&"pairNumber"=eq.${r.pairNumber}&status=eq.FOUND&limit=1`
    )
    if (taken.length > 0) throw new ApiError(`${target[0].fullName} уже взял(а) замену на это время`, 409)

    const updated = await rest<any[]>(`Replacement?id=eq.${id}&status=eq.SEARCHING`, {
      method: 'PATCH',
      body: { status: 'FOUND', substituteId: teacherId, assignedByHead: isAssign },
    })
    if (updated.length === 0) throw new ApiError('Замена уже подобрана', 409)

    await rest(`ReplacementRequest?replacementId=eq.${id}&status=eq.PENDING`, {
      method: 'PATCH',
      body: { status: isAssign ? 'CANCELLED' : 'ACCEPTED' },
      prefer: 'return=minimal',
    })

    await rest('Work', {
      method: 'POST',
      body: {
        userId: teacherId,
        date: r.lessonDate,
        type: 'TEACHING',
        description: `Замена: ${r.discipline} (${r.kind}), группа ${r.groupId}, ${r.lessonDate}`,
        replacementId: r.id,
        autoGenerated: true,
      },
      prefer: 'return=minimal',
    })

    const initiator = await rest<any[]>(`User?select=email,"fullName"&id=eq.${r.initiatorId}`)
    if (initiator[0]) {
      await rest('MailLog', {
        method: 'POST',
        body: {
          toEmail: initiator[0].email,
          toName: initiator[0].fullName,
          type: isAssign ? 'REPLACEMENT_ASSIGNED' : 'REPLACEMENT_FOUND',
          subject: `${isAssign ? 'Замена назначена' : 'Замена подобрана'}: ${r.discipline}`,
          body: `Здравствуйте, ${initiator[0].fullName}!\n\nЗамена на ваше занятие ${r.discipline} (${r.lessonDate}): ${target[0].fullName}.`,
        },
        prefer: 'return=minimal',
      })
    }

    return { ok: true } as T
  }

  // ---------- кандидаты на замену ----------
  if (p === '/api/replacements/candidates' && method === 'GET') {
    const me = requireUser()
    const date = params.get('date') ?? ''
    const pair = Number(params.get('pair'))

    const users = await rest<{ id: number; fullName: string; role: string }[]>(
      'User?select=id,"fullName",role&order="fullName".asc'
    )
    const dayEntries = await rest<{ ownerId: string; pairNumber: number; discipline: string; groupId: string }[]>(
      `ScheduleEntry?select="ownerId","pairNumber",discipline,"groupId"&"ownerType"=eq.TEACHER&date=eq.${q(date)}`
    )
    const found = await rest<{ initiatorId: number; substituteId: number | null; pairNumber: number }[]>(
      `Replacement?select="initiatorId","substituteId","pairNumber"&"lessonDate"=eq.${q(date)}&status=eq.FOUND`
    )

    const baseByUser = new Map<number, { pairNumber: number; discipline: string; groupId: string }[]>()
    for (const e of dayEntries) {
      const uid = Number(e.ownerId)
      if (!baseByUser.has(uid)) baseByUser.set(uid, [])
      baseByUser.get(uid)!.push({ pairNumber: e.pairNumber, discipline: e.discipline, groupId: e.groupId })
    }

    const isBusy = (userId: number) => {
      const hasBase = baseByUser.get(userId)?.some((e) => e.pairNumber === pair)
      if (hasBase) {
        const freed = found.some((r) => r.initiatorId === userId && r.pairNumber === pair)
        if (!freed) return true
      }
      return found.some((r) => r.substituteId === userId && r.pairNumber === pair)
    }

    const groups = [
      { key: 'next', label: 'Следующая пара — уже в вузе', teachers: [] as any[] },
      { key: 'prev', label: 'Предыдущая пара', teachers: [] as any[] },
      { key: 'free', label: 'В этот день занятий нет', teachers: [] as any[] },
      { key: 'other', label: 'Другие преподаватели', teachers: [] as any[] },
    ]
    const g = (k: string) => groups.find((x) => x.key === k)!

    for (const u of users) {
      if (u.id === me.id || isBusy(u.id)) continue
      const day = baseByUser.get(u.id) ?? []
      let key = 'other'
      let detail = ''
      if (day.some((e) => e.pairNumber === pair + 1)) {
        key = 'next'
        const e = day.find((x) => x.pairNumber === pair + 1)!
        detail = `После замены: ${pair + 1}-я пара — ${e.discipline} (${e.groupId})`
      } else if (day.some((e) => e.pairNumber === pair - 1)) {
        key = 'prev'
        const e = day.find((x) => x.pairNumber === pair - 1)!
        detail = `Перед заменой: ${pair - 1}-я пара — ${e.discipline} (${e.groupId})`
      } else if (day.length === 0) {
        key = 'free'
        detail = u.role === 'HEAD' ? 'Заведующий кафедрой, в этот день занятий нет' : 'В этот день занятий нет'
      } else {
        const pairs = [...new Set(day.map((e) => e.pairNumber))].sort((a, b) => a - b).join(', ')
        detail = `Занятия этого дня: пары ${pairs}`
      }
      g(key).teachers.push({ id: u.id, fullName: u.fullName, role: u.role, detail, dayLoad: day.length })
    }

    for (const grp of groups) {
      grp.teachers.sort((a, b) => a.dayLoad - b.dayLoad || a.fullName.localeCompare(b.fullName, 'ru'))
    }

    return {
      groups: groups.map((grp) => ({
        key: grp.key,
        label: grp.label,
        teachers: grp.teachers.map(({ id, fullName, role, detail }) => ({ id, fullName, role, detail })),
      })),
    } as T
  }

  // ---------- расписание ----------
  if (p === '/api/schedule' && method === 'GET') {
    const me = requireUser()

    if (params.get('list') === 'groups') {
      const rows = await rest<{ ownerId: string }[]>(
        `ScheduleEntry?select="ownerId"&"ownerType"=eq.GROUP`
      )
      return { groups: [...new Set(rows.map((r) => r.ownerId))].sort() } as T
    }

    const mode = params.get('mode')
    const id = params.get('id') ?? ''
    const date = params.get('date') ?? ''
    if (mode === 'teacher' && me.role === 'TEACHER' && Number(id) !== me.id) {
      throw new ApiError('Доступно только к своему расписанию', 403)
    }

    const pairTime = (n: number) => {
      const times: Record<number, [string, string]> = {
        1: ['08:00', '09:30'],
        2: ['09:45', '11:15'],
        3: ['11:30', '13:00'],
        4: ['13:40', '15:10'],
        5: ['15:20', '16:50'],
      }
      const [start, end] = times[n] ?? ['', '']
      return { start, end }
    }

    const lessons: any[] = []

    if (mode === 'teacher') {
      const base = await rest<any[]>(
        `ScheduleEntry?select="pairNumber",discipline,kind,"groupId",room&"ownerType"=eq.TEACHER&"ownerId"=eq.${q(
          String(id)
        )}&date=eq.${q(date)}&order="pairNumber".asc`
      )
      const reps = await rest<any[]>(
        `Replacement?select="pairNumber",status,substitute:User!Replacement_substituteId_fkey("fullName")&"initiatorId"=eq.${Number(
          id
        )}&"lessonDate"=eq.${q(date)}&status=neq.CANCELLED`
      )
      for (const e of base) {
        const r = reps.find((x) => x.pairNumber === e.pairNumber)
        lessons.push({
          pairNumber: e.pairNumber,
          ...pairTime(e.pairNumber),
          discipline: e.discipline,
          kind: e.kind,
          groupId: e.groupId,
          room: e.room,
          replacedBy: r?.status === 'FOUND' ? r.substitute?.fullName ?? '—' : null,
          searching: r?.status === 'SEARCHING',
        })
      }

      const taken = await rest<any[]>(
        `Replacement?select="pairNumber",discipline,kind,"groupId",room&"substituteId"=eq.${Number(
          id
        )}&"lessonDate"=eq.${q(date)}&status=eq.FOUND&order="pairNumber".asc`
      )
      for (const r of taken) {
        lessons.push({
          pairNumber: r.pairNumber,
          ...pairTime(r.pairNumber),
          discipline: r.discipline,
          kind: r.kind,
          groupId: r.groupId,
          room: r.room,
          isSubstitution: true,
        })
      }
    } else {
      const base = await rest<any[]>(
        `ScheduleEntry?select="pairNumber",discipline,kind,"groupId",room,"teacherName"&"ownerType"=eq.GROUP&"ownerId"=eq.${q(
          id
        )}&date=eq.${q(date)}&order="pairNumber".asc`
      )
      const reps = await rest<any[]>(
        `Replacement?select="pairNumber",status,substitute:User!Replacement_substituteId_fkey("fullName")&"groupId"=eq.${q(
          id
        )}&"lessonDate"=eq.${q(date)}&status=neq.CANCELLED`
      )
      for (const e of base) {
        const r = reps.find((x) => x.pairNumber === e.pairNumber)
        lessons.push({
          pairNumber: e.pairNumber,
          ...pairTime(e.pairNumber),
          discipline: e.discipline,
          kind: e.kind,
          groupId: e.groupId,
          room: e.room,
          teacherName:
            r?.status === 'FOUND' ? `${r.substitute?.fullName ?? '—'} (замена)` : e.teacherName,
          searching: r?.status === 'SEARCHING',
        })
      }
    }

    lessons.sort((a, b) => a.pairNumber - b.pairNumber)
    return { date, mode, lessons } as T
  }

  // ---------- почта ----------
  if (p === '/api/mail' && method === 'GET') {
    requireHead()
    const items = await rest<any[]>(
      'MailLog?select=id,"toEmail","toName",type,subject,body,"createdAt"&order=id.desc&limit=300'
    )
    return {
      items: items.map((m) => ({
        id: m.id,
        toEmail: m.toEmail,
        toName: m.toName,
        type: m.type,
        subject: m.subject,
        body: m.body,
        createdAt: iso(m.createdAt),
      })),
    } as T
  }

  if (p === '/api/mail' && method === 'POST') {
    requireHead()
    if (body.action !== 'send-reminders') throw new ApiError('Неизвестное действие', 400)

    const today = new Date().toISOString().slice(0, 10)
    const rows = await rest<any[]>(
      `Assignment?select=description,statuses:AssignmentStatus(completed,teacher:User(email,"fullName"))&"dueDate"=eq.${q(
        today
      )}`
    )

    let sent = 0
    for (const a of rows) {
      for (const s of a.statuses ?? []) {
        if (s.completed) continue
        await rest('MailLog', {
          method: 'POST',
          body: {
            toEmail: s.teacher.email,
            toName: s.teacher.fullName,
            type: 'ASSIGNMENT_REMINDER',
            subject: 'Последний день: поручение',
            body: `Здравствуйте, ${s.teacher.fullName}!\n\nСегодня последний день срока поручения:\n«${a.description}»`,
          },
          prefer: 'return=minimal',
        })
        sent++
      }
    }
    return { sent } as T
  }

  // ---------- DeepSeek (из браузера может быть заблокировано CORS) ----------
  if (p === '/api/deepseek/assist' && method === 'POST') {
    requireHead()
    const draft = String(body.draft ?? '').trim()
    if (draft.length < 3) throw new ApiError('Введите черновик поручения', 400)

    const settings = await rest<{ deepseekApiKey: string }[]>('Settings?select=*&id=eq.1')
    const key = settings[0]?.deepseekApiKey ?? ''
    if (!key) throw new ApiError('Ключ DeepSeek не задан. Укажите его во вкладке «Настройки».', 400)

    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                'Ты — помощник заведующего кафедрой. Перепиши черновик поручения кратко и официально-деловым стилем, 1–3 предложения. Верни только текст.',
            },
            { role: 'user', content: draft },
          ],
          temperature: 0.5,
          max_tokens: 300,
        }),
      })
      if (!res.ok) throw new ApiError(`DeepSeek вернул ошибку ${res.status}`, 502)
      const data = await res.json()
      const text: string | undefined = data?.choices?.[0]?.message?.content
      if (!text?.trim()) throw new ApiError('DeepSeek вернул пустой ответ', 502)
      return { text: text.trim() } as T
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError('Не удалось вызвать DeepSeek из браузера (CORS). Ключ можно проверить позже.', 502)
    }
  }

  throw new ApiError(`Неизвестный запрос: ${method} ${p}`, 404)
}
