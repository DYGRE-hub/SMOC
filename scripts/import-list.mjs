#!/usr/bin/env node
/**
 * 주간 기도제목 리스트를 저장소에 넣는다.
 *
 *   node scripts/import-list.mjs scripts/data/2026-07-15.json [--replace]
 *   DATABASE_URL=postgres://... node scripts/import-list.mjs <파일> [--replace]
 *
 * DATABASE_URL 이 있으면 Postgres 에, 없으면 로컬 파일 저장소에 쓴다.
 *
 * PDF 로 오는 리스트를 사람이 한 번 JSON 으로 옮겨두면, 그 뒤로는 이 스크립트가
 * 반영한다. PDF 를 직접 파싱하지 않는 이유는 표 레이아웃이 매주 조금씩 달라지기
 * 때문이다 — 잘못 읽은 채 게시되는 것보다 한 번 옮기는 편이 안전하다.
 *
 * --replace        같은 출처(source)로 들어온 기존 항목을 지우고 새로 넣는다.
 *                  같은 주 리스트를 고쳐서 다시 넣을 때 쓴다.
 * --close-previous  지난 주까지의 리스트를 '종료'로 내린다. 목록과 오늘의 기도에서
 *                  빠지지만 기록과 나눔은 그대로 남는다. 매주 새 리스트를 올릴 때 쓴다.
 *
 * 파일 저장소에 쓸 때는 실행 전에 백업을 뜬다.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

const [, , listPath, ...flags] = process.argv
if (!listPath) {
  console.error('사용법: node scripts/import-list.mjs <리스트.json> [--replace]')
  process.exit(1)
}

const list = JSON.parse(readFileSync(listPath, 'utf8'))
const replace = flags.includes('--replace')
const closePrevious = flags.includes('--close-previous')

/** 카테고리 추정 — 매치 개수로 점수를 매기고 동점이면 위쪽 규칙이 이긴다. */
const CATEGORY_RULES = [
  ['healing', /수술|병원|입원|중환자|아프|치유|암|검사|건강|통증|진단|항암|백혈병|재활|담낭|간암/g],
  ['finance', /재정|빚|대출|생활비|실직|월세|폐업|부도|보험|자금/g],
  ['work', /직장|이직|면접|취업|사업|승진|회사|구직|임용|인력|커리어|career|졸업 후/g],
  ['children', /아이|자녀|아들|딸|수능|시험|학교|입시|유치원|학원|대학|기숙사|논문|학기/g],
  ['family', /남편|아내|부모|가정|시댁|친정|가족|이혼|별거|결혼식|어머니|아버지/g],
  ['mission', /선교|파송|현지|단기선교/g],
  ['salvation', /구원|전도|믿음|예수|복음|영접|세례|출석/g],
  ['thanks', /감사|응답|기쁨|축하/g],
  ['church', /교회|사역|예배|목장|셀|새가족|찬양|수련회|부흥/g],
]

function guessCategory(text) {
  let best = 'church'
  let bestScore = 0
  for (const [category, pattern] of CATEGORY_RULES) {
    const score = [...text.matchAll(pattern)].length
    if (score > bestScore) {
      bestScore = score
      best = category
    }
  }
  return best
}

/** "1month" 같은 기간 표기를 마감일로 옮긴다. 해석할 수 없으면 본문에 남긴다. */
function resolvePrayUntil(period, baseDate) {
  if (!period) return { prayUntil: null, note: null }
  const months = /^(\d+)\s*month/i.exec(period.trim())
  if (months) {
    // 달력 날짜만 다루므로 UTC 로 계산한다. 로컬 타임존을 거치면 하루가 밀린다.
    const [y, m, d] = baseDate.split('-').map(Number)
    const target = new Date(Date.UTC(y, m - 1 + Number(months[1]), d))
    return { prayUntil: target.toISOString().slice(0, 10), note: null }
  }
  return { prayUntil: null, note: `기간: ${period}` }
}

/** 섹션·항목을 저장소가 받을 수 있는 형태로 편다. */
function flatten(churchId) {
  const rows = []
  for (const section of list.sections) {
    for (const item of section.items) {
      const { prayUntil, note } = resolvePrayUntil(item.period, list.date)

      // 항목이 하나뿐이면 불릿이 군더더기다. 여러 줄일 때만 붙인다.
      const bodyLines =
        item.lines.length > 1 ? item.lines.map((line) => `· ${line}`) : [...item.lines]
      if (item.group) bodyLines.unshift(`소속: ${item.group}`)
      if (note) bodyLines.push(note)

      const body = bodyLines.join('\n')
      const urgent = Boolean(section.urgent)

      rows.push({
        id: `p_${randomUUID().slice(0, 8)}`,
        churchId,
        title: item.title,
        body,
        category: urgent ? 'urgent' : guessCategory(`${item.title}\n${body}`),
        urgency: urgent,
        // 리스트로 들어온 건이라 앱 계정과 연결하지 않는다. 표시 이름만 남긴다.
        authorDisplayName: item.author,
        prayUntil,
        sourceRef: list.source,
      })
    }
  }
  return rows
}

async function importToPostgres(url) {
  const { connect } = await import('./pg-connect.mjs')
  const sql = connect(url)

  try {
    const [account] = await sql`select church_id from accounts order by created_at limit 1`
    if (!account) {
      console.error('계정이 없습니다. 앱에서 회원가입을 먼저 해주세요.')
      process.exitCode = 1
      return
    }

    if (replace) {
      const gone = await sql`
        delete from prayers where source_ref = ${list.source} returning id
      `
      console.log(`같은 출처 기존 항목 ${gone.length}건 제거`)
    }

    if (closePrevious) {
      const closed = await sql`
        update prayers set status = 'closed'
        where source = 'import' and source_ref is not null
          and source_ref <> ${list.source} and status not in ('answered', 'closed')
        returning id
      `
      console.log(`지난 리스트 ${closed.length}건을 종료로 내림`)
    }

    const rows = flatten(account.church_id)
    for (const r of rows) {
      await sql`
        insert into prayers (
          id, church_id, title, body, category, urgency, visibility,
          author_mode, author_display_name, status, pray_until, source, source_ref
        ) values (
          ${r.id}, ${r.churchId}, ${r.title}, ${r.body}, ${r.category}, ${r.urgency},
          'public', 'named', ${r.authorDisplayName}, 'active', ${r.prayUntil},
          'import', ${r.sourceRef}
        )
      `
    }

    await sql`
      insert into audit_logs (action, target_type, target_id, meta)
      values ('import_list', 'import', ${list.source}, ${sql.json({ added: rows.length, replace })})
    `

    console.log(`${rows.length}건 등록 (Postgres) — 출처: ${list.source}`)
  } finally {
    await sql.end()
  }
}

function importToFile() {
  const dataFile =
    process.env.GOLBANG_DATA_FILE ?? join(process.cwd(), '.data', 'golbang.json')
  if (!existsSync(dataFile)) {
    console.error(`저장소가 없습니다: ${dataFile}\n먼저 앱에서 회원가입을 한 번 해주세요.`)
    process.exit(1)
  }

  const store = JSON.parse(readFileSync(dataFile, 'utf8'))
  if (store.accounts.length === 0) {
    console.error('계정이 없습니다. 앱에서 회원가입을 먼저 해주세요.')
    process.exit(1)
  }

  // 되돌릴 수 있게 백업부터. 남의 데이터를 덮어쓰는 스크립트는 항상 이래야 한다.
  const backup = `${dataFile}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`
  copyFileSync(dataFile, backup)

  if (replace) {
    const before = store.prayers.length
    store.prayers = store.prayers.filter((p) => p.sourceRef !== list.source)
    console.log(`같은 출처 기존 항목 ${before - store.prayers.length}건 제거`)
  }

  if (closePrevious) {
    let closed = 0
    for (const p of store.prayers) {
      if (p.source !== 'import' || !p.sourceRef) continue
      if (p.sourceRef === list.source) continue
      if (p.status === 'answered' || p.status === 'closed') continue
      p.status = 'closed'
      closed++
    }
    console.log(`지난 리스트 ${closed}건을 종료로 내림`)
  }

  const now = new Date().toISOString()
  const rows = flatten(store.accounts[0].churchId)

  for (const r of rows) {
    store.prayers.push({
      id: r.id,
      churchId: r.churchId,
      groupId: null,
      title: r.title,
      body: r.body,
      category: r.category,
      urgency: r.urgency,
      visibility: 'public',
      authorMode: 'named',
      authorIdPublic: null,
      authorDisplayName: r.authorDisplayName,
      status: 'active',
      prayUntil: r.prayUntil,
      source: 'import',
      sourceRef: r.sourceRef,
      createdAt: now,
      updatedAt: now,
      revisionCount: 0,
    })
  }

  store.audit.push({
    actorId: null,
    action: 'import_list',
    targetType: 'import',
    targetId: list.source,
    meta: { added: rows.length, replace },
    createdAt: now,
  })

  writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8')
  console.log(`${rows.length}건 등록 (파일) — 출처: ${list.source}`)
  console.log(`백업: ${backup}`)
}

if (process.env.DATABASE_URL) await importToPostgres(process.env.DATABASE_URL)
else importToFile()
