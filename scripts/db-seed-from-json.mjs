#!/usr/bin/env node
/**
 * 로컬 파일 저장소(.data/golbang.json)의 내용을 Postgres 로 옮긴다.
 *
 *   DATABASE_URL=postgres://... node scripts/db-seed-from-json.mjs
 *
 * 이미 같은 id 가 있으면 건너뛴다(on conflict do nothing). 여러 번 돌려도 안전하다.
 * 비밀번호는 해시 그대로 옮기므로 기존 계정으로 그대로 로그인할 수 있다.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { connect } from './pg-connect.mjs'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 이 필요합니다.')
  process.exit(1)
}

const dataFile = process.env.GOLBANG_DATA_FILE ?? join(process.cwd(), '.data', 'golbang.json')
if (!existsSync(dataFile)) {
  console.error(`옮길 파일이 없습니다: ${dataFile}`)
  process.exit(1)
}

const store = JSON.parse(readFileSync(dataFile, 'utf8'))
const sql = connect(url)

// 파일 저장소는 교회 id 를 여러 값으로 써 왔다. Postgres 로는 하나로 모은다.
const CHURCH_ID = 'smoc'
const counts = { accounts: 0, prayers: 0, updates: 0, engagements: 0, private: 0 }

try {
  for (const a of store.accounts ?? []) {
    const done = await sql`
      insert into accounts (
        id, email, password_hash, password_salt, name, display_name,
        role, church_id, group_id, created_at, last_active_at
      ) values (
        ${a.id}, ${a.email}, ${a.passwordHash}, ${a.passwordSalt},
        ${a.name}, ${a.displayName}, ${a.role}, ${CHURCH_ID}, ${a.groupId ?? null},
        ${a.createdAt}, ${a.lastActiveAt ?? null}
      )
      on conflict (id) do nothing
      returning id
    `
    counts.accounts += done.length
  }

  for (const p of store.prayers ?? []) {
    const done = await sql`
      insert into prayers (
        id, church_id, group_id, title, body, category, urgency, visibility,
        author_mode, author_id_public, author_display_name, status, pray_until,
        source, source_ref, created_at, updated_at, revision_count
      ) values (
        ${p.id}, ${CHURCH_ID}, ${p.groupId ?? null}, ${p.title}, ${p.body ?? ''},
        ${p.category}, ${p.urgency}, ${p.visibility}, ${p.authorMode},
        ${p.authorIdPublic ?? null}, ${p.authorDisplayName ?? null},
        ${p.status}, ${p.prayUntil ?? null}, ${p.source}, ${p.sourceRef ?? null},
        ${p.createdAt}, ${p.updatedAt}, ${p.revisionCount ?? 0}
      )
      on conflict (id) do nothing
      returning id
    `
    counts.prayers += done.length
  }

  for (const u of store.updates ?? []) {
    const done = await sql`
      insert into prayer_updates (id, prayer_id, type, body, author_display_name, created_at)
      values (${u.id}, ${u.prayerId}, ${u.type}, ${u.body},
              ${u.authorDisplayName ?? null}, ${u.createdAt})
      on conflict (id) do nothing
      returning id
    `
    counts.updates += done.length
  }

  for (const e of store.engagements ?? []) {
    // 'committed' 는 더 이상 쓰지 않는다. 기도 기록만 옮긴다.
    if (e.kind !== 'prayed') continue
    const done = await sql`
      insert into prayer_engagements (prayer_id, user_id, kind, date_key, created_at)
      values (${e.prayerId}, ${e.userId}, 'prayed', ${e.dateKey}, ${e.createdAt})
      on conflict do nothing
      returning prayer_id
    `
    counts.engagements += done.length
  }

  for (const [prayerId, authorId] of Object.entries(store.authorPrivate ?? {})) {
    const done = await sql`
      insert into prayer_author_private (prayer_id, author_id_encrypted)
      values (${prayerId}, ${authorId})
      on conflict (prayer_id) do nothing
      returning prayer_id
    `
    counts.private += done.length
  }

  console.log('이전 완료:')
  console.log(`  계정 ${counts.accounts} · 기도제목 ${counts.prayers} · 나눔 ${counts.updates}`)
  console.log(`  기도 기록 ${counts.engagements} · 익명 작성자 ${counts.private}`)
} catch (error) {
  console.error('이전 실패:', error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
