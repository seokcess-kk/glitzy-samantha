// 랜딩페이지 리드의 custom_data(JSONB) 를 화면 표시용으로 평탄화하는 유틸.
// 폼이 보내는 구조가 제각각이어도(survey 중첩 / 평면 / 불리언 / 배열) 깔끔하게 라벨·값 쌍으로 정리한다.
// 사용처: app/(dashboard)/leads/page.tsx, app/(dashboard)/campaigns/page.tsx

// 화면에 직접 노출하지 않는 내부 키 (이름은 카드 헤더에 별도 표시, 동의/식별자는 별도 처리)
const CUSTOM_DATA_INTERNAL_KEYS = new Set(['name', 'marketing_consent', 'idempotency_key', 'event_id'])

// 영문 키를 한글 라벨로 보정 (매칭 없으면 키 그대로 노출). survey 안의 한글 키는 그대로 유지됨
const CUSTOM_DATA_LABELS: Record<string, string> = {
  age: '연령대',
  gender: '성별',
  region: '지역',
  budget: '예산',
  concern: '관심 부위',
}

// 단일 값을 사람이 읽을 문자열로. 불리언/배열/중첩 객체를 안전 처리해 [object Object] 노출을 막는다.
export function formatCustomValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  if (Array.isArray(value)) return value.map(formatCustomValue).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(formatCustomValue).filter(Boolean).join(', ')
  }
  return String(value)
}

// custom_data 를 { label, value } 목록으로 평탄화한다.
// survey 같은 중첩 객체는 한 단계 펼치고, 내부 키·빈 값은 제외한다.
export function extractCustomEntries(customData: unknown): { label: string; value: string }[] {
  if (!customData || typeof customData !== 'object') return []
  const entries: { label: string; value: string }[] = []
  const walk = (obj: Record<string, unknown>) => {
    Object.entries(obj).forEach(([key, raw]) => {
      if (CUSTOM_DATA_INTERNAL_KEYS.has(key)) return
      if (raw === null || raw === undefined || raw === '') return
      // 중첩 객체(예: survey)는 한 단계 펼쳐 항목으로 — [object Object] 노출 방지
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        walk(raw as Record<string, unknown>)
        return
      }
      const value = formatCustomValue(raw)
      if (value) entries.push({ label: CUSTOM_DATA_LABELS[key] || key, value })
    })
  }
  walk(customData as Record<string, unknown>)
  return entries
}
