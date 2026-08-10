'use server'

import { createHmac } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { CATEGORIES, isLeader, VISIBILITIES } from '@/lib/domain/types'

export interface ActionResult {
  ok: boolean
  error?: string
}

/** 한 곳에서 한 시간에 이만큼까지만 받는다. 교인 한 사람에게는 넉넉하고, 쏟아붓기에는 좁다. */
const MAX_PER_HOUR = 5

const requestSchema = z.object({
  title: z.string().trim().min(2, '제목을 조금만 더 적어주세요.').max(120),
  body: z.string().trim().min(5, '어떤 기도가 필요한지 조금만 더 적어주세요.').max(4000),
  subject: z.string().trim().max(60).optional().or(z.literal('')),
  category: z.enum(CATEGORIES).default('church'),
  urgency: z.coerce.boolean().default(false),
  requesterName: z.string().trim().max(40).optional().or(z.literal('')),
  requesterContact: z.string().trim().max(80).optional().or(z.literal('')),
  anonymous: z.coerce.boolean().default(false),
  consent: z.literal('on', { message: '개인정보 처리에 동의해 주셔야 접수할 수 있습니다.' }),
})

/**
 * 요청이 어디서 왔는지 나타내는 표시.
 *
 * 주소를 그대로 담지 않고 서명해 둔다. 쏟아붓기를 세는 데만 필요한 값이고,
 * 원래 주소까지 쥐고 있을 이유가 없다. 열쇠가 없으면 되돌릴 수도 없다.
 */
async function sourceHash(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  const header = await headers()
  const ip =
    header.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    header.get('x-real-ip') ??
    ''
  if (!ip) return null
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32)
}

/**
 * 로그인 없이 들어오는 유일한 쓰기 경로.
 *
 * 여기서 받은 글은 어디에도 바로 보이지 않는다. 리더가 읽고 손봐서 목록으로
 * 옮겨야 비로소 기도제목이 된다. 그것이 이 문을 열어 두면서도 방을 지키는 방법이다.
 */
export async function submitRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // 사람 눈에는 보이지 않는 칸. 채워져 있으면 사람이 채운 것이 아니다.
  if (String(formData.get('website') ?? '').length > 0) {
    // 자동 프로그램에게는 성공한 것처럼 보이게 둔다. 막혔다는 것을 알면 다른 길을 찾는다.
    return { ok: true }
  }

  const parsed = requestSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    subject: formData.get('subject') ?? undefined,
    category: formData.get('category') ?? undefined,
    urgency: formData.get('urgency') === 'on',
    requesterName: formData.get('requesterName') ?? undefined,
    requesterContact: formData.get('requesterContact') ?? undefined,
    anonymous: formData.get('anonymous') === 'on',
    consent: formData.get('consent'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const input = parsed.data
  const repo = await getRepository()

  const hash = await sourceHash()
  if (hash) {
    const recent = await repo.countRecentRequests(hash, 60)
    if (recent >= MAX_PER_HOUR) {
      return {
        ok: false,
        error: '조금 전에 여러 건을 보내셨습니다. 잠시 후에 다시 시도해 주세요.',
      }
    }
  }

  await repo.createRequest({
    churchId: await repo.defaultChurchId(),
    title: input.title,
    body: input.body,
    subject: input.subject ? input.subject : null,
    category: input.urgency ? 'urgent' : input.category,
    urgency: input.urgency,
    // 익명을 고르면 이름은 아예 담지 않는다. 담아 두고 안 보여주는 것과는 다르다.
    requesterName: input.anonymous ? null : input.requesterName || null,
    requesterContact: input.requesterContact ? input.requesterContact : null,
    anonymous: input.anonymous,
    sourceHash: hash,
  })

  revalidatePath('/requests')
  redirect('/request/done')
}

const publishSchema = z.object({
  requestId: z.string().min(1),
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

/** 요청을 손봐서 목록으로 옮긴다. 리더 이상만. */
export async function publishRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }
  if (!isLeader(user.role)) return { ok: false, error: '리더 이상만 처리할 수 있습니다.' }

  const parsed = publishSchema.safeParse({
    requestId: formData.get('requestId'),
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
  const prayerId = await repo.publishRequest(
    input.requestId,
    {
      title: input.title,
      body: input.body,
      subject: input.subject ? input.subject : null,
      category: input.category,
      urgency: input.urgency,
      visibility: input.visibility,
      prayUntil: input.prayUntil ? input.prayUntil : null,
    },
    user,
  )
  if (!prayerId) {
    return { ok: false, error: '이미 처리된 요청이거나 권한이 없습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/prayers')
  revalidatePath('/tracker')
  revalidatePath('/requests')
  redirect(`/prayers/${prayerId}`)
}

export async function declineRequestAction(
  requestId: string,
  note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const repo = await getRepository()
  const done = await repo.declineRequest(requestId, user, note.trim() || null)
  if (!done) return { ok: false, error: '이미 처리된 요청이거나 권한이 없습니다.' }

  revalidatePath('/requests')
  return { ok: true }
}
