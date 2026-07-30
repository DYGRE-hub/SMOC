'use client'

import { useId, useState } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** 선택 시 아래에 붙는 한 줄 설명. 익명/공개범위처럼 결과가 중요한 선택에 쓴다. */
  hint?: string
}

interface Props<T extends string> {
  name: string
  legend: string
  options: SegmentOption<T>[]
  defaultValue: T
  onChangeValue?: (value: T) => void
}

/**
 * PRD §9.3 작성 화면 — 익명 여부와 공개 범위를 별도 화면 이동 없이 고르게 하는 컨트롤.
 * 라디오 그룹으로 구현해서 키보드 방향키 이동이 기본으로 동작한다.
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  defaultValue,
  onChangeValue,
}: Props<T>) {
  const [value, setValue] = useState<T>(defaultValue)
  const groupId = useId()
  const active = options.find((o) => o.value === value)

  return (
    <fieldset className="min-w-0">
      <legend className="type-caption mb-2">{legend}</legend>
      <div
        className="flex w-full overflow-hidden rounded-[10px] border border-line"
        role="radiogroup"
        aria-label={legend}
      >
        {options.map((option) => {
          const id = `${groupId}-${option.value}`
          const selected = option.value === value
          return (
            <div key={option.value} className="relative min-w-0 flex-1">
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => {
                  setValue(option.value)
                  onChangeValue?.(option.value)
                }}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={[
                  'flex h-11 cursor-pointer items-center justify-center px-2 text-center text-[14px] transition-colors duration-200 ease-[var(--ease-quiet)]',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent',
                  selected
                    ? 'bg-accent-weak font-medium text-accent'
                    : 'text-text-secondary hover:text-text',
                ].join(' ')}
              >
                {option.label}
              </label>
            </div>
          )
        })}
      </div>
      {active?.hint ? (
        <p className="type-caption mt-2" aria-live="polite">
          {active.hint}
        </p>
      ) : null}
    </fieldset>
  )
}
