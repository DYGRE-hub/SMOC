import 'server-only'

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import type { Role, User } from '@/lib/domain/types'

/**
 * 계정 저장소 경계.
 *
 * 인증 코드가 파일 저장소 함수를 직접 부르고 있으면 Postgres 로 옮길 때
 * 로그인·가입·설정이 전부 함께 흔들린다. 그래서 여기서 한 겹 끊는다.
 */

export interface AccountRecord {
  id: string
  email: string
  passwordHash: string
  passwordSalt: string
  name: string
  displayName: string
  role: Role
  churchId: string
  groupId: string | null
  createdAt: string
  lastActiveAt: string | null
}

export interface CreateAccountInput {
  email: string
  password: string
  name: string
  displayName: string
}

export interface AccountStore {
  findByEmail(email: string): Promise<AccountRecord | null>
  findById(id: string): Promise<AccountRecord | null>
  /** 대소문자를 무시하고 비교한다. 비슷한 이름으로 남인 척하는 것을 막는다. */
  displayNameTaken(displayName: string, exceptId?: string): Promise<boolean>
  /** 첫 가입자를 관리자로 만들기 위해 필요하다. */
  count(): Promise<number>
  create(input: CreateAccountInput): Promise<AccountRecord>
  update(
    id: string,
    patch: Partial<Pick<AccountRecord, 'displayName' | 'name' | 'role' | 'groupId'>>,
  ): Promise<void>
  touch(id: string): Promise<void>
}

// ─────────────────────────────────────────────────────────────
// 비밀번호
// ─────────────────────────────────────────────────────────────

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    passwordHash: scryptSync(password, salt, 64).toString('hex'),
    passwordSalt: salt,
  }
}

export function verifyPassword(password: string, account: AccountRecord): boolean {
  const attempt = scryptSync(password, account.passwordSalt, 64)
  const stored = Buffer.from(account.passwordHash, 'hex')
  // 길이가 같을 때만 상수 시간 비교가 성립한다.
  if (attempt.length !== stored.length) return false
  return timingSafeEqual(attempt, stored)
}

export function toUser(account: AccountRecord): User {
  return {
    id: account.id,
    name: account.name,
    displayName: account.displayName,
    role: account.role,
    churchId: account.churchId,
    groupId: account.groupId,
    email: account.email,
  }
}

/** 첫 가입자가 관리자가 된다. 그 뒤로는 중보자로 시작한다. */
export function roleForNewAccount(existingCount: number): Role {
  return existingCount === 0 ? 'admin' : 'intercessor'
}
