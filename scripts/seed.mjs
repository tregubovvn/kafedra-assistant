// Демо-данные: кафедра «Производственный менеджмент» (ПМН-204) СГТУ им. Гагарина Ю.А.
// Запуск: node scripts/seed.mjs  (или: npm run db:seed)
import postgres from 'postgres'
import { randomBytes, scryptSync } from 'node:crypto'
import { loadEnv } from './env.mjs'

const sql = postgres(loadEnv(), { max: 4, prepare: false, onnotice: () => {} })

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// Детерминированный ГПСЧ, чтобы демо-данные были воспроизводимы
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(204)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const now = new Date()
const today = fmt(now)
const tomorrow = fmt(addDays(now, 1))
const dayShift = (n) => fmt(addDays(now, n))

const PAIR_TIMES = {
  1: ['08:00', '09:30'],
  2: ['09:45', '11:15'],
  3: ['11:30', '13:00'],
  4: ['13:40', '15:10'],
  5: ['15:20', '16:50'],
}

const TEACHERS = [
  ['Гримашевич Ольга Николаевна', 'grimashevich@pmn.demo'],
  ['Горячева Ирина Алексеевна', 'goryacheva@pmn.demo'],
  ['Учуваткин Александр Александрович', 'uchuvatkin@pmn.demo'],
  ['Уманский Вячеслав Юрьевич', 'umanskij@pmn.demo'],
  ['Лысикова Ольга Валерьевна', 'lysikova@pmn.demo'],
  ['Подсумкова Людмила Алексеевна', 'podsumkova@pmn.demo'],
  ['Глушкова Юлия Олеговна', 'glushkova@pmn.demo'],
  ['Славнецкова Людмила Владимировна', 'slavnetskova@pmn.demo'],
  ['Макарова Светлана Николаевна', 'makarova@pmn.demo'],
]

const DISCIPLINES = [
  'Производственная логистика',
  'Интеллектуальные транспортно-логистические системы',
  'Экономическая теория',
  'Эконометрика',
  'Менеджмент',
  'Управление качеством',
  'Бухгалтерский учёт и аудит',
  'Стратегический менеджмент',
  'Маркетинг',
  'Логистика складирования',
  'Управление персоналом',
  'Инновационный менеджмент',
  'Информационные технологии в менеджменте',
  'Исследование операций',
  'Управление проектами',
  'Финансовый менеджмент',
]
const KINDS = ['лекц', 'прак', 'лаб']
const GROUPS = [
  'б1-МЕНЖ-11', 'б1-МЕНЖ-21', 'б2-МЕНЖ-31', 'б1-ЭКОН-31', 'б2-ЭКОН-31',
  'б1-ЭКОН-41', 'б2-ЭКОН-41', 'б1-ТТПР-21', 'с1-ЭБЗ-51', 'б1-МЕНЖ-24',
]
const ROOMS = ['1/023', '1/253', '4/103', '6/024', '5/312', '2/401', '3/118', '7/205']

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000)

async function main() {
  console.log('Очистка базы...')
  await sql`
    truncate table "MailLog", "ReplacementRequest", "Replacement", "Work",
                   "AssignmentStatus", "Assignment", "Session", "ScheduleEntry",
                   "Settings", "User"
    restart identity cascade
  `

  await sql`insert into "Settings" (id, "deepseekApiKey") values (1, '')`

  console.log('Создание пользователей...')
  const pwd = hashPassword('demo1234')
  const [head] = await sql`
    insert into "User" ("fullName", email, role, "passwordHash")
    values ('Трегубов Владимир Николаевич', 'tregubovvn@outlook.com', 'HEAD', ${pwd})
    returning *
  `
  const teachers = []
  for (const [fullName, email] of TEACHERS) {
    const [t] = await sql`
      insert into "User" ("fullName", email, role, "passwordHash")
      values (${fullName}, ${email}, 'TEACHER', ${pwd})
      returning *
    `
    teachers.push(t)
  }
  const byName = Object.fromEntries(teachers.map((t) => [t.fullName, t]))
  const T = {
    grimashevich: byName['Гримашевич Ольга Николаевна'],
    goryacheva: byName['Горячева Ирина Алексеевна'],
    uchuvatkin: byName['Учуваткин Александр Александрович'],
    umanskij: byName['Уманский Вячеслав Юрьевич'],
    lysikova: byName['Лысикова Ольга Валерьевна'],
    podsumkova: byName['Подсумкова Людмила Алексеевна'],
    glushkova: byName['Глушкова Юлия Олеговна'],
    slavnetskova: byName['Славнецкова Людмила Владимировна'],
    makarova: byName['Макарова Светлана Николаевна'],
  }

  console.log('Генерация расписаний (3 недели, преподаватели + группы)...')
  const wd = (now.getDay() + 6) % 7
  const monday = addDays(now, -wd)
  const groupBusy = new Set()
  const teacherEntries = []
  const groupEntries = []
  const addEntries = (u, date, pair, lesson, group) => {
    teacherEntries.push(['TEACHER', String(u.id), date, pair, lesson.discipline, lesson.kind, group, lesson.room, null])
    groupEntries.push(['GROUP', group, date, pair, lesson.discipline, lesson.kind, group, lesson.room, u.fullName])
  }

  const allUsers = [head, ...teachers]
  for (const u of allUsers) {
    const myEntries = []
    for (let w = 0; w < 3; w++) {
      for (let d = 0; d < 6; d++) {
        const date = fmt(addDays(monday, w * 7 + d))
        const isHead = u.role === 'HEAD'
        const r = rng()
        let k
        if (isHead) k = r < 0.75 ? 0 : 1
        else if (r < 0.22) k = 0
        else if (r < 0.6) k = 1
        else if (r < 0.9) k = 2
        else k = 3

        const usedPairs = new Set()
        for (let i = 0; i < k; i++) {
          let pair = 1 + Math.floor(rng() * 5)
          let group = pick(GROUPS)
          let attempts = 0
          while ((usedPairs.has(pair) || groupBusy.has(`${group}|${date}|${pair}`)) && attempts < 25) {
            pair = 1 + Math.floor(rng() * 5)
            group = pick(GROUPS)
            attempts++
          }
          if (usedPairs.has(pair) || groupBusy.has(`${group}|${date}|${pair}`)) continue
          usedPairs.add(pair)
          groupBusy.add(`${group}|${date}|${pair}`)

          const lesson = {
            discipline: pick(DISCIPLINES),
            kind: pick(KINDS),
            groupId: group,
            room: pick(ROOMS),
          }
          myEntries.push({ date, pairNumber: pair, ...lesson })
          addEntries(u, date, pair, lesson, group)
        }
      }
    }
    if (u.role === 'TEACHER' && myEntries.length < 4) {
      // гарантируем минимальную нагрузку каждому преподавателю
      for (let i = 0; i < 4; i++) {
        const date = fmt(addDays(now, 1 + Math.floor(rng() * 14)))
        let pair = 1 + Math.floor(rng() * 5)
        let group = pick(GROUPS)
        let attempts = 0
        while (groupBusy.has(`${group}|${date}|${pair}`) && attempts < 25) {
          pair = 1 + Math.floor(rng() * 5)
          group = pick(GROUPS)
          attempts++
        }
        if (groupBusy.has(`${group}|${date}|${pair}`)) continue
        groupBusy.add(`${group}|${date}|${pair}`)
        const lesson = { discipline: pick(DISCIPLINES), kind: pick(KINDS), groupId: group, room: pick(ROOMS) }
        myEntries.push({ date, pairNumber: pair, ...lesson })
        addEntries(u, date, pair, lesson, group)
      }
    }
  }

  if (teacherEntries.length > 0) {
    await sql`
      insert into "ScheduleEntry" ("ownerType", "ownerId", date, "pairNumber", discipline, kind, "groupId", room, "teacherName")
      values ${sql(teacherEntries)}
    `
  }
  if (groupEntries.length > 0) {
    await sql`
      insert into "ScheduleEntry" ("ownerType", "ownerId", date, "pairNumber", discipline, kind, "groupId", room, "teacherName")
      values ${sql(groupEntries)}
    `
  }

  console.log('Создание поручений...')
  async function createAssignment({ description, dueDate, forAll, recipients, completedNames, createdHoursAgo }) {
    const [a] = await sql`
      insert into "Assignment" (description, "dueDate", "forAll", "createdBy", "createdAt")
      values (${description}, ${dueDate}, ${forAll}, ${head.id}, ${hoursAgo(createdHoursAgo)})
      returning *
    `
    const statusRows = recipients.map((t) => {
      const done = completedNames.includes(t.fullName)
      return [a.id, t.id, done, done ? hoursAgo(24 + Math.floor(rng() * 96)) : null]
    })
    await sql`
      insert into "AssignmentStatus" ("assignmentId", "teacherId", completed, "completedAt")
      values ${sql(statusRows)}
    `
    for (const t of recipients) {
      await sql`
        insert into "MailLog" ("toEmail", "toName", type, subject, body, "createdAt")
        values (
          ${t.email},
          ${t.fullName},
          'ASSIGNMENT_NEW',
          'Новое поручение',
          ${`Здравствуйте, ${t.fullName}!\n\nВам назначено новое поручение:\n«${description}»\n\nСрок выполнения: ${dueDate}.`},
          ${hoursAgo(createdHoursAgo)}
        )
      `
    }
    return a
  }

  const all = teachers
  await createAssignment({
    description: 'Внести сведения о текущей успеваемости групп в систему «Электронный университет» до конца дня',
    dueDate: today,
    forAll: true,
    recipients: all,
    completedNames: [T.grimashevich.fullName, T.goryacheva.fullName, T.uchuvatkin.fullName, T.umanskij.fullName],
    createdHoursAgo: 30,
  })
  await createAssignment({
    description: 'Обновить рабочие программы дисциплин на 2026/2027 учебный год и передать на согласование',
    dueDate: dayShift(2),
    forAll: false,
    recipients: [T.lysikova, T.podsumkova, T.glushkova, T.slavnetskova],
    completedNames: [T.lysikova.fullName],
    createdHoursAgo: 50,
  })
  await createAssignment({
    description: 'Представить список публикаций за 2026 год для годового отчёта НИР кафедры',
    dueDate: dayShift(12),
    forAll: true,
    recipients: all,
    completedNames: [T.grimashevich.fullName, T.makarova.fullName],
    createdHoursAgo: 100,
  })
  await createAssignment({
    description: 'Передать экзаменационные ведомости за первую волну в деканат',
    dueDate: dayShift(-10),
    forAll: true,
    recipients: all,
    completedNames: all.map((t) => t.fullName),
    createdHoursAgo: 300,
  })
  await createAssignment({
    description: 'Оформить заявку на ремонт оборудования в аудитории 4/103',
    dueDate: dayShift(-5),
    forAll: false,
    recipients: [T.uchuvatkin, T.umanskij, T.makarova],
    completedNames: [T.uchuvatkin.fullName, T.makarova.fullName],
    createdHoursAgo: 150,
  })

  console.log('Создание замен...')
  // Слот для демо-замены: занятие инициатора в будущем, где кандидат свободен
  async function findSlot(initiatorId, mustFreeIds) {
    const entries = await sql`
      select * from "ScheduleEntry"
      where "ownerType" = 'TEACHER' and "ownerId" = ${String(initiatorId)} and date >= ${tomorrow}
      order by date asc, "pairNumber" asc
    `
    for (const e of entries) {
      let ok = true
      for (const cid of mustFreeIds) {
        const busy = await sql`
          select 1 from "ScheduleEntry"
          where "ownerType" = 'TEACHER' and "ownerId" = ${String(cid)}
            and date = ${e.date} and "pairNumber" = ${e.pairNumber}
          limit 1
        `
        if (busy.length > 0) {
          ok = false
          break
        }
      }
      if (ok) return e
    }
    return null
  }

  // R1: замена подобрана (Учуваткин -> Гримашевич)
  const slot1 = await findSlot(T.uchuvatkin.id, [T.grimashevich.id])
  if (slot1) {
    const [start, end] = PAIR_TIMES[slot1.pairNumber]
    const [r1] = await sql`
      insert into "Replacement" (discipline, "groupId", kind, room, "lessonDate", "pairNumber", "initiatorId", "substituteId", status, "createdAt")
      values (
        ${slot1.discipline}, ${slot1.groupId}, ${slot1.kind}, ${slot1.room}, ${slot1.date}, ${slot1.pairNumber},
        ${T.uchuvatkin.id}, ${T.grimashevich.id}, 'FOUND', ${hoursAgo(20)}
      )
      returning *
    `
    await sql`
      insert into "ReplacementRequest" ("replacementId", "teacherId", status, "createdAt")
      values ${sql([
        [r1.id, T.grimashevich.id, 'ACCEPTED', hoursAgo(20)],
        [r1.id, T.umanskij.id, 'CANCELLED', hoursAgo(20)],
        [r1.id, T.makarova.id, 'CANCELLED', hoursAgo(20)],
      ])}
    `
    await sql`
      insert into "Work" ("userId", date, type, description, "replacementId", "autoGenerated")
      values (
        ${T.grimashevich.id},
        ${slot1.date},
        'TEACHING',
        ${`Замена: ${slot1.discipline} (${slot1.kind}), группа ${slot1.groupId}, ${slot1.date.split('-').reverse().join('.')}, ${start}–${end}`},
        ${r1.id},
        true
      )
    `
    for (const t of [T.grimashevich, T.umanskij, T.makarova]) {
      await sql`
        insert into "MailLog" ("toEmail", "toName", type, subject, body, "createdAt")
        values (
          ${t.email},
          ${t.fullName},
          'REPLACEMENT_REQUEST',
          ${`Просьба о замене: ${slot1.discipline}`},
          ${`Здравствуйте, ${t.fullName}!\n\n${T.uchuvatkin.fullName} просит заменить занятие:\n${slot1.discipline} (${slot1.kind}), группа ${slot1.groupId}\nДата: ${slot1.date}, ${slot1.pairNumber}-я пара (${start}–${end}), ауд. ${slot1.room}.`},
          ${hoursAgo(20)}
        )
      `
    }
    await sql`
      insert into "MailLog" ("toEmail", "toName", type, subject, body, "createdAt")
      values (
        ${T.uchuvatkin.email},
        ${T.uchuvatkin.fullName},
        'REPLACEMENT_FOUND',
        ${`Замена подобрана: ${slot1.discipline}`},
        ${`Здравствуйте, ${T.uchuvatkin.fullName}!\n\nНа ваше занятие найдена замена:\n${slot1.discipline}, группа ${slot1.groupId}, ${slot1.date}.\n\nЗаменяет: ${T.grimashevich.fullName}.`},
        ${hoursAgo(18)}
      )
    `
  } else {
    console.warn('Не найден слот для R1')
  }

  // R2: идёт поиск (Лысикова, просьбы Уманскому и Макаровой)
  const slot2 = await findSlot(T.lysikova.id, [T.umanskij.id, T.makarova.id])
  if (slot2) {
    const [start, end] = PAIR_TIMES[slot2.pairNumber]
    const [r2] = await sql`
      insert into "Replacement" (discipline, "groupId", kind, room, "lessonDate", "pairNumber", "initiatorId", status, "createdAt")
      values (
        ${slot2.discipline}, ${slot2.groupId}, ${slot2.kind}, ${slot2.room}, ${slot2.date}, ${slot2.pairNumber},
        ${T.lysikova.id}, 'SEARCHING', ${hoursAgo(5)}
      )
      returning *
    `
    await sql`
      insert into "ReplacementRequest" ("replacementId", "teacherId", status, "createdAt")
      values ${sql([
        [r2.id, T.umanskij.id, 'PENDING', hoursAgo(5)],
        [r2.id, T.makarova.id, 'PENDING', hoursAgo(5)],
      ])}
    `
    for (const t of [T.umanskij, T.makarova]) {
      await sql`
        insert into "MailLog" ("toEmail", "toName", type, subject, body, "createdAt")
        values (
          ${t.email},
          ${t.fullName},
          'REPLACEMENT_REQUEST',
          ${`Просьба о замене: ${slot2.discipline}`},
          ${`Здравствуйте, ${t.fullName}!\n\n${T.lysikova.fullName} просит заменить занятие:\n${slot2.discipline} (${slot2.kind}), группа ${slot2.groupId}\nДата: ${slot2.date}, ${slot2.pairNumber}-я пара (${start}–${end}), ауд. ${slot2.room}.`},
          ${hoursAgo(5)}
        )
      `
    }
  } else {
    console.warn('Не найден слот для R2')
  }

  console.log('Создание журнала работ...')
  const worksData = [
    [T.goryacheva, -1, 'TEACHING', 'Проведены два практических занятия по экономической теории (б1-МЕНЖ-11)'],
    [T.goryacheva, -3, 'TEACHING_METHODICAL', 'Обновлён фонд оценочных средств по дисциплине «Экономическая теория»'],
    [T.grimashevich, -2, 'RESEARCH', 'Подана статья «Цифровая трансформация логистики региона» в журнал «Логистика сегодня»', 'https://www.sstu.ru/'],
    [T.uchuvatkin, -1, 'TEACHING', 'Проведена лекция по производственной логистике (б2-МЕНЖ-31)'],
    [T.uchuvatkin, -6, 'ORG_METHODICAL', 'Участие в заседании учебно-методической комиссии факультета'],
    [T.umanskij, -2, 'RESEARCH', 'Проведено заседание научного кружка студентов по транспортной логистике'],
    [T.lysikova, -1, 'TEACHING', 'Проведено практическое занятие по эконометрии (б8-ЭКОН-31)'],
    [T.podsumkova, -4, 'EDUCATIONAL', 'Организована экскурсия студентов группы б1-МЕНЖ-11 на производственное предприятие'],
    [T.glushkova, -3, 'TEACHING_METHODICAL', 'Разработаны методические указания к курсовой работе по менеджменту'],
    [T.slavnetskova, -2, 'EDUCATIONAL', 'Проведён профориентационный вебинар для школьников Саратовской области', 'https://www.sstu.ru/'],
    [T.makarova, -1, 'ORG_METHODICAL', 'Подготовлены материалы к аккредитации образовательной программы'],
    [T.makarova, -5, 'RESEARCH', 'Выступление на конференции «Логистика и управление цепями поставок»'],
    [T.grimashevich, -7, 'TEACHING', 'Проведено лабораторное занятие по информационным технологиям в менеджменте'],
    [T.goryacheva, -8, 'RESEARCH', 'Руководство выпускной квалификационной работой магистранта'],
  ]
  for (const [u, shift, type, description, newsUrl] of worksData) {
    await sql`
      insert into "Work" ("userId", date, type, description, "newsUrl")
      values (${u.id}, ${dayShift(shift)}, ${type}, ${description}, ${newsUrl ?? null})
    `
  }

  const [counts] = await sql`
    select
      (select count(*)::int from "User") as users,
      (select count(*)::int from "ScheduleEntry") as entries,
      (select count(*)::int from "Assignment") as assignments,
      (select count(*)::int from "Replacement") as replacements,
      (select count(*)::int from "Work") as works,
      (select count(*)::int from "MailLog") as mails
  `
  console.log('Готово.')
  console.log(`  Пользователей: ${counts.users} (1 заведующий + ${teachers.length} преподавателей)`)
  console.log(`  Записей расписания: ${counts.entries}`)
  console.log(`  Поручений: ${counts.assignments}`)
  console.log(`  Замен: ${counts.replacements}`)
  console.log(`  Работ в журнале: ${counts.works}`)
  console.log(`  Писем в журнале: ${counts.mails}`)
  console.log('\nДемо-доступ (пароль у всех: demo1234):')
  console.log('  Заведующий: tregubovvn@outlook.com')
  console.log(`  Преподаватели: ${teachers[0].email}, ${teachers[1].email}, ...`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => sql.end())
