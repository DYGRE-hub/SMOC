import 'server-only'

import {
  canSee,
  dateKey,
  DEFAULT_PRAYER_SORT,
  displayAuthor,
  isLeader,
  isUrgentNow,
  sortPrayers,
  STATUS_LABEL,
  type EngagementSummary,
  type Prayer,
  type PrayerWithEngagement,
  type User,
} from '@/lib/domain/types'
import { buildTodayQueue } from '@/lib/queue'
import {
  DEFAULT_CHURCH_ID,
  newId,
  persist,
  state,
  type ImportDraft,
} from '@/lib/db/local-store'
import { toUser } from '@/lib/db/accounts'
import type {
  CreateRequestInput,
  PrayerDetail,
  PrayerFilter,
  Repository,
  TrackerDay,
  TrackerSummary,
} from '@/lib/db/repository'

/**
 * 요청이 어디서 왔는지 표시. 개발용 저장소에서는 파일에 남기지 않는다 —
 * 쏟아붓기를 막는 데만 쓰는 값이라 서버가 살아 있는 동안만 있으면 된다.
 */
const sourceHashes = new Map<string, string | null>()

/** 오늘의 미션 크기. 너무 많으면 미션이 아니라 숙제가 된다. */
const MISSION_SIZE = 6

function summarize(prayerId: string, viewerId: string): EngagementSummary {
  const s = state()
  const today = dateKey()
  const sevenDaysAgo = Date.now() - 7 * 86_400_000

  const prayed = s.engagements.filter((e) => e.prayerId === prayerId && e.kind === 'prayed')
  // 나눔 수 — 상태 변경이나 수정 기록은 세지 않는다. 사람이 남긴 말만 센다.
  const comments = s.updates.filter(
    (u) => u.prayerId === prayerId && (u.type === 'comment' || u.type === 'answer'),
  )

  return {
    total: prayed.length,
    today: prayed.filter((e) => e.dateKey === today).length,
    commentCount: comments.length,
    viewerPrayedToday: prayed.some((e) => e.userId === viewerId && e.dateKey === today),
    recentCount: prayed.filter((e) => new Date(e.createdAt).getTime() >= sevenDaysAgo).length,
  }
}

function visibleTo(viewer: User): Prayer[] {
  return state()
    .prayers.filter((p) => p.churchId === viewer.churchId)
    .filter((p) => canSee(viewer, p))
}

function applyFilter(items: PrayerWithEngagement[], filter?: PrayerFilter) {
  if (!filter) return items
  let out = items
  const q = filter.q?.trim().toLowerCase()
  if (q) {
    out = out.filter(
      ({ prayer }) =>
        prayer.title.toLowerCase().includes(q) || prayer.body.toLowerCase().includes(q),
    )
  }
  if (filter.category) out = out.filter(({ prayer }) => prayer.category === filter.category)
  if (filter.status) out = out.filter(({ prayer }) => prayer.status === filter.status)
  if (filter.urgentOnly) out = out.filter(({ prayer }) => isUrgentNow(prayer))
  if (filter.hideAnswered) out = out.filter(({ prayer }) => prayer.status !== 'answered')
  return out
}

function shiftDateKey(days: number): string {
  return dateKey(new Date(Date.now() - days * 86_400_000))
}

/**
 * 오늘의 미션을 정하거나, 이미 정해져 있으면 그대로 돌려준다.
 *
 * 한 번 정한 순서는 하루 동안 바꾸지 않는다. 체크가 순위 계산에 영향을 주기
 * 때문에(참여 수가 늘면 '소외 보정' 점수가 내려간다) 매번 다시 계산하면
 * 항목이 눈앞에서 자리를 바꾼다.
 *
 * 다만 오늘 올라온 제목은 뒤에 덧붙인다 — 올린 사람이 오늘의 기도에서
 * 자기 제목을 못 보면 안 올라간 줄 안다.
 * 이미 있는 항목의 자리는 건드리지 않으므로 순서는 그대로다.
 */
function resolveMission(
  viewer: User,
  candidates: PrayerWithEngagement[],
  today: string,
): PrayerWithEngagement[] {
  const s = state()
  const byId = new Map(candidates.map((item) => [item.prayer.id, item]))

  let record = s.missions.find((m) => m.userId === viewer.id)
  if (!record || record.dateKey !== today) {
    const queue = buildTodayQueue(candidates, viewer.id, MISSION_SIZE, new Date(), {
      ignoreViewerPrayed: true,
    })

    const ids: string[] = []
    for (const item of queue) {
      if (!ids.includes(item.prayer.id)) ids.push(item.prayer.id)
    }

    if (record) {
      record.dateKey = today
      record.prayerIds = ids
    } else {
      record = { userId: viewer.id, dateKey: today, prayerIds: ids }
      s.missions.push(record)
    }
    persist()
  }

  const mission = record.prayerIds
    .map((id) => byId.get(id))
    .filter((item): item is PrayerWithEngagement => Boolean(item))

  const included = new Set(mission.map((item) => item.prayer.id))
  const addedToday = candidates.filter(
    ({ prayer }) => !included.has(prayer.id) && dateKey(new Date(prayer.createdAt)) === today,
  )
  if (addedToday.length > 0) {
    mission.push(...addedToday)
    record.prayerIds = mission.map((item) => item.prayer.id)
    persist()
  }

  return mission
}

export const localRepository: Repository = {
  async getUserById(id) {
    const account = state().accounts.find((a) => a.id === id)
    return account ? toUser(account) : null
  },

  async listUsers(churchId) {
    return state()
      .accounts.filter((a) => a.churchId === churchId)
      .map(toUser)
  },

  async setRole(userId, role, actor) {
    const account = state().accounts.find((a) => a.id === userId)
    if (account) {
      account.role = role
      persist()
    }
    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'set_role',
      targetType: 'user',
      targetId: userId,
      meta: { role },
    })
  },

  async listPrayers(viewer, filter) {
    const items = visibleTo(viewer).map((prayer) => ({
      prayer,
      engagement: summarize(prayer.id, viewer.id),
    }))
    return sortPrayers(applyFilter(items, filter), filter?.sort ?? DEFAULT_PRAYER_SORT)
  },

  async getPrayer(viewer, id): Promise<PrayerDetail | null> {
    const prayer = state().prayers.find((p) => p.id === id)
    if (!prayer) return null
    if (prayer.churchId !== viewer.churchId) return null
    if (!canSee(viewer, prayer)) return null

    // PRD §8 — 리더 전용 항목 열람은 감사 로그를 남긴다.
    if (prayer.visibility === 'leaders_only') {
      await localRepository.writeAudit({
        actorId: viewer.id,
        action: 'view_sensitive',
        targetType: 'prayer',
        targetId: prayer.id,
      })
    }

    return {
      prayer,
      engagement: summarize(prayer.id, viewer.id),
      updates: state()
        .updates.filter((u) => u.prayerId === id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        // authorId 는 여기서 떨어져 나간다. 밖으로 내보내면 익명이 깨진다.
        .map(({ authorId, ...update }) => ({
          ...update,
          editable:
            update.type === 'comment' && (isLeader(viewer.role) || authorId === viewer.id),
        })),
    }
  },

  async listComments(viewer, prayerId, limit) {
    const prayer = state().prayers.find((p) => p.id === prayerId)
    // 목록에서 이미 걸렀더라도 여기서 한 번 더 본다. 조회 경로마다 판정을 반복하는 편이
    // 호출부가 하나 빠뜨렸을 때 새어 나가는 것보다 낫다.
    if (!prayer || prayer.churchId !== viewer.churchId || !canSee(viewer, prayer)) return []

    return state()
      .updates.filter(
        (u) => u.prayerId === prayerId && (u.type === 'comment' || u.type === 'answer'),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .reverse()
  },

  /* ── 밖에서 들어온 기도 요청 ─────────────────────────────── */

  async defaultChurchId() {
    return state().accounts[0]?.churchId ?? DEFAULT_CHURCH_ID
  },

  async createRequest(input: CreateRequestInput) {
    const s = state()
    const id = newId('req')
    s.requests.push({
      id,
      churchId: input.churchId,
      title: input.title,
      body: input.body,
      subject: input.subject,
      category: input.category,
      urgency: input.urgency,
      requesterName: input.requesterName,
      requesterContact: input.requesterContact,
      anonymous: input.anonymous,
      status: 'pending',
      publishedPrayerId: null,
      handledBy: null,
      handledAt: null,
      note: null,
      createdAt: new Date().toISOString(),
    })
    // 쏟아붓기 판정에만 쓰는 값이라 화면으로 나가는 타입에는 두지 않는다.
    sourceHashes.set(id, input.sourceHash)
    persist()
    return id
  },

  async countRecentRequests(sourceHash, sinceMinutes) {
    const since = Date.now() - sinceMinutes * 60_000
    return state().requests.filter(
      (r) =>
        sourceHashes.get(r.id) === sourceHash && new Date(r.createdAt).getTime() >= since,
    ).length
  },

  async listRequests(viewer, status) {
    if (!isLeader(viewer.role)) return []
    return state()
      .requests.filter(
        (r) => r.churchId === viewer.churchId && (!status || r.status === status),
      )
      .sort(
        (a, b) =>
          Number(a.status !== 'pending') - Number(b.status !== 'pending') ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  async getRequest(viewer, id) {
    if (!isLeader(viewer.role)) return null
    const found = state().requests.find((r) => r.id === id)
    return found && found.churchId === viewer.churchId ? found : null
  },

  async countPendingRequests(viewer) {
    if (!isLeader(viewer.role)) return 0
    return state().requests.filter(
      (r) => r.churchId === viewer.churchId && r.status === 'pending',
    ).length
  },

  async publishRequest(id, patch, actor) {
    if (!isLeader(actor.role)) return null
    const s = state()
    const request = s.requests.find((r) => r.id === id)
    if (!request || request.churchId !== actor.churchId || request.status !== 'pending') {
      return null
    }

    request.status = 'published'
    request.handledBy = actor.id
    request.handledAt = new Date().toISOString()

    const prayerId = await localRepository.createPrayer({
      churchId: actor.churchId,
      groupId: null,
      title: patch.title,
      body: patch.body,
      subject: patch.subject,
      category: patch.urgency ? 'urgent' : patch.category,
      urgency: patch.urgency,
      visibility: patch.visibility,
      authorMode: request.anonymous || !request.requesterName ? 'anonymous' : 'named',
      authorId: null,
      authorDisplayName: request.anonymous ? null : request.requesterName,
      prayUntil: patch.prayUntil,
      source: 'guest_link',
    })
    request.publishedPrayerId = prayerId

    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'publish_request',
      targetType: 'prayer_request',
      targetId: id,
      meta: { prayerId },
    })
    persist()
    return prayerId
  },

  async declineRequest(id, actor, note) {
    if (!isLeader(actor.role)) return false
    const s = state()
    const request = s.requests.find((r) => r.id === id)
    if (!request || request.churchId !== actor.churchId || request.status !== 'pending') {
      return false
    }
    request.status = 'declined'
    request.handledBy = actor.id
    request.handledAt = new Date().toISOString()
    request.note = note
    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'decline_request',
      targetType: 'prayer_request',
      targetId: id,
    })
    persist()
    return true
  },

  /** 부모 기도제목을 볼 수 없으면 사진도 볼 수 없다. Postgres 쪽과 같은 규칙이다. */
  async getUpdateImage(viewer: User, imageId: string) {
    const s = state()
    const image = s.images.find((img) => img.id === imageId)
    if (!image) return null
    const update = s.updates.find((u) => u.id === image.updateId)
    if (!update) return null
    const prayer = s.prayers.find((p) => p.id === update.prayerId)
    if (!prayer || prayer.churchId !== viewer.churchId || !canSee(viewer, prayer)) return null
    return { mime: image.mime, data: Buffer.from(image.base64, 'base64') }
  },

  async createPrayer(input) {
    const s = state()
    const id = newId('p')
    const now = new Date().toISOString()
    const anonymous = input.authorMode === 'anonymous'

    s.prayers.unshift({
      id,
      churchId: input.churchId,
      groupId: input.groupId,
      title: input.title,
      body: input.body,
      subject: input.subject,
      category: input.category,
      urgency: input.urgency,
      visibility: input.visibility,
      authorMode: input.authorMode,
      authorIdPublic: anonymous ? null : input.authorId,
      authorDisplayName: anonymous ? null : input.authorDisplayName,
      status: 'active',
      prayUntil: input.prayUntil,
      source: input.source,
      createdAt: now,
      updatedAt: now,
      revisionCount: 0,
    })

    // 익명이어도 작성자는 분리 보관한다. 읽기 경로는 만들지 않는다(PRD §3).
    if (anonymous && input.authorId) s.authorPrivate[id] = input.authorId

    await localRepository.writeAudit({
      actorId: anonymous ? null : input.authorId,
      action: 'create_prayer',
      targetType: 'prayer',
      targetId: id,
      meta: { visibility: input.visibility, authorMode: input.authorMode },
    })
    persist()
    return id
  },

  async editPrayer(id, patch, editor) {
    const s = state()
    const prayer = s.prayers.find((p) => p.id === id)
    if (!prayer) return false
    if (!isLeader(editor.role) && prayer.authorIdPublic !== editor.id) return false

    s.revisions.push({
      prayerId: id,
      prevBody: prayer.body,
      editorId: editor.id,
      createdAt: new Date().toISOString(),
    })

    // 작성자 표기(authorMode)는 건드리지 않는다. 익명으로 올린 사람을
    // 나중에 기명으로 돌리는 길을 열면 안 된다.
    prayer.title = patch.title
    prayer.body = patch.body
    prayer.subject = patch.subject
    prayer.category = patch.category
    prayer.urgency = patch.urgency
    prayer.visibility = patch.visibility
    prayer.prayUntil = patch.prayUntil
    prayer.revisionCount += 1
    prayer.updatedAt = new Date().toISOString()

    s.updates.push({
      id: newId('up'),
      prayerId: id,
      type: 'edit',
      body: `내용이 수정되었습니다 (${prayer.revisionCount}회 수정됨)`,
      authorId: editor.id,
      authorDisplayName: displayAuthor(prayer.authorMode, editor.displayName),
      createdAt: new Date().toISOString(),
    })

    await localRepository.writeAudit({
      actorId: editor.id,
      action: 'edit_prayer',
      targetType: 'prayer',
      targetId: id,
    })
    persist()
    return true
  },

  async addUpdate(prayerId, type, body, actor, image) {
    const s = state()
    const prayer = s.prayers.find((p) => p.id === prayerId)
    if (!prayer) return

    // 원 작성자가 익명으로 올린 글에 스스로 다는 업데이트도 같은 익명 규칙을 따른다.
    const isOriginalAuthor =
      prayer.authorIdPublic === actor.id || s.authorPrivate[prayerId] === actor.id
    const name = isOriginalAuthor
      ? displayAuthor(prayer.authorMode, actor.displayName)
      : actor.displayName

    const updateId = newId('up')
    const imageId = image ? newId('img') : null
    s.updates.push({
      id: updateId,
      prayerId,
      type,
      body,
      // 권한 판정용. 화면으로 나갈 때는 떼어낸다.
      authorId: actor.id,
      authorDisplayName: name,
      createdAt: new Date().toISOString(),
      image:
        image && imageId
          ? { id: imageId, width: image.width, height: image.height }
          : null,
    })
    if (image && imageId) {
      s.images.push({
        id: imageId,
        updateId,
        mime: image.mime,
        base64: image.data.toString('base64'),
      })
    }
    prayer.updatedAt = new Date().toISOString()

    await localRepository.writeAudit({
      actorId: actor.id,
      action: `add_update:${type}`,
      targetType: 'prayer',
      targetId: prayerId,
    })
    persist()
  },

  async editComment(updateId, body, actor) {
    const s = state()
    const update = s.updates.find((u) => u.id === updateId)
    // 사람이 쓴 말만 고칠 수 있다. 상태 변경 기록은 손대지 않는다.
    if (!update || update.type !== 'comment') return false
    if (!isLeader(actor.role) && update.authorId !== actor.id) return false

    update.body = body
    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'edit_comment',
      targetType: 'prayer_update',
      targetId: updateId,
      meta: { prayerId: update.prayerId },
    })
    persist()
    return true
  },

  async deleteComment(updateId, actor) {
    const s = state()
    const index = s.updates.findIndex((u) => u.id === updateId)
    const update = s.updates[index]
    if (index < 0 || !update || update.type !== 'comment') return false
    if (!isLeader(actor.role) && update.authorId !== actor.id) return false

    s.updates.splice(index, 1)
    // Postgres 는 on delete cascade 가 대신 해 준다. 파일 저장소는 직접 치운다.
    s.images = s.images.filter((img) => img.updateId !== updateId)
    // 타임라인에서는 사라지지만 지운 사실은 기록에 남는다.
    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'delete_comment',
      targetType: 'prayer_update',
      targetId: updateId,
      meta: { prayerId: update.prayerId },
    })
    persist()
    return true
  },

  async setStatus(prayerId, status, actor, note) {
    const s = state()
    const prayer = s.prayers.find((p) => p.id === prayerId)
    if (!prayer) return
    const from = prayer.status
    if (from === status && !note) return

    prayer.status = status
    prayer.updatedAt = new Date().toISOString()

    s.updates.push({
      id: newId('up'),
      prayerId,
      type: status === 'answered' ? 'answer' : 'status_change',
      body: note?.trim()
        ? `${STATUS_LABEL[from]} → ${STATUS_LABEL[status]}\n${note.trim()}`
        : `${STATUS_LABEL[from]} → ${STATUS_LABEL[status]}`,
      authorDisplayName: displayAuthor(prayer.authorMode, actor.displayName),
      createdAt: new Date().toISOString(),
    })

    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'status_change',
      targetType: 'prayer',
      targetId: prayerId,
      meta: { from, to: status },
    })
    persist()
  },

  async softDeletePrayer(prayerId, actor) {
    const s = state()
    const idx = s.prayers.findIndex((p) => p.id === prayerId)
    const prayer = s.prayers[idx]
    if (idx < 0 || !prayer) return false
    if (!isLeader(actor.role) && prayer.authorIdPublic !== actor.id) return false

    s.prayers.splice(idx, 1)
    await localRepository.writeAudit({
      actorId: actor.id,
      action: 'soft_delete',
      targetType: 'prayer',
      targetId: prayerId,
    })
    persist()
    return true
  },

  async markPrayed(prayerId, user) {
    const s = state()
    const today = dateKey()
    const already = s.engagements.some(
      (e) =>
        e.prayerId === prayerId &&
        e.userId === user.id &&
        e.kind === 'prayed' &&
        e.dateKey === today,
    )
    // 하루 1회 제한 (PRD §4.3).
    if (!already) {
      s.engagements.push({
        prayerId,
        userId: user.id,
        kind: 'prayed',
        dateKey: today,
        createdAt: new Date().toISOString(),
      })
      persist()
    }
    return summarize(prayerId, user.id)
  },

  async unmarkPrayed(prayerId, user) {
    const s = state()
    const today = dateKey()
    const idx = s.engagements.findIndex(
      (e) =>
        e.prayerId === prayerId &&
        e.userId === user.id &&
        e.kind === 'prayed' &&
        e.dateKey === today,
    )
    if (idx >= 0) {
      s.engagements.splice(idx, 1)
      persist()
    }
    return summarize(prayerId, user.id)
  },

  async todayQueue(viewer, size) {
    const items = visibleTo(viewer)
      .filter((p) => p.status === 'active' || p.status === 'ongoing')
      .map((prayer) => ({ prayer, engagement: summarize(prayer.id, viewer.id) }))
    return buildTodayQueue(items, viewer.id, size)
  },

  async tracker(viewer): Promise<TrackerSummary> {
    const s = state()
    const today = dateKey()

    const candidates = visibleTo(viewer)
      .filter((p) => p.status === 'active' || p.status === 'ongoing')
      .map((prayer) => ({ prayer, engagement: summarize(prayer.id, viewer.id) }))

    const mission = resolveMission(viewer, candidates, today)

    const mine = s.engagements.filter((e) => e.userId === viewer.id && e.kind === 'prayed')
    const byDate = new Map<string, number>()
    for (const row of mine) byDate.set(row.dateKey, (byDate.get(row.dateKey) ?? 0) + 1)

    const doneToday = mission.filter(({ engagement }) => engagement.viewerPrayedToday).length
    const totalToday = mission.length

    const history: TrackerDay[] = []
    for (let i = 13; i >= 0; i--) {
      const key = shiftDateKey(i)
      const count = byDate.get(key) ?? 0
      history.push({
        dateKey: key,
        count,
        // 지난 날의 미션 크기는 남아 있지 않으므로, 오늘 기준 미션 크기로 근사한다.
        complete: totalToday > 0 ? count >= totalToday : count > 0,
      })
    }

    // 연속 일수 — 오늘 아직 시작하지 않았어도 어제까지의 기록은 살려 둔다.
    let streak = 0
    for (let i = 0; i < 400; i++) {
      const key = shiftDateKey(i)
      const count = byDate.get(key) ?? 0
      if (count > 0) streak++
      else if (i === 0 && key === today) continue
      else break
    }

    return {
      mission,
      doneToday,
      totalToday,
      streak,
      history,
      lifetimeCount: mine.length,
    }
  },

  // ── 대화록 정리 ─────────────────────────────────────────

  async createImport(input) {
    const s = state()
    const importId = newId('imp')
    const now = new Date().toISOString()

    s.imports.unshift({
      id: importId,
      churchId: input.churchId,
      uploaderId: input.uploaderId,
      label: input.label,
      messageCount: input.messageCount,
      lastMessageAt: input.lastMessageAt,
      createdAt: now,
    })

    for (const draft of input.drafts) {
      s.importDrafts.push({
        ...draft,
        id: newId('dr'),
        importId,
        decision: 'pending',
        prayerId: null,
        createdAt: now,
      })
    }

    await localRepository.writeAudit({
      actorId: input.uploaderId,
      action: 'create_import',
      targetType: 'import',
      targetId: importId,
      meta: { messages: input.messageCount, drafts: input.drafts.length },
    })
    persist()
    return importId
  },

  async listImports(churchId) {
    return state().imports.filter((i) => i.churchId === churchId)
  },

  async listDrafts(importId) {
    return state().importDrafts.filter((d) => d.importId === importId)
  },

  async listPendingDrafts(churchId) {
    const s = state()
    const mine = new Map(s.imports.filter((i) => i.churchId === churchId).map((i) => [i.id, i]))
    return s.importDrafts
      .filter((d) => d.decision === 'pending' && mine.has(d.importId))
      .map((draft) => ({ draft, label: mine.get(draft.importId)?.label ?? '' }))
  },

  async decideDraft(draftId, decision, edited, actor) {
    const s = state()
    const draft = s.importDrafts.find((d) => d.id === draftId)
    if (!draft || draft.decision !== 'pending') return null

    draft.decision = decision

    let prayerId: string | null = null
    if (decision === 'approved' && edited) {
      prayerId = await localRepository.createPrayer({
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
      draft.prayerId = prayerId
    }

    await localRepository.writeAudit({
      actorId: actor.id,
      action: `draft:${decision}`,
      targetType: 'import_draft',
      targetId: draftId,
      meta: prayerId ? { prayerId } : {},
    })
    persist()
    return prayerId
  },

  async writeAudit(entry) {
    state().audit.push({
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      meta: entry.meta ?? {},
      createdAt: new Date().toISOString(),
    })
    // 감사 로그만으로 매번 파일을 쓰지는 않는다. 호출부의 persist() 에 묻어간다.
  },
}

export type { ImportDraft }
