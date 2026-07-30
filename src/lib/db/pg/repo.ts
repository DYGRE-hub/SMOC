import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  dateKey,
  displayAuthor,
  isLeader,
  STATUS_LABEL,
  type EngagementSummary,
  type Prayer,
  type PrayerUpdate,
  type PrayerWithEngagement,
  type User,
} from '@/lib/domain/types'
import { buildTodayQueue } from '@/lib/queue'
import { sql } from '@/lib/db/pg/client'
import { pgAccountStore } from '@/lib/db/pg/accounts'
import { toUser } from '@/lib/db/accounts'
import type {
  PrayerDetail,
  PrayerFilter,
  Repository,
  TrackerDay,
  TrackerSummary,
} from '@/lib/db/repository'
import type { ImportDraft, ImportRecord } from '@/lib/db/local-store'

/** 오늘의 미션 크기. 너무 많으면 미션이 아니라 숙제가 된다. */
const MISSION_SIZE = 6

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`
}

interface PrayerRow {
  id: string
  church_id: string
  group_id: string | null
  title: string
  body: string
  subject: string | null
  category: string
  urgency: boolean
  visibility: string
  author_mode: string
  author_id_public: string | null
  author_display_name: string | null
  status: string
  pray_until: string | null
  source: string
  source_ref: string | null
  created_at: Date
  updated_at: Date
  revision_count: number
}

function toPrayer(row: PrayerRow): Prayer {
  return {
    id: row.id,
    churchId: row.church_id,
    groupId: row.group_id,
    title: row.title,
    body: row.body,
    subject: row.subject,
    category: row.category as Prayer['category'],
    urgency: row.urgency,
    visibility: row.visibility as Prayer['visibility'],
    authorMode: row.author_mode as Prayer['authorMode'],
    authorIdPublic: row.author_id_public,
    authorDisplayName: row.author_display_name,
    status: row.status as Prayer['status'],
    prayUntil: row.pray_until,
    source: row.source as Prayer['source'],
    sourceRef: row.source_ref,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    revisionCount: row.revision_count,
  }
}

interface UpdateRow {
  id: string
  prayer_id: string
  type: string
  body: string
  author_display_name: string | null
  created_at: Date
}

function toUpdate(row: UpdateRow): PrayerUpdate {
  return {
    id: row.id,
    prayerId: row.prayer_id,
    type: row.type as PrayerUpdate['type'],
    body: row.body,
    authorDisplayName: row.author_display_name,
    createdAt: row.created_at.toISOString(),
  }
}

/**
 * 공개범위 판정을 SQL 로 내린다.
 *
 * Supabase 를 쓸 때는 RLS 가 이 일을 했지만, 자체 인증으로 오면서 단일 DB 역할로
 * 접속하게 되어 애플리케이션이 책임진다. 그래서 조회 경로마다 이 조각을 반드시
 * 끼워 넣는다 — 목록·상세·나눔·참여 어디서든 같은 규칙이 걸리도록.
 */
function visibleClause(viewer: User) {
  const db = sql()
  if (isLeader(viewer.role)) {
    return db`p.church_id = ${viewer.churchId} and p.deleted_at is null`
  }
  return db`
    p.church_id = ${viewer.churchId}
    and p.deleted_at is null
    and (
      p.visibility = 'public'
      or (p.visibility = 'group' and p.group_id is not null and p.group_id = ${viewer.groupId})
    )
  `
}

interface EngagementAgg {
  prayer_id: string
  total: string
  today_count: string
  viewer_prayed: boolean | null
  recent: string
}

/** 목록마다 제목별로 질의하면 N+1 이 된다. 한 번에 집계해 메모리에서 묶는다. */
async function summarize(
  prayerIds: string[],
  viewer: User,
): Promise<Map<string, EngagementSummary>> {
  const map = new Map<string, EngagementSummary>()
  if (prayerIds.length === 0) return map

  const db = sql()
  const today = dateKey()

  const [engagements, comments] = await Promise.all([
    db<EngagementAgg[]>`
      select
        prayer_id,
        count(*)::text as total,
        count(*) filter (where date_key = ${today}::date)::text as today_count,
        bool_or(user_id = ${viewer.id} and date_key = ${today}::date) as viewer_prayed,
        count(*) filter (where created_at >= now() - interval '7 days')::text as recent
      from prayer_engagements
      where prayer_id = any(${prayerIds}) and kind = 'prayed'
      group by prayer_id
    `,
    db<{ prayer_id: string; count: string }[]>`
      select prayer_id, count(*)::text as count
      from prayer_updates
      where prayer_id = any(${prayerIds}) and type in ('comment', 'answer')
      group by prayer_id
    `,
  ])

  const commentCounts = new Map(comments.map((c) => [c.prayer_id, Number(c.count)]))

  for (const id of prayerIds) {
    const agg = engagements.find((e) => e.prayer_id === id)
    map.set(id, {
      total: Number(agg?.total ?? 0),
      today: Number(agg?.today_count ?? 0),
      commentCount: commentCounts.get(id) ?? 0,
      viewerPrayedToday: agg?.viewer_prayed === true,
      recentCount: Number(agg?.recent ?? 0),
    })
  }

  return map
}

async function hydrate(rows: PrayerRow[], viewer: User): Promise<PrayerWithEngagement[]> {
  const summaries = await summarize(
    rows.map((r) => r.id),
    viewer,
  )
  return rows.map((row) => ({
    prayer: toPrayer(row),
    engagement: summaries.get(row.id) ?? {
      total: 0,
      today: 0,
      commentCount: 0,
      viewerPrayedToday: false,
      recentCount: 0,
    },
  }))
}

export const pgRepository: Repository = {
  async getUserById(id) {
    const account = await pgAccountStore.findById(id)
    return account ? toUser(account) : null
  },

  async listUsers(churchId) {
    const db = sql()
    const rows = await db<
      {
        id: string
        name: string
        display_name: string
        role: string
        church_id: string
        group_id: string | null
        email: string
      }[]
    >`
      select id, name, display_name, role, church_id, group_id, email
      from accounts where church_id = ${churchId} order by created_at
    `
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      role: r.role as User['role'],
      churchId: r.church_id,
      groupId: r.group_id,
      email: r.email,
    }))
  },

  async setRole(userId, role, actor) {
    await pgAccountStore.update(userId, { role })
    await pgRepository.writeAudit({
      actorId: actor.id,
      action: 'set_role',
      targetType: 'user',
      targetId: userId,
      meta: { role },
    })
  },

  async listPrayers(viewer, filter?: PrayerFilter) {
    const db = sql()
    const q = filter?.q?.trim()

    const rows = await db<PrayerRow[]>`
      select p.* from prayers p
      where ${visibleClause(viewer)}
        ${filter?.category ? db`and p.category = ${filter.category}` : db``}
        ${filter?.status ? db`and p.status = ${filter.status}` : db``}
        ${filter?.urgentOnly ? db`and p.urgency = true` : db``}
        ${q ? db`and (p.title ilike ${`%${q}%`} or p.body ilike ${`%${q}%`})` : db``}
      order by p.urgency desc, p.updated_at desc
    `
    return hydrate(rows, viewer)
  },

  async getPrayer(viewer, id): Promise<PrayerDetail | null> {
    const db = sql()
    const rows = await db<PrayerRow[]>`
      select p.* from prayers p where ${visibleClause(viewer)} and p.id = ${id} limit 1
    `
    const row = rows[0]
    if (!row) return null
    const prayer = toPrayer(row)

    const [updateRows, summaries] = await Promise.all([
      db<UpdateRow[]>`
        select id, prayer_id, type, body, author_display_name, created_at
        from prayer_updates where prayer_id = ${id} order by created_at asc
      `,
      summarize([id], viewer),
    ])

    // PRD §8 — 리더 전용 항목 열람은 감사 로그를 남긴다.
    if (prayer.visibility === 'leaders_only') {
      await pgRepository.writeAudit({
        actorId: viewer.id,
        action: 'view_sensitive',
        targetType: 'prayer',
        targetId: prayer.id,
      })
    }

    return {
      prayer,
      engagement: summaries.get(id) ?? {
        total: 0,
        today: 0,
        commentCount: 0,
        viewerPrayedToday: false,
        recentCount: 0,
      },
      updates: updateRows.map(toUpdate),
    }
  },

  async listComments(viewer, prayerId, limit) {
    const db = sql()
    // 부모 기도제목이 보이지 않으면 나눔도 보이지 않는다.
    const rows = await db<UpdateRow[]>`
      select u.id, u.prayer_id, u.type, u.body, u.author_display_name, u.created_at
      from prayer_updates u
      join prayers p on p.id = u.prayer_id
      where ${visibleClause(viewer)}
        and u.prayer_id = ${prayerId}
        and u.type in ('comment', 'answer')
      order by u.created_at desc
      limit ${limit}
    `
    return rows.map(toUpdate).reverse()
  },

  async createPrayer(input) {
    const db = sql()
    const id = newId('p')
    const anonymous = input.authorMode === 'anonymous'

    await db`
      insert into prayers (
        id, church_id, group_id, title, body, subject, category, urgency, visibility,
        author_mode, author_id_public, author_display_name, status, pray_until,
        source, source_ref
      ) values (
        ${id}, ${input.churchId}, ${input.groupId}, ${input.title}, ${input.body},
        ${input.subject},
        ${input.category}, ${input.urgency}, ${input.visibility}, ${input.authorMode},
        ${anonymous ? null : input.authorId},
        ${anonymous ? null : input.authorDisplayName},
        'active', ${input.prayUntil}, ${input.source}, ${null}
      )
    `

    // 익명이어도 작성자는 분리 보관한다. 읽는 코드는 만들지 않는다(PRD §3).
    if (anonymous && input.authorId) {
      await db`
        insert into prayer_author_private (prayer_id, author_id_encrypted)
        values (${id}, ${input.authorId})
        on conflict (prayer_id) do nothing
      `
    }

    await pgRepository.writeAudit({
      actorId: anonymous ? null : input.authorId,
      action: 'create_prayer',
      targetType: 'prayer',
      targetId: id,
      meta: { visibility: input.visibility, authorMode: input.authorMode },
    })
    return id
  },

  async editPrayerBody(id, body, editor) {
    const db = sql()
    const rows = await db<{ body: string; revision_count: number; author_mode: string }[]>`
      select body, revision_count, author_mode from prayers where id = ${id} limit 1
    `
    const existing = rows[0]
    if (!existing) return

    const nextCount = existing.revision_count + 1

    await db`
      insert into prayer_revisions (id, prayer_id, prev_body, editor_id)
      values (${newId('rev')}, ${id}, ${existing.body}, ${editor.id})
    `
    await db`update prayers set body = ${body}, revision_count = ${nextCount} where id = ${id}`
    await db`
      insert into prayer_updates (id, prayer_id, type, body, author_id, author_display_name)
      values (
        ${newId('up')}, ${id}, 'edit',
        ${`본문이 수정되었습니다 (${nextCount}회 수정됨)`},
        ${editor.id},
        ${displayAuthor(existing.author_mode as Prayer['authorMode'], editor.displayName)}
      )
    `

    await pgRepository.writeAudit({
      actorId: editor.id,
      action: 'edit_prayer',
      targetType: 'prayer',
      targetId: id,
    })
  },

  async addUpdate(prayerId, type, body, actor) {
    const db = sql()
    const rows = await db<{ author_mode: string; author_id_public: string | null }[]>`
      select author_mode, author_id_public from prayers where id = ${prayerId} limit 1
    `
    const prayer = rows[0]
    if (!prayer) return

    // 원 작성자가 스스로 다는 나눔은 원문의 익명 규칙을 그대로 따른다.
    const isOriginalAuthor = prayer.author_id_public === actor.id
    const name = isOriginalAuthor
      ? displayAuthor(prayer.author_mode as Prayer['authorMode'], actor.displayName)
      : actor.displayName

    await db`
      insert into prayer_updates (id, prayer_id, type, body, author_id, author_display_name)
      values (${newId('up')}, ${prayerId}, ${type}, ${body}, ${actor.id}, ${name})
    `
    await db`update prayers set updated_at = now() where id = ${prayerId}`

    await pgRepository.writeAudit({
      actorId: actor.id,
      action: `add_update:${type}`,
      targetType: 'prayer',
      targetId: prayerId,
    })
  },

  async setStatus(prayerId, status, actor, note) {
    const db = sql()
    const rows = await db<{ status: string; author_mode: string }[]>`
      select status, author_mode from prayers where id = ${prayerId} limit 1
    `
    const prayer = rows[0]
    if (!prayer) return

    const from = prayer.status as Prayer['status']
    if (from === status && !note) return

    await db`update prayers set status = ${status} where id = ${prayerId}`
    await db`
      insert into prayer_updates (id, prayer_id, type, body, author_id, author_display_name)
      values (
        ${newId('up')}, ${prayerId},
        ${status === 'answered' ? 'answer' : 'status_change'},
        ${
          note?.trim()
            ? `${STATUS_LABEL[from]} → ${STATUS_LABEL[status]}\n${note.trim()}`
            : `${STATUS_LABEL[from]} → ${STATUS_LABEL[status]}`
        },
        ${actor.id},
        ${displayAuthor(prayer.author_mode as Prayer['authorMode'], actor.displayName)}
      )
    `

    await pgRepository.writeAudit({
      actorId: actor.id,
      action: 'status_change',
      targetType: 'prayer',
      targetId: prayerId,
      meta: { from, to: status },
    })
  },

  async softDeletePrayer(prayerId, actor) {
    const db = sql()
    await db`update prayers set deleted_at = now() where id = ${prayerId}`
    await pgRepository.writeAudit({
      actorId: actor.id,
      action: 'soft_delete',
      targetType: 'prayer',
      targetId: prayerId,
    })
  },

  async markPrayed(prayerId, user) {
    const db = sql()
    // 복합 기본키가 하루 1회를 강제한다. 이미 있으면 조용히 넘어간다.
    await db`
      insert into prayer_engagements (prayer_id, user_id, kind, date_key)
      values (${prayerId}, ${user.id}, 'prayed', ${dateKey()}::date)
      on conflict do nothing
    `
    const summaries = await summarize([prayerId], user)
    return summaries.get(prayerId)!
  },

  async unmarkPrayed(prayerId, user) {
    const db = sql()
    await db`
      delete from prayer_engagements
      where prayer_id = ${prayerId} and user_id = ${user.id}
        and kind = 'prayed' and date_key = ${dateKey()}::date
    `
    const summaries = await summarize([prayerId], user)
    return summaries.get(prayerId)!
  },

  async todayQueue(viewer, size) {
    const db = sql()
    const rows = await db<PrayerRow[]>`
      select p.* from prayers p
      where ${visibleClause(viewer)} and p.status in ('active', 'ongoing')
    `
    const items = await hydrate(rows, viewer)
    return buildTodayQueue(items, viewer.id, size)
  },

  async tracker(viewer): Promise<TrackerSummary> {
    const db = sql()
    const today = dateKey()

    const rows = await db<PrayerRow[]>`
      select p.* from prayers p
      where ${visibleClause(viewer)} and p.status in ('active', 'ongoing')
    `
    const candidates = await hydrate(rows, viewer)
    const byId = new Map(candidates.map((item) => [item.prayer.id, item]))

    // 오늘의 미션은 하루 동안 고정한다. 체크가 순위 계산에 영향을 주기 때문에
    // 매번 다시 계산하면 항목이 눈앞에서 자리를 바꾼다.
    const saved = await db<{ prayer_ids: string[] }[]>`
      select prayer_ids from daily_missions
      where user_id = ${viewer.id} and date_key = ${today}::date
    `

    let missionIds = saved[0]?.prayer_ids
    if (!missionIds) {
      missionIds = buildTodayQueue(candidates, viewer.id, MISSION_SIZE, new Date(), {
        ignoreViewerPrayed: true,
      }).map((item) => item.prayer.id)

      await db`
        insert into daily_missions (user_id, date_key, prayer_ids)
        values (${viewer.id}, ${today}::date, ${missionIds})
        on conflict (user_id, date_key) do nothing
      `
    }

    const mission = missionIds
      .map((id) => byId.get(id))
      .filter((item): item is PrayerWithEngagement => Boolean(item))

    // 오늘 새로 올라온 긴급 요청은 뒤에 덧붙인다. 앞의 자리는 건드리지 않는다.
    const included = new Set(mission.map((item) => item.prayer.id))
    const urgentToday = candidates.filter(
      ({ prayer }) =>
        prayer.urgency &&
        !included.has(prayer.id) &&
        dateKey(new Date(prayer.createdAt)) === today,
    )
    if (urgentToday.length > 0) {
      mission.push(...urgentToday)
      await db`
        update daily_missions set prayer_ids = ${mission.map((i) => i.prayer.id)}
        where user_id = ${viewer.id} and date_key = ${today}::date
      `
    }

    const history14 = await db<{ date_key: string; count: string }[]>`
      select date_key::text as date_key, count(*)::text as count
      from prayer_engagements
      where user_id = ${viewer.id} and kind = 'prayed'
        and date_key >= (${today}::date - interval '13 days')
      group by date_key
    `
    const lifetime = await db<{ count: string }[]>`
      select count(*)::text as count from prayer_engagements
      where user_id = ${viewer.id} and kind = 'prayed'
    `
    const streakRows = await db<{ date_key: string }[]>`
      select distinct date_key::text as date_key from prayer_engagements
      where user_id = ${viewer.id} and kind = 'prayed'
      order by date_key desc
      limit 400
    `

    const counts = new Map(history14.map((r) => [r.date_key, Number(r.count)]))
    const totalToday = mission.length
    const doneToday = mission.filter(({ engagement }) => engagement.viewerPrayedToday).length

    const history: TrackerDay[] = []
    for (let i = 13; i >= 0; i--) {
      const key = dateKey(new Date(Date.now() - i * 86_400_000))
      const count = counts.get(key) ?? 0
      history.push({
        dateKey: key,
        count,
        complete: totalToday > 0 ? count >= totalToday : count > 0,
      })
    }

    // 연속 일수 — 오늘 아직 시작하지 않았어도 어제까지의 기록은 살려 둔다.
    const done = new Set(streakRows.map((r) => r.date_key))
    let streak = 0
    for (let i = 0; i < 400; i++) {
      const key = dateKey(new Date(Date.now() - i * 86_400_000))
      if (done.has(key)) streak++
      else if (i === 0) continue
      else break
    }

    return {
      mission,
      doneToday,
      totalToday,
      streak,
      history,
      lifetimeCount: Number(lifetime[0]?.count ?? 0),
    }
  },

  // ── 대화록 정리 ─────────────────────────────────────────

  async createImport(input) {
    const db = sql()
    const importId = newId('imp')

    await db`
      insert into imports (id, church_id, uploader_id, label, message_count, last_message_at)
      values (
        ${importId}, ${input.churchId}, ${input.uploaderId}, ${input.label},
        ${input.messageCount}, ${input.lastMessageAt}
      )
    `

    for (const draft of input.drafts) {
      await db`
        insert into import_drafts (
          id, import_id, raw_excerpt, speaker, spoken_at,
          draft_title, draft_body, draft_category, sensitive_hits
        ) values (
          ${newId('dr')}, ${importId}, ${draft.rawExcerpt}, ${draft.speaker},
          ${draft.spokenAt}, ${draft.draftTitle}, ${draft.draftBody},
          ${draft.draftCategory}, ${draft.sensitiveHits}
        )
      `
    }

    await pgRepository.writeAudit({
      actorId: input.uploaderId,
      action: 'create_import',
      targetType: 'import',
      targetId: importId,
      meta: { messages: input.messageCount, drafts: input.drafts.length },
    })
    return importId
  },

  async listImports(churchId) {
    const db = sql()
    const rows = await db<
      {
        id: string
        church_id: string
        uploader_id: string | null
        label: string
        message_count: number
        last_message_at: Date | null
        created_at: Date
      }[]
    >`
      select * from imports where church_id = ${churchId} order by created_at desc
    `
    return rows.map((r) => ({
      id: r.id,
      churchId: r.church_id,
      uploaderId: r.uploader_id ?? '',
      label: r.label,
      messageCount: r.message_count,
      lastMessageAt: r.last_message_at?.toISOString() ?? null,
      createdAt: r.created_at.toISOString(),
    })) satisfies ImportRecord[]
  },

  async listDrafts(importId) {
    const db = sql()
    const rows = await db<DraftRow[]>`
      select * from import_drafts where import_id = ${importId} order by created_at
    `
    return rows.map(toDraft)
  },

  async listPendingDrafts(churchId) {
    const db = sql()
    const rows = await db<(DraftRow & { label: string })[]>`
      select d.*, i.label from import_drafts d
      join imports i on i.id = d.import_id
      where i.church_id = ${churchId} and d.decision = 'pending'
      order by d.created_at
    `
    return rows.map((row) => ({ draft: toDraft(row), label: row.label }))
  },

  async decideDraft(draftId, decision, edited, actor) {
    const db = sql()
    const rows = await db<{ decision: string }[]>`
      select decision from import_drafts where id = ${draftId} limit 1
    `
    if (!rows[0] || rows[0].decision !== 'pending') return null

    let prayerId: string | null = null
    if (decision === 'approved' && edited) {
      prayerId = await pgRepository.createPrayer({
        churchId: actor.churchId,
        groupId: edited.visibility === 'group' ? actor.groupId : null,
        title: edited.title,
        body: edited.body,
        subject: edited.subject,
        category: edited.category,
        urgency: edited.category === 'urgent',
        visibility: edited.visibility,
        authorMode: edited.authorMode,
        // 대화록에서 온 건은 앱 계정과 연결되지 않는다. 올린 사람은 비워 둔다.
        authorId: null,
        authorDisplayName: null,
        prayUntil: null,
        source: 'import',
      })
    }

    await db`
      update import_drafts set decision = ${decision}, prayer_id = ${prayerId}
      where id = ${draftId}
    `

    await pgRepository.writeAudit({
      actorId: actor.id,
      action: `draft:${decision}`,
      targetType: 'import_draft',
      targetId: draftId,
      meta: prayerId ? { prayerId } : {},
    })
    return prayerId
  },

  async writeAudit(entry) {
    const db = sql()
    await db`
      insert into audit_logs (actor_id, action, target_type, target_id, meta)
      values (
        ${entry.actorId}, ${entry.action}, ${entry.targetType}, ${entry.targetId},
        ${db.json((entry.meta ?? {}) as Record<string, never>)}
      )
    `
  },
}

interface DraftRow {
  id: string
  import_id: string
  raw_excerpt: string
  speaker: string
  spoken_at: Date | null
  draft_title: string
  draft_body: string
  draft_category: string
  sensitive_hits: string[]
  decision: string
  prayer_id: string | null
  created_at: Date
}

function toDraft(row: DraftRow): ImportDraft {
  return {
    id: row.id,
    importId: row.import_id,
    rawExcerpt: row.raw_excerpt,
    speaker: row.speaker,
    spokenAt: row.spoken_at?.toISOString() ?? null,
    draftTitle: row.draft_title,
    draftBody: row.draft_body,
    draftCategory: row.draft_category as Prayer['category'],
    sensitiveHits: row.sensitive_hits,
    decision: row.decision as ImportDraft['decision'],
    prayerId: row.prayer_id,
    createdAt: row.created_at.toISOString(),
  }
}

