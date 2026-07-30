/**
 * PRD §8 — 스크린샷은 웹에서 원천 차단할 수 없다.
 * 대신 열람자 이름을 아주 흐리게 깔아, 캡처가 밖으로 나갔을 때
 * 누구의 화면이었는지 남게 한다. 기술적 통제가 아니라 사회적 억제 장치다.
 */
export function Watermark({ name }: { name: string }) {
  const rows = Array.from({ length: 8 })
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden"
    >
      {rows.map((_, i) => (
        <p
          key={i}
          className="whitespace-nowrap text-[13px] text-text-tertiary opacity-[0.055]"
          style={{ marginTop: i === 0 ? '3rem' : '7rem', transform: 'rotate(-24deg)' }}
        >
          {`${name} 열람 · `.repeat(12)}
        </p>
      ))}
    </div>
  )
}
