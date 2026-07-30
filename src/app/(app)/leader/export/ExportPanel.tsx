'use client'

import { useState } from 'react'

import { Icon } from '@/components/ui/Icon'
import type { ExportResult } from '@/lib/export'

/**
 * PRD §5 — 채널 운영이 어려운 소규모 교회를 위한 저기술 경로.
 * 버튼 한 번으로 서식화된 텍스트를 클립보드에 담아 단톡방에 붙여넣게 한다.
 * 실사용에서는 이쪽이 더 많이 쓰일 가능성이 높다.
 */
export function ExportPanel({
  bulletin,
  kakao,
}: {
  bulletin: ExportResult
  kakao: ExportResult
}) {
  const [tab, setTab] = useState<'kakao' | 'bulletin'>('kakao')
  const [copied, setCopied] = useState(false)
  const current = tab === 'kakao' ? kakao : bulletin

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex overflow-hidden rounded-[10px] border border-line" role="tablist">
        {(
          [
            ['kakao', '카카오톡 붙여넣기용'],
            ['bulletin', '주보 삽입용'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={[
              'h-11 flex-1 text-[14px] transition-colors duration-200 ease-[var(--ease-quiet)]',
              tab === value
                ? 'bg-accent-weak font-medium text-accent'
                : 'text-text-secondary hover:text-text active:opacity-70',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <ExclusionNotice result={current} />

      <textarea
        readOnly
        value={current.text}
        rows={16}
        aria-label="내보낼 텍스트"
        className="w-full resize-y rounded-[12px] border border-line bg-surface p-4 font-mono text-[16px] leading-[1.7] text-text outline-none"
      />

      <button
        type="button"
        onClick={copy}
        className="flex h-[52px] items-center justify-center gap-2 rounded-button bg-accent text-[16px] font-medium text-white transition-opacity duration-200 ease-[var(--ease-quiet)] hover:opacity-90 active:opacity-75"
      >
        <Icon name={copied ? 'check' : 'download'} size={18} />
        {copied ? '복사했습니다' : '클립보드에 복사'}
      </button>
      <p className="type-caption" aria-live="polite">
        {copied ? '단톡방에 그대로 붙여넣으시면 됩니다.' : ''}
      </p>
    </div>
  )
}

function ExclusionNotice({ result }: { result: ExportResult }) {
  const excluded = result.excludedAnonymous + result.excludedLeadersOnly
  if (excluded === 0) {
    return (
      <p className="type-caption">
        {result.included}건이 포함되었습니다. 제외된 항목은 없습니다.
      </p>
    )
  }

  const parts: string[] = []
  if (result.excludedAnonymous > 0) parts.push(`익명 ${result.excludedAnonymous}건`)
  if (result.excludedLeadersOnly > 0) parts.push(`리더 전용 ${result.excludedLeadersOnly}건`)

  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <p className="type-body text-[15px] text-text">
        {result.included}건이 포함되고, {parts.join('과 ')}은 자동으로 제외되었습니다.
      </p>
      <p className="type-caption mt-1">
        익명과 리더 전용 항목은 어떤 형식으로도 내보낼 수 없습니다.
      </p>
    </div>
  )
}
