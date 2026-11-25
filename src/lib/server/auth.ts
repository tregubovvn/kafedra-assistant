// Серверная авторизация: пароли (scrypt) и сессии по токену

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { sql } from '@/lib/db'
import type { AppUser } from '@/lib/types'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = scryptSync(password, salt, 64)
  const orig = Buffer.from(hash, 'hex')
  return orig.length === test.length && timingSafeEqual(orig, test)
}

export function generatePassword(): string {
  // Простой читаемый пароль для демо: Kf-XXXXXX
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  const bytes = randomBytes(8)
  for (let i = 0; i < 6; i++) pwd += chars[bytes[i] % chars.length]
  return `Kf-${pwd}`
}

export async function getSessionUser(req: Request): Promise<AppUser | null> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return null

  const rows = await sql<{ id: number; email: string; fullName: string; role: string }[]>`
    select u.id, u.email, u."fullName", u.role
    from "Session" s
    join "User" u on u.id = s."userId"
    where s.token = ${token}
    limit 1
  `
  const u = rows[0]
  if (!u) return null
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role as 'HEAD' | 'TEACHER' }
}

export function publicUser(u: { id: number; email: string; fullName: string; role: string }): AppUser {
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role as 'HEAD' | 'TEACHER' }
}
