// Общие константы и хелперы для дат, пар и статусов (используются и на клиенте, и на сервере)

export const PAIR_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08:00', end: '09:30' },
  2: { start: '09:45', end: '11:15' },
  3: { start: '11:30', end: '13:00' },
  4: { start: '13:40', end: '15:10' },
  5: { start: '15:20', end: '16:50' },
}

export const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// Локальная дата в формате YYYY-MM-DD (без сдвигов таймзоны)
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function dateFromStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dateFromStr(s).getTime())
}

export function addDaysStr(s: string, days: number): string {
  const d = dateFromStr(s)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// 0 = понедельник ... 6 = воскресенье
export function weekdayIndex(s: string): number {
  return (dateFromStr(s).getDay() + 6) % 7
}

export function weekdayName(s: string): string {
  return WEEKDAYS[weekdayIndex(s)]
}

// «ср, 25.11.2026»
export function fmtDate(s: string): string {
  const [, m, d] = s.split('-')
  return `${d}.${m}.${s.slice(0, 4)}`
}

export function fmtDateShort(s: string): string {
  const [, m, d] = s.split('-')
  return `${d}.${m}`
}

export function daysLeft(dueDate: string): number {
  const a = dateFromStr(todayStr()).getTime()
  const b = dateFromStr(dueDate).getTime()
  return Math.round((b - a) / 86400000)
}

export type Urgency = 'today' | 'soon' | 'normal' | 'overdue'

export function urgencyOf(dueDate: string): Urgency {
  const dl = daysLeft(dueDate)
  if (dl < 0) return 'overdue'
  if (dl === 0) return 'today'
  if (dl < 3) return 'soon'
  return 'normal'
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  today: 'Срок сегодня',
  soon: 'Меньше 3 дней',
  normal: 'В работе',
  overdue: 'Срок истёк',
}

export const URGENCY_CLASS: Record<Urgency, string> = {
  today: 'bg-red-50 border-red-300',
  soon: 'bg-violet-50 border-violet-300',
  normal: 'bg-white border-green-200',
  overdue: 'bg-stone-100 border-stone-300',
}

export const URGENCY_BADGE_CLASS: Record<Urgency, string> = {
  today: 'bg-red-600 text-white',
  soon: 'bg-violet-600 text-white',
  normal: 'bg-green-700 text-white',
  overdue: 'bg-stone-500 text-white',
}

// Виды работ
export const WORK_TYPES = ['TEACHING', 'TEACHING_METHODICAL', 'ORG_METHODICAL', 'RESEARCH', 'EDUCATIONAL'] as const
export type WorkType = (typeof WORK_TYPES)[number]

export const WORK_TYPE_LABEL: Record<string, string> = {
  TEACHING: 'Учебная',
  TEACHING_METHODICAL: 'Учебно-методическая',
  ORG_METHODICAL: 'Организационно-методическая',
  RESEARCH: 'Научно-исследовательская',
  EDUCATIONAL: 'Воспитательная и социально-культурная',
}

export const REPLACEMENT_STATUS_LABEL: Record<string, string> = {
  SEARCHING: 'Поиск преподавателя',
  FOUND: 'Замена подобрана',
  CANCELLED: 'Поиск отменён',
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает ответа',
  ACCEPTED: 'Согласился',
  CANCELLED: 'Отменено',
  DECLINED: 'Отклонено',
}

export const MAIL_TYPE_LABEL: Record<string, string> = {
  ASSIGNMENT_NEW: 'Новое поручение',
  ASSIGNMENT_REMINDER: 'Напоминание о поручении',
  REPLACEMENT_REQUEST: 'Просьба о замене',
  REPLACEMENT_FOUND: 'Замена подобрана',
  REPLACEMENT_ASSIGNED: 'Замена назначена',
  ACCOUNT_CREATED: 'Учётная запись создана',
  PASSWORD_RESET: 'Сброс пароля',
}

export function pairTime(pair: number): { start: string; end: string } {
  return PAIR_TIMES[pair] ?? { start: '—', end: '—' }
}
