// Синхронизация расписания кафедры с rasp.sstu.ru
// Запуск: node scripts/sync-rasp.mjs   (или: npm run sync:rasp)
//
// Страница https://rasp.sstu.ru/rasp/department/204 содержит расписание всех
// преподавателей кафедры по дням недели. Скрипт разбирает её и переписывает
// таблицу RaspEntry (из неё читает приложение).
import postgres from 'postgres'
import { loadEnv } from './env.mjs'

const DEPARTMENT_URL = process.env.RASP_URL ?? 'https://rasp.sstu.ru/rasp/department/204'

const sql = postgres(loadEnv(), { max: 4, prepare: false, onnotice: () => {} })

function decode(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function textOf(html) {
  return decode(html.replace(/<[^>]+>/g, ' '))
}

// 23.11 -> 2026-11-23 (год берём текущий, с поправкой на переход через Новый год)
function toIso(day, month, today = new Date()) {
  let year = today.getFullYear()
  const m = Number(month)
  const tm = today.getMonth() + 1
  if (m === 12 && tm === 1) year -= 1
  if (m === 1 && tm === 12) year += 1
  return `${year}-${String(m).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

export function parseDepartment(html, today = new Date()) {
  const rows = []
  // у преподавателя может быть несколько таблиц (разные недели) — берём весь блок до следующего h5
  const chunks = html.split('<h5 class="teacher">').slice(1)

  for (const chunk of chunks) {
    const headEnd = chunk.indexOf('</h5>')
    if (headEnd === -1) continue
    const teacherName = textOf(chunk.slice(0, headEnd))
    if (!teacherName) continue
    const body = chunk.slice(headEnd + 5)

    let currentDate = null
    for (const table of body.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
      for (const tr of table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
        const row = tr[1]

        const dayCell = row.match(/<td[^>]*class="day"[^>]*>([\s\S]*?)<\/td>/)
        if (dayCell) {
          const dm = textOf(dayCell[1]).match(/(\d{1,2})\.(\d{1,2})/)
          if (dm) currentDate = toIso(dm[1], dm[2], today)
        }

        const hour = row.match(/class="hour d-none d-md-table-cell"[^>]*>\s*(\d+)/)
        const room = row.match(/class="room d-none d-md-table-cell"[^>]*>([\s\S]*?)<\/td>/)
        const group = row.match(/class="group d-none d-md-table-cell"[^>]*>([\s\S]*?)<\/td>/)
        const lesson = row.match(/<td class="lesson">([\s\S]*?)<\/td>/)
        if (!hour || !currentDate || !lesson) continue

        // из ячейки предмета убираем мобильный дубль (пара/аудитория/группа)
        const discipline = textOf(lesson[1].replace(/<div class="d-block d-md-none">[\s\S]*?<\/div>\s*<\/div>/g, ' '))
        if (!discipline) continue

        rows.push({
          teacherName,
          date: currentDate,
          pairNumber: Number(hour[1]),
          discipline,
          kind: '',
          groupId: group ? textOf(group[1]) : '',
          room: room ? textOf(room[1]) : '',
        })
      }
    }
  }

  return rows
}

async function main() {
  process.stdout.write(`Загрузка ${DEPARTMENT_URL} … `)
  const res = await fetch(DEPARTMENT_URL, { headers: { 'user-agent': 'kafedra-assistant/1.0' } })
  if (!res.ok) throw new Error(`rasp.sstu.ru ответил ${res.status}`)
  const html = await res.text()
  console.log(`ok, ${html.length} байт`)

  const rows = parseDepartment(html)
  if (rows.length === 0) throw new Error('Не удалось разобрать расписание: 0 занятий')

  const teachers = new Set(rows.map((r) => r.teacherName))
  const dates = [...new Set(rows.map((r) => r.date))].sort()

  await sql`truncate table "RaspEntry" restart identity`
  await sql`
    insert into "RaspEntry" ("teacherName", date, "pairNumber", discipline, kind, "groupId", room)
    values ${sql(rows.map((r) => [r.teacherName, r.date, r.pairNumber, r.discipline, r.kind, r.groupId, r.room]))}
  `

  console.log(`Готово: ${rows.length} занятий, ${teachers.size} преподавателей, дни ${dates[0]} … ${dates[dates.length - 1]}`)
  await sql.end()
}

if (process.argv[1] && process.argv[1].endsWith('sync-rasp.mjs')) {
  main().catch(async (e) => {
    console.error('Ошибка синхронизации:', e.message)
    await sql.end()
    process.exit(1)
  })
}
