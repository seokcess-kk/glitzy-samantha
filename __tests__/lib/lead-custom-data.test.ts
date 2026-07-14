import { extractCustomEntries, formatCustomValue } from '@/lib/lead-custom-data'

describe('formatCustomValue — ISO 타임스탬프 KST 변환', () => {
  it('Z 포함 ISO 문자열을 KST 년-월-일 시:분으로 변환', () => {
    // 2026-07-14T08:46:16.956Z = KST 17:46
    expect(formatCustomValue('2026-07-14T08:46:16.956Z')).toBe('2026-07-14 17:46')
  })

  it('타임존 없는 timestamp 문자열은 UTC로 취급 (DB 컨벤션)', () => {
    expect(formatCustomValue('2026-07-14T08:46:19.534128')).toBe('2026-07-14 17:46')
  })

  it('오프셋 포함 ISO 문자열 변환', () => {
    expect(formatCustomValue('2026-07-14T17:46:00+09:00')).toBe('2026-07-14 17:46')
  })

  it('KST 자정 경계 — UTC 15시 이후는 다음 날로 표시', () => {
    expect(formatCustomValue('2026-07-14T15:30:00Z')).toBe('2026-07-15 00:30')
  })

  it('날짜만 있는 문자열(시간 없음)은 그대로 유지', () => {
    expect(formatCustomValue('2026-07-14')).toBe('2026-07-14')
  })

  it('ISO 형태지만 무효한 날짜는 원문 유지', () => {
    expect(formatCustomValue('2026-99-99T99:99')).toBe('2026-99-99T99:99')
  })

  it('일반 문자열은 영향 없음', () => {
    expect(formatCustomValue('울쎄라피 300샷')).toBe('울쎄라피 300샷')
  })
})

describe('extractCustomEntries — LP 동의 시각(agreed_at) 표시', () => {
  const optimaCustomData = {
    lang: 'ko',
    name: '테스트url',
    page: '오픈 사전예약',
    fbclid: null,
    product: 'open-pre-reservation',
    agreed_at: '2026-07-14T08:46:16.956Z',
  }

  it('agreed_at 이 "동의 시각" 라벨 + KST 시분 포맷으로 노출', () => {
    const entries = extractCustomEntries(optimaCustomData)
    const agreed = entries.find(e => e.label === '동의 시각')
    expect(agreed).toBeDefined()
    expect(agreed!.value).toBe('2026-07-14 17:46')
  })

  it('내부 키(name·product·fbclid·lang)는 제외, page 는 유지', () => {
    const entries = extractCustomEntries(optimaCustomData)
    const labels = entries.map(e => e.label)
    expect(labels).toEqual(['page', '동의 시각'])
  })
})
