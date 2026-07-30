import { NextResponse, type NextRequest } from 'next/server'

import { getRepository } from '@/lib/db'
import { buildExport, weekLabel } from '@/lib/export'
import { isLeader } from '@/lib/domain/types'
import { APP_NAME } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * PRD §4.5 / §11(1단계) — 주간 다이제스트 이메일.
 *
 * Vercel Cron 등에서 주 1회 호출한다. CRON_SECRET 이 설정되어 있으면 반드시 일치해야 한다.
 * RESEND_API_KEY 가 없으면 실제로 보내지 않고 만들어진 내용만 돌려준다.
 * 알림은 과하면 즉시 이탈로 이어지므로, 기본값은 여기까지다 — 실시간 발송은 긴급 건만.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const churchId = request.nextUrl.searchParams.get('church') ?? 'church-demo'
  const repo = await getRepository()
  const members = await repo.listUsers(churchId)

  const label = weekLabel()
  const results: { email: string; subject: string; sent: boolean }[] = []

  for (const member of members) {
    // TODO: users.notify_prefs 의 weekly_summary / quiet_hours 를 읽어 걸러야 한다.
    // 지금은 이메일 주소가 있는 멤버 전원에게 보낸다.
    if (!member.email) continue

    // 각 멤버의 시선으로 목록을 만든다. 그래야 리더 전용 건이 새어 나가지 않는다.
    const items = await repo.listPrayers(member)
    const weekAgo = Date.now() - 7 * 86_400_000
    const recent = items.filter(
      ({ prayer }) =>
        new Date(prayer.updatedAt).getTime() >= weekAgo &&
        prayer.status !== 'closed' &&
        prayer.status !== 'paused',
    )
    if (recent.length === 0) continue

    // 이메일에도 내보내기와 같은 제외 규칙을 적용한다. 리더에게만 예외를 두지 않는다.
    const digest = buildExport(recent, 'bulletin', label)
    const subject = `[${APP_NAME}] ${label} 함께 기도할 ${digest.included}가지`
    const body = [
      `${member.displayName}님,`,
      '',
      digest.text,
      '',
      isLeader(member.role) && digest.excludedAnonymous + digest.excludedLeadersOnly > 0
        ? `(익명 ${digest.excludedAnonymous}건, 리더 전용 ${digest.excludedLeadersOnly}건은 메일에 포함하지 않았습니다. 앱에서 확인해 주세요.)`
        : '',
      '알림이 잦다고 느끼시면 설정에서 언제든 끄실 수 있습니다.',
    ].join('\n')

    const sent = await sendEmail(member.email, subject, body)
    results.push({ email: member.email, subject, sent })
  }

  return NextResponse.json({
    week: label,
    recipients: results.length,
    delivered: results.filter((r) => r.sent).length,
    dryRun: !process.env.RESEND_API_KEY,
    results,
  })
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM ?? `${APP_NAME} <noreply@example.com>`,
      to,
      subject,
      text,
    }),
  })
  return res.ok
}
