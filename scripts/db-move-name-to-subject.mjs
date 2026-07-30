#!/usr/bin/env node
/**
 * 리스트에서 가져온 기도제목의 '이름'을 기도 대상자 칸으로 옮긴다.
 *
 *   node --env-file=.env.local scripts/db-move-name-to-subject.mjs
 *
 * PDF 의 '이름' 칸은 처음부터 올린 사람이 아니라 기도 대상자였다.
 * 필드가 나뉘기 전에 들어온 건들을 제자리로 옮긴다. 여러 번 돌려도 안전하다.
 */

import { connect } from './pg-connect.mjs'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 이 필요합니다.')
  process.exit(1)
}

const sql = connect(url)

try {
  const moved = await sql`
    update prayers
    set subject = author_display_name, author_display_name = null
    where source = 'import'
      and subject is null
      and author_display_name is not null
    returning id, subject
  `
  console.log(`${moved.length}건을 기도 대상자로 옮겼습니다.`)
  for (const r of moved.slice(0, 5)) console.log('  -', r.subject)
  if (moved.length > 5) console.log(`  … 외 ${moved.length - 5}건`)
} catch (error) {
  console.error('실패:', error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
