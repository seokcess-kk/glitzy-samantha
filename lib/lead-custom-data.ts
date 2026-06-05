// 랜딩페이지 리드의 custom_data(JSONB) 를 화면 표시용으로 평탄화하는 유틸.
// 폼이 보내는 구조가 제각각이어도(survey 중첩 / 평면 / 불리언 / 배열) 깔끔하게 라벨·값 쌍으로 정리한다.
// 핵심: 사용자가 "실제 고른 값"만 노출하고, 폼이 함께 실어보내는 전체 메뉴/템플릿 설정값은 숨긴다.
// 사용처: app/(dashboard)/leads/page.tsx, app/(dashboard)/campaigns/page.tsx

// 화면에 직접 노출하지 않는 키.
// - 내부 처리: 이름은 카드 헤더, 동의는 별도 줄, 식별자는 비표시
// - 템플릿/이벤트 설정값: 사용자의 선택이 아니라 랜딩페이지가 항상 실어보내는 메타데이터(전체 메뉴·이벤트 정보)
const CUSTOM_DATA_INTERNAL_KEYS = new Set([
  'name', 'marketing_consent', 'idempotency_key', 'event_id',
  'options', 'product', 'price_note', 'event_period',
])

// 영문 키를 한글 라벨로 보정 (매칭 없으면 키 그대로 노출). survey 안의 한글 키는 그대로 유지됨
const CUSTOM_DATA_LABELS: Record<string, string> = {
  age: '연령대',
  gender: '성별',
  region: '지역',
  budget: '예산',
  concern: '관심 부위',
  selected_option_name: '상품명',
  price: '가격',
}

// 통화로 표기할 키 — 숫자면 1,000 단위 구분 + "원"
const CUSTOM_DATA_CURRENCY_KEYS = new Set(['price', 'amount', 'total'])

// 표시 우선순위 — 선택 상품/가격을 맨 앞에. 나머지는 입력 순서 유지
const CUSTOM_DATA_PRIORITY = ['selected_option_name', 'price']

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

// 키 맥락을 반영한 스칼라 포맷 (통화 등)
function formatScalar(key: string, value: unknown): string {
  if (CUSTOM_DATA_CURRENCY_KEYS.has(key) && value !== '' && !Number.isNaN(Number(value))) {
    return `${Number(value).toLocaleString('ko-KR')}원`
  }
  return formatCustomValue(value)
}

// custom_data 를 { label, value } 목록으로 평탄화한다.
// - survey 같은 중첩 객체는 한 단계 펼침
// - 객체 배열(전체 메뉴/카탈로그)은 제외, 스칼라 배열(다중선택 답변)은 join
// - 내부/설정 키·빈 값은 제외, 선택 상품/가격을 앞으로 정렬
export function extractCustomEntries(customData: unknown): { label: string; value: string }[] {
  if (!customData || typeof customData !== 'object') return []
  const collected: { key: string; label: string; value: string }[] = []
  const push = (key: string, value: string) => {
    if (value) collected.push({ key, label: CUSTOM_DATA_LABELS[key] || key, value })
  }
  const walk = (obj: Record<string, unknown>) => {
    Object.entries(obj).forEach(([key, raw]) => {
      if (CUSTOM_DATA_INTERNAL_KEYS.has(key)) return
      if (raw === null || raw === undefined || raw === '') return
      if (Array.isArray(raw)) {
        // 객체 배열 = 전체 메뉴/카탈로그 → 제외. 스칼라 배열 = 다중선택 답변 → join 표시
        if (raw.some(item => item !== null && typeof item === 'object')) return
        push(key, raw.map(formatCustomValue).filter(Boolean).join(', '))
        return
      }
      if (typeof raw === 'object') {
        // 중첩 객체(예: survey)는 한 단계 펼쳐 항목으로 — [object Object] 노출 방지
        walk(raw as Record<string, unknown>)
        return
      }
      push(key, formatScalar(key, raw))
    })
  }
  walk(customData as Record<string, unknown>)

  const rank = (k: string) => {
    const i = CUSTOM_DATA_PRIORITY.indexOf(k)
    return i === -1 ? CUSTOM_DATA_PRIORITY.length : i
  }
  return collected
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map(({ label, value }) => ({ label, value }))
}
