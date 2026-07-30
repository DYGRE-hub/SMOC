import 'server-only'

import { randomUUID } from 'node:crypto'

import { sql } from '@/lib/db/pg/client'
import {
  hashPassword,
  roleForNewAccount,
  type AccountRecord,
  type AccountStore,
  type CreateAccountInput,
} from '@/lib/db/accounts'
import type { Role } from '@/lib/domain/types'

/** 단일 교회로 운영한다. 여러 교회를 받을 때 이 값이 초대 코드에서 넘어오게 된다. */
export const DEFAULT_CHURCH_ID = 'smoc'

interface Row {
  id: string
  email: string
  password_hash: string
  password_salt: string
  name: string
  display_name: string
  role: string
  church_id: string
  group_id: string | null
  created_at: Date
  last_active_at: Date | null
}

function toRecord(row: Row): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    name: row.name,
    displayName: row.display_name,
    role: row.role as Role,
    churchId: row.church_id,
    groupId: row.group_id,
    createdAt: row.created_at.toISOString(),
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
  }
}

export const pgAccountStore: AccountStore = {
  async findByEmail(email) {
    const db = sql()
    const rows = await db<Row[]>`
      select * from accounts where email = ${email.trim().toLowerCase()} limit 1
    `
    return rows[0] ? toRecord(rows[0]) : null
  },

  async findById(id) {
    const db = sql()
    const rows = await db<Row[]>`select * from accounts where id = ${id} limit 1`
    return rows[0] ? toRecord(rows[0]) : null
  },

  async displayNameTaken(displayName, exceptId) {
    const db = sql()
    const normalized = displayName.trim().toLowerCase()
    const rows = await db<{ id: string }[]>`
      select id from accounts
      where church_id = ${DEFAULT_CHURCH_ID}
        and lower(display_name) = ${normalized}
        ${exceptId ? db`and id <> ${exceptId}` : db``}
      limit 1
    `
    return rows.length > 0
  },

  async count() {
    const db = sql()
    const rows = await db<{ count: string }[]>`select count(*)::text as count from accounts`
    return Number(rows[0]?.count ?? 0)
  },

  async create(input: CreateAccountInput) {
    const db = sql()
    const { passwordHash, passwordSalt } = hashPassword(input.password)
    const existing = await pgAccountStore.count()

    const rows = await db<Row[]>`
      insert into accounts (
        id, email, password_hash, password_salt, name, display_name, role, church_id
      ) values (
        ${`u_${randomUUID().slice(0, 8)}`},
        ${input.email.trim().toLowerCase()},
        ${passwordHash},
        ${passwordSalt},
        ${input.name.trim()},
        ${input.displayName.trim()},
        ${roleForNewAccount(existing)},
        ${DEFAULT_CHURCH_ID}
      )
      returning *
    `
    const row = rows[0]
    if (!row) throw new Error('계정 생성에 실패했습니다.')
    return toRecord(row)
  },

  async update(id, patch) {
    const db = sql()
    // 넘어온 필드만 갱신한다. 한 번에 하나씩 쓰는 편이 SQL 조립보다 읽기 쉽다.
    if (patch.displayName !== undefined) {
      await db`update accounts set display_name = ${patch.displayName} where id = ${id}`
    }
    if (patch.name !== undefined) {
      await db`update accounts set name = ${patch.name} where id = ${id}`
    }
    if (patch.role !== undefined) {
      await db`update accounts set role = ${patch.role} where id = ${id}`
    }
    if (patch.groupId !== undefined) {
      await db`update accounts set group_id = ${patch.groupId} where id = ${id}`
    }
  },

  async touch(id) {
    const db = sql()
    await db`update accounts set last_active_at = now() where id = ${id}`
  },
}
