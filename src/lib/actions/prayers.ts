'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getRepository } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import {
  AUTHOR_MODES,
  CATEGORIES,
  isLeader,
  STATUSES,
  VISIBILITIES,
  type Status,
} from '@/lib/domain/types'

const createSchema = z.object({
  title: z.string().trim().min(2, '제목을 조금만 더 적어주세요.').max(120),
  body: z.string().trim().min(2, '내용을 조금만 더 적어주세요.').max(4000),
  subject: z.string().trim().max(60).optional().or(z.literal('')),
  category: z.enum(CATEGORIES).default('church'),
  authorMode: z.enum(AUTHOR_MODES).default('named'),
  visibility: z.enum(VISIBILITIES).default('public'),
  urgency: z.coerce.boolean().default(false),
  prayUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
})

export interface ActionResult {
  ok: boolean
  error?: string
}

export async function createPrayerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse({
    body: formData.get('body'),
    title: formData.get('title'),
    subject: formData.get('subject') ?? undefined,
    category: formData.get('category') ?? undefined,
    authorMode: formData.get('authorMode') ?? undefined,
    visibility: formData.get('visibility') ?? undefined,
    urgency: formData.get('urgency') === 'on',
    prayUntil: formData.get('prayUntil') ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const input = parsed.data
  const viewer = await getCurrentUser()
  if (!viewer) return { ok: false, error: '로그인이 필요합니다.' }
  const repo = await getRepository()

  const id = await repo.createPrayer({
    churchId: viewer.churchId,
    // '우리 셀'로 올린 경우에만 그룹에 묶는다.
    groupId: input.visibility === 'group' ? viewer.groupId : null,
    title: input.title,
    body: input.body,
    subject: input.subject ? input.subject : null,
    category: input.urgency ? 'urgent' : input.category,
    urgency: input.urgency,
    visibility: input.visibility,
    authorMode: input.authorMode,
    authorId: viewer.id,
    authorDisplayName: viewer.displayName,
    prayUntil: input.prayUntil ? input.prayUntil : null,
    source: 'app',
  })

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath('/tracker')

  redirect(`/prayers/${id}`)
}

export async function markPrayedAction(prayerId: string): Promise<ActionResult> {
  return setPrayedAction(prayerId, true)
}

/**
 * 트래커의 체크/해제.
 * 되돌릴 수 있어야 사람들이 부담 없이 누른다 — 잘못 누른 체크를 지울 수 없으면
 * 아예 안 누르게 되고, 그 순간 트래커는 쓸모를 잃는다.
 */
export async function setPrayedAction(
  prayerId: string,
  prayed: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const repo = await getRepository()
  if (prayed) await repo.markPrayed(prayerId, user)
  else await repo.unmarkPrayed(prayerId, user)

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath('/tracker')
  revalidatePath(`/prayers/${prayerId}`)
  return { ok: true }
}

const updateSchema = z.object({
  prayerId: z.string().min(1),
  body: z.string().trim().min(1, '내용을 입력해 주세요.').max(2000),
})

export async function addUpdateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = updateSchema.safeParse({
    prayerId: formData.get('prayerId'),
    body: formData.get('body'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const repo = await getRepository()
  await repo.addUpdate(parsed.data.prayerId, 'comment', parsed.data.body, user)

  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}

const statusSchema = z.object({
  prayerId: z.string().min(1),
  status: z.enum(STATUSES),
  note: z.string().trim().max(2000).optional(),
})

export async function setStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = statusSchema.safeParse({
    prayerId: formData.get('prayerId'),
    status: formData.get('status'),
    note: formData.get('note') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: '상태 값을 확인해 주세요.' }
  }

  const repo = await getRepository()
  const detail = await repo.getPrayer(user, parsed.data.prayerId)
  if (!detail) return { ok: false, error: '기도제목을 찾을 수 없습니다.' }

  // PRD §3 — 상태 변경은 리더 이상 또는 본인 건만.
  const isOwn = detail.prayer.authorIdPublic === user.id
  if (!isLeader(user.role) && !isOwn) {
    return { ok: false, error: '이 기도제목의 상태를 바꿀 권한이 없습니다.' }
  }

  await repo.setStatus(
    parsed.data.prayerId,
    parsed.data.status as Status,
    user,
    parsed.data.note,
  )

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}
