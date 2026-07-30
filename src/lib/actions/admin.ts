'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepository } from '@/lib/db'
import { parseTranscript } from '@/lib/kakao-parser'
import {
  AUTHOR_MODES,
  CATEGORIES,
  ROLES,
  VISIBILITIES,
  isLeader,
  type Role,
} from '@/lib/domain/types'

export interface AdminResult {
  ok: boolean
  error?: string
  /** 붙여넣기 결과 요약 */
  summary?: { messages: number; candidates: number }
}

async function requireLeader() {
  const user = await getCurrentUser()
  if (!user || !isLeader(user.role)) return null
  return user
}

const importSchema = z.object({
  transcript: z.string().trim().min(10, '대화 내용을 붙여넣어 주세요.').max(2_000_000),
  label: z.string().trim().max(80).optional(),
})

/**
 * 대화록 붙여넣기 (PRD §5).
 *
 * 파서가 뽑아낸 것은 전부 "검토 대기"로 들어간다.
 * 여기서 바로 게시되는 것은 하나도 없다 — 신학적 뉘앙스와 개인의 사정을
 * 기계가 판단하게 두어서는 안 되기 때문이다.
 */
export async function importTranscriptAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const user = await requireLeader()
  if (!user) return { ok: false, error: '리더 이상만 사용할 수 있습니다.' }

  const parsed = importSchema.safeParse({
    transcript: formData.get('transcript'),
    label: formData.get('label') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const result = parseTranscript(parsed.data.transcript)
  if (result.messages.length === 0) {
    return {
      ok: false,
      error:
        '대화 형식을 알아보지 못했습니다. 카카오톡의 "대화 내용 내보내기"로 얻은 텍스트를 그대로 붙여넣어 주세요.',
    }
  }

  const repo = await getRepository()
  await repo.createImport({
    churchId: user.churchId,
    uploaderId: user.id,
    label: parsed.data.label?.trim() || defaultLabel(result.lastMessageAt),
    messageCount: result.messages.length,
    lastMessageAt: result.lastMessageAt,
    drafts: result.candidates.map((candidate) => ({
      rawExcerpt: candidate.rawExcerpt,
      speaker: candidate.speaker,
      spokenAt: candidate.spokenAt,
      draftTitle: candidate.draftTitle,
      draftBody: candidate.draftBody,
      draftCategory: candidate.draftCategory,
      sensitiveHits: candidate.sensitiveHits,
    })),
  })

  revalidatePath('/admin')
  return {
    ok: true,
    summary: { messages: result.messages.length, candidates: result.candidates.length },
  }
}

function defaultLabel(lastMessageAt: string | null): string {
  if (!lastMessageAt) return '붙여넣은 대화'
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  }).format(new Date(lastMessageAt))
  return `${formatted}까지의 대화`
}

const decisionSchema = z.object({
  draftId: z.string().min(1),
  decision: z.enum(['approved', 'discarded']),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
  category: z.enum(CATEGORIES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  authorMode: z.enum(AUTHOR_MODES).optional(),
  authorDisplayName: z.string().trim().max(40).optional(),
})

export async function decideDraftAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const user = await requireLeader()
  if (!user) return { ok: false, error: '리더 이상만 사용할 수 있습니다.' }

  const parsed = decisionSchema.safeParse({
    draftId: formData.get('draftId'),
    decision: formData.get('decision'),
    title: formData.get('title') ?? undefined,
    body: formData.get('body') ?? undefined,
    category: formData.get('category') ?? undefined,
    visibility: formData.get('visibility') ?? undefined,
    authorMode: formData.get('authorMode') ?? undefined,
    authorDisplayName: formData.get('authorDisplayName') ?? undefined,
  })
  if (!parsed.success) return { ok: false, error: '입력을 확인해 주세요.' }

  const input = parsed.data
  const repo = await getRepository()

  if (input.decision === 'discarded') {
    await repo.decideDraft(input.draftId, 'discarded', null, user)
    revalidatePath('/admin')
    return { ok: true }
  }

  if (!input.title || !input.body) {
    return { ok: false, error: '제목과 내용을 확인해 주세요.' }
  }

  await repo.decideDraft(
    input.draftId,
    'approved',
    {
      title: input.title,
      body: input.body,
      category: input.category ?? 'church',
      visibility: input.visibility ?? 'public',
      authorMode: input.authorMode ?? 'named',
      authorDisplayName: input.authorDisplayName || null,
    },
    user,
  )

  revalidatePath('/admin')
  revalidatePath('/prayers')
  revalidatePath('/')
  return { ok: true }
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
})

/** 역할 변경은 관리자만. 리더가 스스로를 관리자로 올릴 수는 없다. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return

  const parsed = roleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })
  if (!parsed.success) return
  // 관리자가 자기 자신을 강등해 관리자가 한 명도 없는 상태를 만들지 못하게 한다.
  if (parsed.data.userId === user.id && parsed.data.role !== 'admin') return

  const repo = await getRepository()
  await repo.setRole(parsed.data.userId, parsed.data.role as Role, user)
  revalidatePath('/admin')
}
