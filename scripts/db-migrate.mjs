#!/usr/bin/env node
/**
 * Postgres 스키마를 적용한다. 여러 번 실행해도 안전하다.
 *
 *   DATABASE_URL=postgres://... node scripts/db-migrate.mjs
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect } from './pg-connect.mjs'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 이 필요합니다.')
  process.exit(1)
}

const schema = readFileSync(join(process.cwd(), 'src/lib/db/pg/schema.sql'), 'utf8')
const sql = connect(url)

try {
  await sql.unsafe(schema)
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `
  console.log('스키마 적용 완료. 테이블:')
  for (const t of tables) console.log('  -', t.table_name)
} catch (error) {
  console.error('스키마 적용 실패:', error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
