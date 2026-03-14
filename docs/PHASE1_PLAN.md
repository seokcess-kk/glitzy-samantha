# Phase 1: 데이터 연결 구현 계획

## 목표
광고 UTM 데이터와 고객 데이터를 연결하여, 캠페인별/채널별 성과 분석이 가능하게 만들기

---

## 현재 상태 분석

### 문제점
```
현재: UTM 파라미터가 inflow_url에 통째로 저장
      → 분석 시 URL 파싱 필요
      → 채널별/캠페인별 집계 불가

목표: UTM 파라미터를 개별 필드로 저장
      → 즉시 집계/필터링 가능
```

### 현재 데이터 흐름
```
광고 클릭 (UTM 포함 URL)
    ↓
외부 시스템 → POST /api/webhook/lead
    ↓
leads 테이블 저장:
  - campaign_id: ✅ 저장됨
  - inflow_url: ✅ 저장됨 (전체 URL)
  - utm_source/medium/campaign/content/term: ❌ 없음
```

### 목표 데이터 흐름
```
광고 클릭 (UTM 포함 URL)
    ↓
외부 시스템 → POST /api/webhook/lead
    ↓
leads 테이블 저장:
  - utm_source: ✅ 개별 저장
  - utm_medium: ✅ 개별 저장
  - utm_campaign: ✅ 개별 저장
  - utm_content: ✅ 개별 저장
  - utm_term: ✅ 개별 저장
  - inflow_url: ✅ 원본 URL (백업)
```

---

## 작업 목록

### Task 1: DB 마이그레이션 스크립트 작성
**파일**: `supabase/migrations/add_utm_fields.sql` (신규)

```sql
-- leads 테이블에 UTM 필드 추가
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(50),
ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
ADD COLUMN IF NOT EXISTS utm_content VARCHAR(200),
ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100);

-- 인덱스 추가 (분석 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_created_clinic ON leads(clinic_id, created_at);

-- 기존 데이터 마이그레이션: inflow_url에서 UTM 추출
-- (선택적 - 기존 데이터가 있는 경우)
```

**의존성**: 없음
**예상 영향**: leads 테이블 스키마 변경

---

### Task 2: webhook/lead API 수정
**파일**: `app/api/webhook/lead/route.ts`

**변경 사항**:
1. 요청 body에 UTM 파라미터 추가
2. UTM 파라미터 개별 저장
3. inflow_url에서 UTM 자동 추출 (파라미터 미제공 시)

**수정 전**:
```typescript
body = {
  name, phoneNumber, campaignId, source, inflowUrl, clinic_id
}

// leads 저장
.insert({
  customer_id, clinic_id, campaign_id, inflow_url, chatbot_sent
})
```

**수정 후**:
```typescript
body = {
  name, phoneNumber,
  // 기존 (호환)
  campaignId, source, inflowUrl, clinic_id,
  // 신규 UTM
  utm_source, utm_medium, utm_campaign, utm_content, utm_term
}

// leads 저장
.insert({
  customer_id, clinic_id,
  // UTM 필드
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  // 기존 필드 (호환)
  campaign_id, inflow_url,
  chatbot_sent
})
```

**의존성**: Task 1 (DB 필드 존재)
**하위 호환**: 기존 campaignId, source, inflowUrl 계속 지원

---

### Task 3: UTM 파싱 유틸리티 추가
**파일**: `lib/utm.ts` (신규)

**기능**:
```typescript
// URL에서 UTM 파라미터 추출
export function parseUtmFromUrl(url: string): UtmParams | null

// UTM 파라미터 검증 및 sanitize
export function sanitizeUtmParams(params: Partial<UtmParams>): UtmParams

// UTM 타입 정의
export interface UtmParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}
```

**의존성**: 없음

---

### Task 4: leads API 수정
**파일**: `app/api/leads/route.ts`

**변경 사항**:
- select 쿼리에 utm_* 필드 포함 (이미 `*`로 전체 선택 중이므로 자동 포함)

**추가 확인**:
- utm_* 필드가 응답에 포함되는지 확인

**의존성**: Task 1

---

### Task 5: leads 페이지 UI 수정
**파일**: `app/(dashboard)/leads/page.tsx`

**변경 사항**:
1. CustomerDetail 컴포넌트에 UTM 정보 표시
2. 유입 경로에 상세 UTM 파라미터 표시

**수정 위치**: CustomerDetail 함수 내 "여정 타임라인" 섹션

**수정 전**:
```tsx
<p className="text-xs text-slate-500">
  {c?.first_source} → 랜딩페이지 DB 등록
</p>
```

**수정 후**:
```tsx
<p className="text-xs text-slate-500">
  {lead.utm_source || c?.first_source}
  {lead.utm_medium && ` / ${lead.utm_medium}`}
  {lead.utm_campaign && ` · ${lead.utm_campaign}`}
</p>
{lead.utm_content && (
  <p className="text-xs text-slate-600 mt-0.5">
    소재: {lead.utm_content}
  </p>
)}
```

**의존성**: Task 1, Task 4

---

### Task 6: (선택) 웹폼 페이지 구현
**파일**: `app/(dashboard)/lead-form/page.tsx` (신규)

**목적**: MMI 내장 리드 수집 폼 (외부 시스템 없이 직접 테스트 가능)

**기능**:
1. URL에서 UTM 파라미터 자동 읽기
2. 고객 정보 입력 폼 (이름, 전화번호)
3. webhook/lead API 호출
4. 성공/실패 피드백

**구현**:
```tsx
// URL: /lead-form?utm_source=meta&utm_campaign=spring_promo

// 자동으로 UTM 파라미터 읽기
const searchParams = useSearchParams()
const utm_source = searchParams.get('utm_source')
const utm_campaign = searchParams.get('utm_campaign')
// ...

// 폼 제출 시 webhook/lead API 호출
const handleSubmit = async () => {
  await fetch('/api/webhook/lead', {
    method: 'POST',
    body: JSON.stringify({
      name, phoneNumber,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      inflowUrl: window.location.href,
      clinic_id: selectedClinicId
    })
  })
}
```

**의존성**: Task 2
**우선순위**: 낮음 (테스트용)

---

### Task 7: KPI 계산 로직 수정 준비
**범위**: Phase 2에서 구현, Phase 1에서는 데이터 구조만 준비

**Phase 1에서 확인할 것**:
- leads 테이블에 utm_* 필드 존재
- 신규 리드에 utm_* 데이터 저장됨
- API에서 utm_* 필드 반환됨

**Phase 2에서 구현할 것**:
- 채널별 리드 집계 API
- 캠페인별 ROAS 계산 API
- 대시보드 KPI 카드 연결

---

## 작업 순서 (의존성 기반)

```
┌─────────────────────────────────────────────────────────────┐
│ 단계 1: 기반 작업 (병렬 가능)                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ Task 1           │    │ Task 3           │               │
│  │ DB 마이그레이션   │    │ UTM 유틸리티     │               │
│  │ (SQL 스크립트)   │    │ (lib/utm.ts)    │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
└───────────┼───────────────────────┼──────────────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 단계 2: API 수정                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │ Task 2: webhook/lead API 수정             │               │
│  │ - UTM 파라미터 수신                       │               │
│  │ - 개별 필드로 저장                        │               │
│  │ - inflow_url에서 자동 추출               │               │
│  └────────────────────┬─────────────────────┘               │
│                       │                                      │
│  ┌────────────────────┴─────────────────────┐               │
│  │ Task 4: leads API 확인 (수정 불필요)      │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ 단계 3: UI 수정                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │ Task 5: leads 페이지 수정                 │               │
│  │ - UTM 정보 표시                           │               │
│  │ - 여정 타임라인 개선                      │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │ Task 6: 웹폼 페이지 (선택)                │               │
│  │ - 테스트용 리드 수집 폼                   │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ 단계 4: 테스트 및 검증                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Supabase에서 마이그레이션 실행                          │
│  2. webhook/lead API 테스트 (curl/Postman)                  │
│  3. leads 페이지에서 UTM 표시 확인                          │
│  4. (선택) 웹폼으로 end-to-end 테스트                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 파일 변경 요약

| 파일 | 작업 | 상태 |
|------|------|------|
| `supabase/migrations/add_utm_fields.sql` | 신규 생성 | Task 1 |
| `lib/utm.ts` | 신규 생성 | Task 3 |
| `app/api/webhook/lead/route.ts` | 수정 | Task 2 |
| `app/api/leads/route.ts` | 확인 (수정 불필요) | Task 4 |
| `app/(dashboard)/leads/page.tsx` | 수정 | Task 5 |
| `app/(dashboard)/lead-form/page.tsx` | 신규 생성 (선택) | Task 6 |

---

## 테스트 시나리오

### 시나리오 1: webhook/lead API 테스트
```bash
curl -X POST http://localhost:3000/api/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트고객",
    "phoneNumber": "010-1234-5678",
    "utm_source": "meta",
    "utm_medium": "cpc",
    "utm_campaign": "spring_promo_2024",
    "utm_content": "banner_v1",
    "clinic_id": 1
  }'
```

**예상 결과**:
```json
{
  "success": true,
  "leadId": 123,
  "customerId": 456
}
```

**DB 확인**:
```sql
SELECT utm_source, utm_medium, utm_campaign, utm_content
FROM leads WHERE id = 123;
-- 결과: meta, cpc, spring_promo_2024, banner_v1
```

### 시나리오 2: inflow_url에서 자동 추출
```bash
curl -X POST http://localhost:3000/api/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "자동추출테스트",
    "phoneNumber": "010-9999-8888",
    "inflowUrl": "https://landing.com?utm_source=google&utm_campaign=summer_sale",
    "clinic_id": 1
  }'
```

**예상 결과**:
- utm_source: "google" (자동 추출)
- utm_campaign: "summer_sale" (자동 추출)

### 시나리오 3: leads 페이지 확인
1. `/leads` 페이지 접속
2. 위에서 생성한 리드 클릭
3. 여정 타임라인에 UTM 정보 표시 확인
   - "meta / cpc · spring_promo_2024"
   - "소재: banner_v1"

---

## 롤백 계획

### DB 롤백
```sql
-- UTM 컬럼 제거 (필요 시)
ALTER TABLE leads
DROP COLUMN IF EXISTS utm_source,
DROP COLUMN IF EXISTS utm_medium,
DROP COLUMN IF EXISTS utm_campaign,
DROP COLUMN IF EXISTS utm_content,
DROP COLUMN IF EXISTS utm_term;

DROP INDEX IF EXISTS idx_leads_utm_source;
DROP INDEX IF EXISTS idx_leads_utm_campaign;
```

### 코드 롤백
- Git revert로 webhook/lead, leads 페이지 복원
- lib/utm.ts 삭제

---

## 성공 기준

Phase 1 완료 시 체크리스트:

- [ ] leads 테이블에 utm_* 5개 필드 존재
- [ ] webhook/lead API가 utm_* 파라미터 수신 및 저장
- [ ] inflow_url만 제공 시 utm_* 자동 추출
- [ ] /api/leads 응답에 utm_* 필드 포함
- [ ] /leads 페이지에서 UTM 정보 시각화
- [ ] 기존 기능 하위 호환 유지 (campaignId, source, inflowUrl)

---

## 다음 단계 (Phase 2 미리보기)

Phase 1 완료 후:
1. KPI 계산 API 수정 (채널별/캠페인별 집계)
2. 대시보드 KPI 카드에 실제 데이터 연결
3. 퍼널 분석 API 구현

---

*작성일: 2024*
*버전: 1.0*
