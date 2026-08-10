import Link from 'next/link'

import { Icon } from '@/components/ui/Icon'
import { APP_NAME } from '@/lib/env'

export const metadata = { title: '기도 요청을 받았습니다' }

/**
 * 보내고 난 뒤의 화면.
 *
 * 보낸 글을 다시 보여 주지 않는다. 로그인 없이 열리는 자리라, 여기서 내용을
 * 되비추면 뒤로가기나 공유된 링크로 남의 사정이 흘러나갈 수 있다.
 */
export default function RequestDonePage() {
  return (
    <main id="main" className="reading-column enter-rise py-20">
      <div className="flex flex-col gap-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-weak text-accent">
          <Icon name="check" size={22} />
        </span>
        <h1 className="type-display text-text">기도 요청을 받았습니다</h1>
        <p className="type-body text-text-secondary">
          중보기도팀이 확인한 뒤 기도제목으로 올려 함께 기도하겠습니다.
          혼자 짊어지지 않으셔도 됩니다.
        </p>
        <p className="type-caption">
          같은 분을 위해 또 부탁하실 일이 생기면 언제든 다시 보내 주세요.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        <Link
          prefetch={false}
          href="/request"
          className="inline-flex h-12 w-fit items-center rounded-button border border-line px-4 text-[15px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
        >
          기도 하나 더 부탁하기
        </Link>
        <p className="type-caption">
          {APP_NAME} 멤버라면{' '}
          <Link prefetch={false} href="/login" className="text-accent underline-offset-4 hover:underline">
            로그인
          </Link>
          해서 함께 기도할 수 있습니다.
        </p>
      </div>
    </main>
  )
}
