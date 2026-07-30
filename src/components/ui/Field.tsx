import { forwardRef } from 'react'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

/**
 * 폼 입력 한 칸.
 * 라벨은 항상 보이게 둔다 — placeholder 만으로 라벨을 대신하면
 * 입력을 시작한 순간 무엇을 쓰는 칸이었는지 사라진다.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name
  const describedBy = hint || error ? `${inputId}-desc` : undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="type-caption">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={[
          'h-12 w-full rounded-[10px] border bg-surface px-3.5 text-[16px] text-text outline-none',
          'transition-colors duration-200 ease-[var(--ease-quiet)]',
          'placeholder:text-text-tertiary',
          error ? 'border-urgent' : 'border-line focus:border-accent/50',
          className ?? '',
        ].join(' ')}
        {...props}
      />
      {hint || error ? (
        <p id={describedBy} className={`type-caption ${error ? 'text-urgent' : ''}`}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  )
})
