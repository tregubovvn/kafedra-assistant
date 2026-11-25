import postgres from 'postgres'

// postgres.js — тонкий клиент без ORM: запросы пишем явным SQL.
// DATABASE_URL — строка подключения Supabase (Session pooler, порт 5432).
export type SqlClient = ReturnType<typeof postgres>

const globalForDb = globalThis as unknown as { kafedraSql?: SqlClient }

function createClient(): SqlClient {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL не задан — укажите строку подключения к PostgreSQL (Supabase) в .env')
  }
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase работает через PgBouncer: prepared statements в transaction-режиме несовместимы
    prepare: false,
    onnotice: () => {},
  })
}

export const sql: SqlClient = globalForDb.kafedraSql ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForDb.kafedraSql = sql
