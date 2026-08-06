'use client'

import { useEffect, useRef } from 'react'

import { Icon } from '@/components/ui/Icon'
import type { PrayerUpdateImage } from '@/lib/domain/types'

/**
 * 나눔에 붙은 사진.
 *
 * 본문에서는 작게 눕혀 둔다. 나눔은 읽는 글이고 사진은 곁들임이라,
 * 사진이 화면을 다 차지하면 아래 이어지는 소식이 묻힌다.
 * 자세히 보고 싶은 사람만 눌러서 크게 연다.
 *
 * 크게 보기는 브라우저가 가진 <dialog> 를 쓴다. 직접 만든 덮개는 뒤 화면이
 * 같이 스크롤되거나 뒤로가기로 닫히지 않는 문제를 늘 달고 다닌다.
 */
export function CommentPhoto({ image, alt }: { image: PrayerUpdateImage; alt: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const src = `/api/images/${image.id}`

  // 열려 있는 동안에는 뒤 화면이 따라 움직이지 않게 한다.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const lock = () => {
      document.body.style.overflow = 'hidden'
    }
    const unlock = () => {
      document.body.style.overflow = ''
    }
    dialog.addEventListener('close', unlock)
    return () => {
      dialog.removeEventListener('close', unlock)
      unlock()
      void lock
    }
  }, [])

  function open() {
    document.body.style.overflow = 'hidden'
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="사진 크게 보기"
        className="group mt-2 block w-fit max-w-full overflow-hidden rounded-[10px] border border-line bg-surface transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
      >
        {/* 비율을 미리 잡아 두면 사진이 뜨는 순간 아래 글이 밀리지 않는다. */}
        <img
          src={src}
          alt={alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="block max-h-[220px] w-auto max-w-full object-contain"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        />
      </button>

      {/*
        화면을 가득 채운 뒤 그 안에서 가운데로 모은다.
        <dialog> 를 기본 크기로 두면 브라우저마다 놓이는 자리가 달라진다.
      */}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/80"
      >
        <div
          onClick={(e) => {
            // 사진 바깥을 누르면 닫는다. 사진 위를 누르면 그대로 둔다.
            if (e.target === e.currentTarget) close()
          }}
          className="flex h-full w-full items-center justify-center p-3"
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[92dvh] max-w-[96vw] rounded-[10px] object-contain"
          />
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="safe-top fixed top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-80 active:opacity-70"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </dialog>
    </>
  )
}
