'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { endSession, getCurrentUser, startSession } from '@/lib/auth/session'
import { getAccountStore } from '@/lib/db'
import { verifyPassword } from '@/lib/db/accounts'

export interface AuthResult {
  ok: boolean
  error?: string
}

/**
 * 가입 비밀문구.
 *
 * 기도제목에는 건강·가정·재정 이야기가 담긴다. 링크를 아는 사람 누구나
 * 가입해서 전부 읽을 수 있으면 안 되므로, 공동체가 공유하는 문구를 한 겹 둔다.
 * 유출이 의심되면 환경변수만 바꾸면 된다.
 */
function signupPassphrase(): string {
  return (process.env.SIGNUP_PASSPHRASE ?? 'SMOC').trim()
}

const emailSchema = z.string().trim().toLowerCase().email('이메일 형식이 올바르지 않습니다.')

const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상으로 정해 주세요.')
    .max(128, '비밀번호가 너무 깁니다.'),
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(40),
  displayName: z
    .string()
    .trim()
    .min(2, '표시 ID는 2자 이상이어야 합니다.')
    .max(20, '표시 ID는 20자까지 쓸 수 있습니다.'),
  passphrase: z.string().trim().min(1, '가입 문구를 입력해 주세요.'),
  // 민감정보 처리 동의는 서비스 이용 동의와 분리해서 받는다(PRD §8).
  sensitiveConsent: z.literal('on', { message: '민감정보 처리 동의가 필요합니다.' }),
  covenant: z.literal('on', { message: '비밀 유지 서약에 동의해 주세요.' }),
})

export async function signUpAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    displayName: formData.get('displayName'),
    passphrase: formData.get('passphrase'),
    sensitiveConsent: formData.get('sensitiveConsent'),
    covenant: formData.get('covenant'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const input = parsed.data

  // 대소문자는 무시한다. 문구를 옮겨 적다 대문자 하나 틀려서 못 들어오는 일은 없어야 한다.
  if (input.passphrase.toLowerCase() !== signupPassphrase().toLowerCase()) {
    return { ok: false, error: '가입 문구가 맞지 않습니다. 리더에게 문의해 주세요.' }
  }

  const accounts = await getAccountStore()

  if (await accounts.findByEmail(input.email)) {
    return { ok: false, error: '이미 가입된 이메일입니다. 로그인해 주세요.' }
  }
  if (await accounts.displayNameTaken(input.displayName)) {
    return { ok: false, error: '이미 사용 중인 표시 ID입니다. 다른 이름을 골라 주세요.' }
  }

  const account = await accounts.create({
    email: input.email,
    password: input.password,
    name: input.name,
    displayName: input.displayName,
  })

  await startSession(account.id)
  revalidatePath('/', 'layout')
  redirect('/')
}

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
})

export async function signInAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }

  const accounts = await getAccountStore()
  const account = await accounts.findByEmail(parsed.data.email)

  // 계정이 없을 때와 비밀번호가 틀렸을 때를 구분해서 알려주지 않는다.
  // 어떤 이메일이 가입되어 있는지 알려주는 셈이 되기 때문이다.
  if (!account || !verifyPassword(parsed.data.password, account)) {
    return { ok: false, error: '이메일 또는 비밀번호가 맞지 않습니다.' }
  }

  await startSession(account.id)
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOutAction(): Promise<void> {
  await endSession()
  revalidatePath('/', 'layout')
  redirect('/login')
}

const displayNameSchema = z
  .string()
  .trim()
  .min(2, '표시 ID는 2자 이상이어야 합니다.')
  .max(20, '표시 ID는 20자까지 쓸 수 있습니다.')

/**
 * 표시 ID 변경.
 * 이미 올라간 기도제목에는 작성 당시의 이름이 그대로 남는다.
 * 소급해서 바꾸면 "그때 그 사람"을 추적하기 쉬워져 익명성이 약해진다.
 */
export async function updateDisplayNameAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const parsed = displayNameSchema.safeParse(formData.get('displayName'))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.' }
  }
  if (parsed.data === user.displayName) return { ok: true }

  const accounts = await getAccountStore()
  if (await accounts.displayNameTaken(parsed.data, user.id)) {
    return { ok: false, error: '이미 사용 중인 표시 ID입니다.' }
  }

  await accounts.update(user.id, { displayName: parsed.data })
  revalidatePath('/', 'layout')
  return { ok: true }
}
