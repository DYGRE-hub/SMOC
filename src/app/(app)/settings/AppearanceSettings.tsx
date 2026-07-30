'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
type TextSize = 's' | 'm' | 'l'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]

/** PRD §9.4 — 고령 교인을 고려한 본문 글자 크기 3단계 */
const SIZES: { value: TextSize; label: string }[] = [
  { value: 's', label: '보통' },
  { value: 'm', label: '크게' },
  { value: 'l', label: '더 크게' },
]

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>('light')
  const [size, setSize] = useState<TextSize>('s')

  useEffect(() => {
    const t = localStorage.getItem('golbang.theme')
    if (t === 'dark') setTheme('dark')
    const s = localStorage.getItem('golbang.textsize')
    if (s === 'm' || s === 'l') setSize(s)
  }, [])

  function applyTheme(next: Theme) {
    setTheme(next)
    // 밝게가 기본이므로 저장하지 않고 속성만 지운다.
    if (next === 'light') {
      localStorage.removeItem('golbang.theme')
      document.documentElement.removeAttribute('data-theme')
    } else {
      localStorage.setItem('golbang.theme', next)
      document.documentElement.setAttribute('data-theme', next)
    }
  }

  function applySize(next: TextSize) {
    setSize(next)
    if (next === 's') {
      localStorage.removeItem('golbang.textsize')
      document.documentElement.removeAttribute('data-textsize')
    } else {
      localStorage.setItem('golbang.textsize', next)
      document.documentElement.setAttribute('data-textsize', next)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Group label="테마" options={THEMES} value={theme} onChange={applyTheme} />
      <Group label="본문 글자 크기" options={SIZES} value={size} onChange={applySize} />
    </div>
  )
}

function Group<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="type-caption">{label}</p>
      <div className="flex overflow-hidden rounded-[10px] border border-line" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={[
              'h-12 flex-1 text-[14px] transition-colors duration-200 ease-[var(--ease-quiet)]',
              value === option.value
                ? 'bg-accent-weak font-medium text-accent'
                : 'text-text-secondary hover:text-text',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
