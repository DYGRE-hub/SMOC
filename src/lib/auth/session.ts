import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

import { getAccountStore } from '@/lib/db'
import { toUser } from '@/lib/db/accounts'
import type { User } from '@/lib/domain/types'

export const SESSION_COOKIE = 'smoc_session'

const MAX_AGE = 60 * 60 * 24 * 30 // 30일

/**
 * 세션 서명 키.
 *
 * 운영에서는 SESSION_SECRET 환경변수가 반드시 있어야 한다. 없으면 서버가 재시작될
 * 때마다 모든 사람이 로그아웃되거나, 더 나쁘게는 인스턴스마다 다른 키를 써서
 * 로그인이 임의로 풀린다. 그래서 프로덕션에서는 없으면 즉시 실패시킨다.
 */
function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET
  if (fromEnv) return fromEnv

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET 이 설정되지 않았습니다. 배포 전에 긴 무작위 문자열을 넣어 주세요.',
    )
  }
  // 개발 편의용 고정 키. 운영에서는 위에서 이미 막힌다.
  return 'dev-only-insecure-session-secret'
}

/**
 * 세션 쿠키는 `userId.HMAC(userId)` 형태다.
 * 서버 비밀키로 서명하므로 값을 바꿔 남의 계정이 될 수 없고, httpOnly 라 스크립트로도 못 읽는다.
 */
function sign(userId: string): string {
  return createHmac('sha256', sessionSecret()).update(userId).digest('hex')
}

function verify(raw: string): string | null {
  const separator = raw.lastIndexOf('.')
  if (separator <= 0) return null

  const userId = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)
  const expected = sign(userId)

  if (signature.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return userId
}

export async function startSession(userId: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, `${userId}.${sign(userId)}`, {
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** 현재 로그인한 사용자. 로그인하지 않았으면 null. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const userId = verify(raw)
  if (!userId) return null

  const accounts = await getAccountStore()
  const account = await accounts.findById(userId)
  if (!account) return null

  await accounts.touch(account.id)
  return toUser(account)
}
