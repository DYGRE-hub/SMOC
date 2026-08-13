'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getRepository } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import {
  AUTHOR_MODES,
  CATEGORIES,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  isLeader,
  STATUSES,
  VISIBILITIES,
  type Status,
} from '@/lib/domain/types'
import type { NewImage } from '@/lib/db/repository'

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

/**
 * 폼으로 올라온 사진 한 장을 저장할 수 있는 모양으로 바꾼다.
 *
 * 브라우저가 이미 줄여서 보내지만 그 말을 믿지 않는다. 브라우저를 거치지 않고
 * 직접 부르는 길이 늘 열려 있으므로, 형식과 크기는 여기서 다시 본다.
 */
async function readImage(
  formData: FormData,
): Promise<{ image: NewImage | null; error?: string }> {
  const value = formData.get('image')
  if (!value || typeof value === 'string') return { image: null }
  const file = value
  if (file.size === 0) return { image: null }

  if (!IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) {
    return { image: null, error: '사진은 JPG, PNG, WEBP 만 올릴 수 있습니다.' }
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { image: null, error: '사진이 너무 큽니다. 조금 더 작은 사진으로 올려 주세요.' }
  }

  // 가로·세로는 자리를 미리 잡는 데만 쓴다. 값이 틀려도 비율만 어긋나므로
  // 믿을 수 없는 값이 와도 위험하지 않다. 다만 터무니없는 수는 잘라 둔다.
  const edge = (raw: FormDataEntryValue | null) => {
    const n = Math.round(Number(raw))
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1
  }

  return {
    image: {
      mime: file.type,
      width: edge(formData.get('imageWidth')),
      height: edge(formData.get('imageHeight')),
      data: Buffer.from(await file.arrayBuffer()),
    },
  }
}

export async function addUpdateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const { image, error: imageError } = await readImage(formData)
  if (imageError) return { ok: false, error: imageError }

  const parsed = updateSchema.safeParse({
    prayerId: formData.get('prayerId'),
    // 사진만 올리는 경우도 있다. 그때는 본문을 비워 둘 수 있게 한다.
    body: image ? (formData.get('body') || '사진을 나눕니다.') : formData.get('body'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const repo = await getRepository()
  await repo.addUpdate(parsed.data.prayerId, 'comment', parsed.data.body, user, image)

  revalidatePath('/')
  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}

const editPrayerSchema = z.object({
  prayerId: z.string().min(1),
  title: z.string().trim().min(2, '제목을 조금만 더 적어주세요.').max(120),
  body: z.string().trim().min(2, '내용을 조금만 더 적어주세요.').max(4000),
  subject: z.string().trim().max(60).optional().or(z.literal('')),
  category: z.enum(CATEGORIES),
  visibility: z.enum(VISIBILITIES),
  urgency: z.coerce.boolean().default(false),
  prayUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
})

/**
 * 기도제목 수정.
 *
 * 작성자 표기(이름 밝히기 / 익명)는 여기서 바꿀 수 없다. 처음 올릴 때 한 번 정하고,
 * 나중에 뒤집으면 익명으로 올린 사람이 드러나거나 반대로 이미 이름을 보고 기도한
 * 사람들의 기억과 어긋난다.
 */
export async function editPrayerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = editPrayerSchema.safeParse({
    prayerId: formData.get('prayerId'),
    title: formData.get('title'),
    body: formData.get('body'),
    subject: formData.get('subject') ?? undefined,
    category: formData.get('category'),
    visibility: formData.get('visibility'),
    urgency: formData.get('urgency') === 'on',
    prayUntil: formData.get('prayUntil') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const input = parsed.data
  const repo = await getRepository()
  const done = await repo.editPrayer(
    input.prayerId,
    {
      title: input.title,
      body: input.body,
      subject: input.subject ? input.subject : null,
      category: input.urgency ? 'urgent' : input.category,
      urgency: input.urgency,
      visibility: input.visibility,
      prayUntil: input.prayUntil ? input.prayUntil : null,
    },
    user,
  )
  if (!done) return { ok: false, error: '이 기도제목을 고칠 권한이 없습니다.' }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath('/tracker')
  revalidatePath(`/prayers/${input.prayerId}`)
  redirect(`/prayers/${input.prayerId}`)
}

export async function deletePrayerAction(prayerId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const repo = await getRepository()
  const done = await repo.softDeletePrayer(prayerId, user)
  if (!done) return { ok: false, error: '이 기도제목을 지울 권한이 없습니다.' }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath('/tracker')
  return { ok: true }
}

const editCommentSchema = z.object({
  updateId: z.string().min(1),
  body: z.string().trim().min(1, '내용을 입력해 주세요.').max(2000),
  prayerId: z.string().min(1),
})

/**
 * 나눔 수정.
 *
 * 화면의 수정 버튼은 서버가 미리 계산해 준 editable 로 그려지지만,
 * 여기서 권한을 다시 본다. 버튼이 안 보인다고 액션을 못 부르는 것은 아니다.
 * 실제 판정은 저장소가 UPDATE 조건에 함께 걸어 처리한다.
 */
export async function editCommentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = editCommentSchema.safeParse({
    updateId: formData.get('updateId'),
    body: formData.get('body'),
    prayerId: formData.get('prayerId'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const repo = await getRepository()
  const done = await repo.editComment(parsed.data.updateId, parsed.data.body, user)
  if (!done) return { ok: false, error: '이 나눔을 고칠 권한이 없습니다.' }

  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}

export async function deleteCommentAction(
  updateId: string,
  prayerId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const repo = await getRepository()
  const done = await repo.deleteComment(updateId, user)
  if (!done) return { ok: false, error: '이 나눔을 지울 권한이 없습니다.' }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath(`/prayers/${prayerId}`)
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

const headUpdateSchema = z.object({
  prayerId: z.string().min(1),
  body: z.string().trim().min(2, '업데이트 내용을 조금만 더 적어주세요.').max(4000),
})

/**
 * 원문 위에 소식을 얹는다.
 *
 * 나눔과 나누어 둔 이유가 있다. 나눔은 곁에서 보태는 말이고, 이것은 부탁한 사람이
 * 사정이 달라졌을 때 요청 자체를 고쳐 쓰는 자리다. 그래서 권한도 더 좁다 —
 * 올린 본인과 리더 이상만. 원문은 덮어쓰지 않고 그 위에 쌓는다.
 */
export async function addHeadUpdateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = headUpdateSchema.safeParse({
    prayerId: formData.get('prayerId'),
    body: formData.get('body'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const repo = await getRepository()
  const done = await repo.addHeadUpdate(parsed.data.prayerId, parsed.data.body, user)
  if (!done) return { ok: false, error: '이 기도제목에 업데이트를 올릴 권한이 없습니다.' }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}

const editHeadUpdateSchema = z.object({
  updateId: z.string().min(1),
  prayerId: z.string().min(1),
  body: z.string().trim().min(2, '업데이트 내용을 조금만 더 적어주세요.').max(4000),
})

export async function editHeadUpdateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = editHeadUpdateSchema.safeParse({
    updateId: formData.get('updateId'),
    prayerId: formData.get('prayerId'),
    body: formData.get('body'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const repo = await getRepository()
  const done = await repo.editHeadUpdate(parsed.data.updateId, parsed.data.body, user)
  if (!done) return { ok: false, error: '이 업데이트를 고칠 권한이 없습니다.' }

  revalidatePath(`/prayers/${parsed.data.prayerId}`)
  return { ok: true }
}

export async function deleteHeadUpdateAction(
  updateId: string,
  prayerId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const repo = await getRepository()
  const done = await repo.deleteHeadUpdate(updateId, user)
  if (!done) return { ok: false, error: '이 업데이트를 지울 권한이 없습니다.' }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath(`/prayers/${prayerId}`)
  return { ok: true }
}
