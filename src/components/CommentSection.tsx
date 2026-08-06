'use client'

import {
  forwardRef,
  useActionState,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from 'react'

import { CommentPhoto } from '@/components/CommentPhoto'
import { Icon } from '@/components/ui/Icon'
import {
  addUpdateAction,
  deleteCommentAction,
  editCommentAction,
  setStatusAction,
} from '@/lib/actions/prayers'
import {
  IMAGE_MAX_EDGE,
  IMAGE_MIME_TYPES,
  STATUSES,
  STATUS_LABEL,
  type PrayerUpdate,
  type Status,
} from '@/lib/domain/types'
import { formatDateTime } from '@/lib/format'

const TYPE_LABEL: Record<PrayerUpdate['type'], string> = {
  comment: '',
  status_change: '상태 변경',
  answer: '응답 나눔',
  edit: '본문 수정',
}

interface Props {
  prayerId: string
  updates: PrayerUpdate[]
  currentStatus: Status
  canChangeStatus: boolean
}

/**
 * 상세 화면 아래의 나눔(댓글) 영역.
 *
 * 시트 안에 감춰두지 않고 본문 바로 아래에 펼쳐 둔다.
 * 기도제목은 읽고 끝나는 글이 아니라 소식이 이어지는 글이라서,
 * 남긴 말들이 먼저 보여야 다음 사람도 한마디 보태게 된다.
 */
export function CommentSection({ prayerId, updates, currentStatus, canChangeStatus }: Props) {
  const [state, formAction, pending] = useActionState(addUpdateAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const photoRef = useRef<PhotoPickerHandle>(null)

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      photoRef.current?.clear()
    }
  }, [state])

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-6">
      <h2 id="comments-heading" className="type-caption">
        나눔 {updates.length > 0 ? updates.length : ''}
      </h2>

      {updates.length > 0 ? (
        <ol className="flex flex-col gap-6">
          {updates.map((update) => (
            <CommentItem key={update.id} update={update} prayerId={prayerId} />
          ))}
        </ol>
      ) : (
        <p className="type-caption">
          아직 나눔이 없습니다. 기도하며 떠오른 말씀이나 소식을 남겨 주세요.
        </p>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="prayerId" value={prayerId} />
        <label htmlFor="comment-body" className="sr-only">
          나눔 남기기
        </label>
        {/* required 를 걸지 않는다. 사진만 나누는 경우가 있어서다.
            둘 다 비어 있을 때만 서버가 막는다. */}
        <textarea
          id="comment-body"
          name="body"
          rows={3}
          maxLength={2000}
          placeholder="함께 기도하며 남기고 싶은 말을 적어 주세요."
          className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
        />
        <PhotoPicker ref={photoRef} />

        {state?.error ? (
          <p className="type-caption text-urgent" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 self-start rounded-button bg-accent px-5 text-[15px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75 disabled:opacity-50"
        >
          {pending ? '남기는 중…' : '나눔 남기기'}
        </button>
      </form>

      {canChangeStatus ? (
        <StatusForm prayerId={prayerId} currentStatus={currentStatus} />
      ) : null}
    </section>
  )
}

export interface PhotoPickerHandle {
  clear: () => void
}

/**
 * 사진 한 장 고르기.
 *
 * 고른 사진은 보내기 전에 브라우저에서 줄인다. 요즘 휴대폰 사진은 한 장에
 * 3~5MB인데, 그대로 올리면 서버로 가는 길에서 걸리고 데이터도 그만큼 쓴다.
 * 긴 변 1600px 이면 크게 열어 봐도 충분하고 보통 수백 KB로 내려앉는다.
 *
 * 줄인 결과를 다시 input 에 넣어 두는 것은, 폼이 평소처럼 제출되게 하기 위해서다.
 * 따로 올리는 길을 내면 글과 사진이 따로 놀다가 한쪽만 저장되는 일이 생긴다.
 */
const PhotoPicker = forwardRef<PhotoPickerHandle>(function PhotoPicker(_props, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clear = useCallback(() => {
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url)
      return null
    })
    setSize(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  useImperativeHandle(ref, () => ({ clear }), [clear])

  // 화면을 떠날 때 미리보기로 잡아 둔 자리를 돌려준다.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function pick(file: File) {
    setBusy(true)
    setError(null)
    try {
      const shrunk = await shrinkImage(file)
      const transfer = new DataTransfer()
      transfer.items.add(shrunk.file)
      if (inputRef.current) inputRef.current.files = transfer.files

      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(shrunk.file)
      })
      setSize({ width: shrunk.width, height: shrunk.height })
    } catch {
      setError('이 사진은 읽지 못했습니다. 다른 사진으로 해 보시겠어요?')
      clear()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        name="image"
        accept={IMAGE_MIME_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void pick(file)
        }}
      />
      <input type="hidden" name="imageWidth" value={size?.width ?? ''} />
      <input type="hidden" name="imageHeight" value={size?.height ?? ''} />

      {preview ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="고른 사진 미리보기"
            className="max-h-[120px] w-auto rounded-[10px] border border-line object-contain"
          />
          <button
            type="button"
            onClick={clear}
            className="type-caption h-9 underline-offset-4 hover:underline active:opacity-70"
          >
            사진 빼기
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 w-fit items-center gap-1.5 rounded-[10px] border border-line px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70 disabled:opacity-50"
        >
          <Icon name="image" size={17} />
          {busy ? '사진 준비 중…' : '사진 첨부'}
        </button>
      )}

      {error ? (
        <p className="type-caption text-urgent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})

/**
 * 긴 변을 IMAGE_MAX_EDGE 로 줄이고 JPEG 로 다시 굽는다.
 * 원본이 이미 작으면 크기는 그대로 두고 형식만 맞춘다.
 */
async function shrinkImage(file: File): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 를 쓸 수 없습니다')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.82),
  )
  if (!blob) throw new Error('사진을 변환하지 못했습니다')

  return {
    file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }),
    width,
    height,
  }
}

/**
 * 나눔 한 줄. 고칠 수 있는 사람에게만 수정·삭제가 보인다.
 *
 * editable 은 서버가 판정해 내려준 값이고, 여기서는 버튼을 그릴지에만 쓴다.
 * 진짜 권한 검사는 액션 쪽에서 다시 한다.
 */
function CommentItem({ update, prayerId }: { update: PrayerUpdate; prayerId: string }) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [state, formAction] = useActionState(editCommentAction, null)

  useEffect(() => {
    if (state?.ok) setEditing(false)
  }, [state])

  function remove() {
    startTransition(async () => {
      const result = await deleteCommentAction(update.id, prayerId)
      if (!result.ok) {
        setError(result.error ?? '지우지 못했습니다.')
        setConfirmingDelete(false)
      }
    })
  }

  const meta = (
    <p className="type-caption flex flex-wrap items-center gap-x-2">
      <span className={update.type === 'answer' ? 'text-answered' : 'text-text-secondary'}>
        {update.authorDisplayName ?? '익명'}
      </span>
      <time dateTime={update.createdAt}>{formatDateTime(update.createdAt)}</time>
      {TYPE_LABEL[update.type] ? (
        <span className={update.type === 'answer' ? 'text-answered' : undefined}>
          · {TYPE_LABEL[update.type]}
        </span>
      ) : null}
    </p>
  )

  if (editing) {
    return (
      <li className="flex flex-col gap-2">
        {meta}
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="updateId" value={update.id} />
          <input type="hidden" name="prayerId" value={prayerId} />
          <label htmlFor={`edit-${update.id}`} className="sr-only">
            나눔 수정
          </label>
          <textarea
            id={`edit-${update.id}`}
            name="body"
            rows={3}
            required
            maxLength={2000}
            defaultValue={update.body}
            autoFocus
            className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.7] text-text outline-none focus:border-accent/50"
          />
          {state?.error ? (
            <p className="type-caption text-urgent" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 rounded-button bg-accent px-4 text-[14px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-11 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
            >
              취소
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-1.5">
      {meta}
      <p className="type-body whitespace-pre-line text-text">{update.body}</p>
      {update.image ? (
        <CommentPhoto
          image={update.image}
          alt={`${update.authorDisplayName ?? '익명'} 님이 나눔에 붙인 사진`}
        />
      ) : null}

      {error ? (
        <p className="type-caption text-urgent" role="alert">
          {error}
        </p>
      ) : null}

      {update.editable ? (
        confirmingDelete ? (
          // 브라우저 확인창을 쓰지 않는다. 모바일에서 잘못 눌러도 되돌릴 수 있게 두 단계.
          <p className="type-caption flex items-center gap-3">
            <span>정말 지울까요?</span>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="h-9 text-urgent underline-offset-4 hover:underline active:opacity-70 disabled:opacity-50"
            >
              지우기
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              취소
            </button>
          </p>
        ) : (
          <p className="type-caption flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="h-9 underline-offset-4 hover:underline active:opacity-70"
            >
              삭제
            </button>
          </p>
        )
      ) : null}
    </li>
  )
}

/** 상태 변경은 리더 또는 본인만. 응답으로 옮기는 것도 여기서 한다. */
function StatusForm({ prayerId, currentStatus }: { prayerId: string; currentStatus: Status }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>(currentStatus)
  const [state, formAction, pending] = useActionState(setStatusAction, null)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-caption flex h-11 items-center gap-1.5 self-start underline-offset-4 hover:underline"
      >
        <Icon name="check" size={14} />
        상태 바꾸기 (지금은 {STATUS_LABEL[currentStatus]})
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-6">
      <input type="hidden" name="prayerId" value={prayerId} />
      <input type="hidden" name="status" value={status} />
      <p className="type-caption">상태 바꾸기</p>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={[
              'h-11 rounded-[10px] border px-3 text-[13px]',
              'transition-colors duration-200 ease-[var(--ease-quiet)]',
              status === s
                ? 'border-accent/40 bg-accent-weak font-medium text-accent'
                : 'border-line text-text-secondary hover:text-text active:opacity-70',
            ].join(' ')}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <textarea
        name="note"
        rows={2}
        placeholder={
          status === 'answered'
            ? '어떻게 응답되었는지 함께 나눠 주세요.'
            : '상태와 함께 남길 한마디 (선택)'
        }
        className="w-full resize-none rounded-[12px] border border-line bg-surface p-4 text-[16px] leading-[1.7] text-text outline-none placeholder:text-text-tertiary focus:border-accent/50"
      />
      {state?.error ? (
        <p className="type-caption text-urgent" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || status === currentStatus}
          className="h-12 rounded-button border border-line px-4 text-[15px] text-text transition-colors duration-200 ease-[var(--ease-quiet)] hover:border-accent/40 disabled:opacity-40"
        >
          {STATUS_LABEL[status]}(으)로 바꾸기
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-12 px-3 text-[14px] text-text-secondary transition-colors duration-200 ease-[var(--ease-quiet)] hover:text-text active:opacity-70"
        >
          취소
        </button>
      </div>
    </form>
  )
}
