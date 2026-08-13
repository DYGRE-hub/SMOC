'use client'

import { useEffect } from 'react'

/**
 * 보던 자리를 기억한다.
 *
 * 목록을 한참 내려가 제목 하나를 열고 뒤로 오면 다시 맨 위였다. 긴 목록에서는
 * 방금 읽던 제목을 손으로 다시 찾아 내려가야 했고, 그러다 보면 아래쪽 제목은
 * 영영 안 읽게 된다.
 *
 * 브라우저에도 자리를 되돌리는 기능이 있지만 이 앱에서는 잘 듣지 않는다.
 * 화면마다 서버에서 새로 그려 오기 때문에, 되돌릴 시점에는 아직 글이 없어서
 * 되돌릴 자리도 없다. 그래서 직접 적어 두고 그려진 뒤에 옮긴다.
 *
 * 조건이 바뀌면(검색어·정렬·필터) 열쇠가 달라져 맨 위에서 시작한다.
 * 다른 목록을 보는 것이니 맞다.
 */
export function ScrollMemory({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const key = `smoc:scroll:${storageKey}`

    const saved = Number(sessionStorage.getItem(key) ?? 0)
    if (saved > 0) {
      // 한 번으로는 이르다 — Next 가 그린 직후 맨 위로 올려 두는 일이 있어서
      // 그 다음 프레임에 옮긴다.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, saved))
      })
    }

    let frame = 0
    const remember = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)))
      })
    }

    window.addEventListener('scroll', remember, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', remember)
      // 화면을 떠나는 순간의 자리를 마지막으로 한 번 더 적는다.
      sessionStorage.setItem(key, String(Math.round(window.scrollY)))
    }
  }, [storageKey])

  return null
}
