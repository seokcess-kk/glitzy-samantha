# Phase 0 (P0) 상세 수정 설계

> 상위 문서: [`docs/DIAGNOSIS.md`](../DIAGNOSIS.md) §7 백로그 · §8 로드맵 Phase 0
> 범위: **수치 신뢰 회복 & 모집단 준수** — B1·B2·B3·B4·B5·B28·B6
> 원칙: 이 문서는 **설계·검증 스펙**이다. 실제 코드는 아직 수정하지 않는다. 아래 `현재 → 개선` 스니펫은 구현 지침이며, DB 스키마 변경은 없음(조회/집계/렌더/라벨 레벨).
> 근거: `kpi`·`channel`·`ads/stats`·`campaigns`·`consultation`·`use-dashboard-data`는 직접 확인, 동일 패턴 반복 라우트는 DIAGNOSIS 감사 결과 인용.

## 실행 순서(권장 PR 분할)

| PR | 항목 | 이유 |
|----|------|------|
| PR-1 | **B2**(테넌트 격리), **B3**(상담 이력) | 독립·소범위·데이터 안전(누출/유실 즉시 차단). 회귀 위험 최저 |
| PR-2 | **B4**(오류→0 차단) | 프론트 훅 + `ads/stats` catch. 이후 B1 검증 시 오류가 0으로 안 숨게 선행 |
| PR-3 | **B1**(행 상한 제거) | 공통 헬퍼 `fetchAll` 도입 후 9개 라우트 일괄. 가장 광범위 |
| PR-4 | **B5·B28·B6**(정의·라벨·모집단) | `kpi`·`channel`·`attribution/summary` + 프론트 라벨. 함께 가야 정합 |

각 PR: `npm run build` → `npm run lint` → 전체 맥락 코드리뷰 → 필요 시 `npm run test:e2e`.

---

## B2 — agency_staff 캠페인 목록 테넌트 격리 (P0, 권한)

**대상**: `app/api/campaigns/route.ts:149,155` (목록/집계 분기)

**현재**(직접 확인): 라우트는 `withClinicFilter`로 `{clinicId, assignedClinicIds}`를 받고 `applyClinicFilter`도 import돼 있으나(:2), 목록 분기만 bare `eq`를 쓴다.
```ts
// :142-155 (현재)
let leadsQuery = supabase.from('leads').select('...').not('utm_campaign','is',null)
  .order('created_at',{ascending:false}).limit(2000)
if (clinicId) leadsQuery = leadsQuery.eq('clinic_id', clinicId)   // ← assignedClinicIds 무시
...
let lpQuery = supabase.from('landing_pages').select('id, name')
if (clinicId) lpQuery = lpQuery.eq('clinic_id', clinicId)          // ← 동일
```
**문제**: agency_staff가 병원 미선택으로 목록을 열면 `clinicId=null` → 필터 미적용 → **전 병원 캠페인명·리드수 노출**. (상세 분기 `?campaign=`는 :53에서 `applyClinicFilter` 사용해 안전 — 목록 분기만 누락.)

**개선 설계**:
```ts
// leads
let leadsQuery = supabase.from('leads').select('...').not('utm_campaign','is',null)
  .order('created_at',{ascending:false})   // .limit(2000) → B1에서 fetchAll로 대체
const fLeads = applyClinicFilter(leadsQuery, { clinicId, assignedClinicIds })
if (fLeads === null) return apiSuccess([])   // 배정 병원 0개
leadsQuery = fLeads
// landing_pages
let lpQuery = supabase.from('landing_pages').select('id, name')
const fLp = applyClinicFilter(lpQuery, { clinicId, assignedClinicIds })
if (fLp) lpQuery = fLp
```
**데이터 변경**: 없음. **영향 범위**: `/campaigns` 목록(캠페인 카드). superadmin(clinicId=null, assignedClinicIds=null)은 기존과 동일하게 전체 조회 유지(회귀 없음).
**검증**: agency_staff 계정(A병원만 배정)으로 병원 미선택 목록 호출 → B병원 캠페인 미노출. superadmin은 전체 노출 유지. `applyClinicFilter` 반환 null 처리 e2e.

---

## B3 — 상담 이력 덮어쓰기 → 이력 보존 (P0, 데이터 유실)

**대상**: `app/api/patients/[id]/consultation/route.ts:47-82` (PUT)

**현재**(직접 확인): `customer_id`로 `maybeSingle()` 조회 후 **있으면 UPDATE, 없으면 INSERT**.
```ts
const { data: existing } = await supabase.from('consultations')
  .select('id').eq('customer_id', customerId).maybeSingle()   // ← 고객당 1행 가정
if (existing) { /* UPDATE existing.id */ } else { /* INSERT */ }
```
**문제**: 고객당 상담이 **최대 1행**. "상담 기록 추가" 때마다 이전 상담이 **덮어써짐**. 프론트(`patients/page.tsx`)는 `consultations.map()`으로 타임라인처럼 렌더하지만 실제로는 누적되지 않음 → **상담 이력 영구 유실**.

**개선 설계**: 추가는 항상 INSERT(append). 특정 상담 수정은 `consultationId`를 명시받아 그 행만 UPDATE.
```ts
// 신규 상담 추가 (기본): 항상 INSERT — 고객당 N행 누적
result = await supabase.from('consultations').insert({
  customer_id: customerId, clinic_id: accessCheck.clinicId,
  status: status || null, notes: sanitizedNotes || null,
  consultation_date: consultationDate || null, created_by: Number(user.id),
}).select().single()

// 기존 특정 상담 수정: body.consultationId 있을 때만 그 행 UPDATE(소유 검증 포함)
```
- 프론트: "상담 추가"는 consultationId 없이 호출(INSERT), 개별 행 "수정"은 해당 `consultation.id` 전달. `consultations` 조회는 `customer_id`로 **여러 행**을 `consultation_date`/`created_at` 정렬해 렌더.
- 함께 처리 권장: **B7**(상담 상태 화이트리스트 정합 — `상담대기` 등 `lib/security.ts:21-29` vs UI `patients:283` 불일치)를 같은 PR에서 수정하면 상담 도메인 회귀를 한 번에 검증.

**데이터 변경**: 스키마 무변. `consultations`에 고객당 다행 누적(기존 1행 데이터는 그대로 최신으로 남음, 소급 복구 불가 — 유실분은 복원 불가하나 이후 보존). **영향 범위**: `patients` 상담 탭 조회/렌더가 다행 전제로 바뀜(정렬·카운트 뱃지 재확인).
**검증**: 동일 고객에 상담 2회 추가 → 2행 유지, UI 타임라인 2건. 개별 수정 시 해당 행만 변경. `logActivity` action(create/update) 분기 유지.

---

## B4 — API 오류의 "0" 위장 차단 (P0, 잘못된 수치)

**대상**:
- 라우트: `app/api/ads/stats/route.ts:57-60, 110-113` (에러/catch가 `apiSuccess({stats:[],...})` 반환)
- 프론트 훅: `hooks/use-dashboard-data.ts` — `useKpiData:24-34`, `useTrendData:57-69`, `useRecentLeads:93-114`, `useFunnelChannelData:137-149`

**현재**(직접 확인):
```ts
// ads/stats:57-60 — DB 에러를 200 빈 페이로드로 은폐
if (error) { logger.error(...); return apiSuccess({ stats: [], campaignLeadCounts: {} }) }
// use-dashboard-data:29 — 비-2xx 응답도 그대로 data에 저장 → data.totalRevenue = undefined → 0/blank
const res = await fetch(`/api/dashboard/kpi${qs}`); const json = await res.json(); setState({ data: json, ... })
// :138-144 — r.ok 미확인, 에러 바디를 [] 로 강제
Promise.allSettled([ fetch(...).then(r => r.json()), ... ])
if (channelRes.status === 'fulfilled') setChannel(Array.isArray(channelRes.value) ? channelRes.value : [])
```
**문제**: 백엔드 장애/부분 실패가 화면에서 **정상 0**으로 보임. "데이터 없음"과 "고장"을 구분 불가 → 잘못된 의사결정.

**개선 설계**:
- 라우트: DB 에러는 **`apiError('...', 500)`** 반환(빈 성공 금지). `applyClinicFilter===null`(배정 0개)만 빈 성공 유지(정상 케이스).
```ts
if (error) { logger.error(...); return apiError('광고 통계 조회 실패', 500) }   // catch 블록도 동일
```
- 훅: `res.ok` 확인 + `error` 상태 추가. 실패 시 `[]`가 아니라 **에러 플래그**를 세워 카드가 "불러오기 실패/재시도"를 렌더.
```ts
interface FetchState<T> { data: T | null; loading: boolean; error: boolean }
const res = await fetch(url)
if (!res.ok) { setState({ data: null, loading: false, error: true }); return }
const json = await res.json()
setState({ data: json, loading: false, error: false })
// allSettled 분기: r.ok 확인 후 값 세팅, 실패는 error=true (빈 배열로 뭉개지 않음)
```
- 소비 컴포넌트(`kpi-section`·`funnel-section`·`channel-table`·`recent-leads`)에 `error` 시 에러/재시도 UI. (참고: `components/ads/ads-campaign-tab.tsx:27`는 이미 `res.ok` 확인 — 이 패턴으로 통일.)

**데이터 변경**: 없음. **영향 범위**: 대시보드 4개 훅 + 소비 컴포넌트에 에러 상태 분기 추가.
**검증**: 라우트를 임시 500으로 강제(또는 네트워크 차단) → 카드가 "0"이 아니라 에러 상태. 정상 0건(신규 병원)은 여전히 0으로 정상 표시(에러와 구분).

---

## B1 — 집계 쿼리 1,000행 truncation 제거 (P0, 과소집계)

**공통 원인**: PostgREST는 명시적 `.limit()` 없으면 **최대 1,000행** 반환(`lib/services/weeklyReport.ts:13` `SUPABASE_MAX_ROWS=1000`; `external/ad-spend/route.ts:8` `AD_QUERY_LIMIT=10000`로 우회 선례). 집계 라우트가 raw 행을 JS에서 합산하며 상한을 우회하지 않아, 병원·기간·전체합 뷰가 1,000행 초과 시 조용히 과소집계.

**대상**(감사 확인):

| 라우트 | 상한 위치 | 영향 지표 |
|--------|-----------|----------|
| `dashboard/kpi` | `:31` payments(무제한), `:29` ad_stats(무제한), `:30` leads`.limit(5000)` | 매출·ROAS·CAC·ARPC·CPL·리드 |
| `dashboard/channel` | `:53-58` ad_stats(무제한), `:47`·`:64` leads/payments`.limit(5000)` | 채널 매출/스펜드 |
| `ads/stats` | `:44-56` ad_stats`select('*')`(무제한), `:66-76` leads(무제한) | 캠페인 스펜드·리드 |
| `ads/platform-summary` | `:48,58,68` ad/leads/payments(무제한) | 채널 지표 전반 |
| `attribution/summary` | `:47-57` payments/leads/ad(무제한), `:122` multi-touch leads | 귀속 매출·ROAS |
| `dashboard/trend` | `:32-43` ad/leads(무제한) | 28일 추이 |
| `attribution/roas-trend` | `:42-53` ad/payments(무제한) | ROAS 추이 |
| `ads/day-analysis` | `:51-68` leads/ad(무제한) | 요일 분석 |
| `ads/creatives-performance` | `:68-104` leads/creatives/payments/ad(무제한) | 소재 지표 |
| `campaigns`(목록) | `:147` leads`.limit(2000)` | 캠페인 리드수 |

> `dashboard/channel:47,64`처럼 `.limit(5000)`이 붙은 곳도 **5,000행에서 잘림** — "무제한"이 아니라 상한만 높을 뿐. `dashboard/kpi`(payments 무제한=1,000) vs `dashboard/channel`(payments 5000)의 **상한 불일치**가 탭 간 매출 총합 모순의 원인.

**개선 설계** — 두 전략(라우트 성격에 맞게 선택):

1) **카운트-only 지표는 `count:'exact', head:true`** (정확·저비용, 이미 kpi bookings에서 사용).
```ts
// dashboard/kpi 총 리드(현재 data.length) → 정확 카운트
const { count: totalLeads } = await applyClinicFilter(
  supabase.from('leads').select('*', { count: 'exact', head: true })
    .gte('created_at', start).lt('created_at', end), ctx)!
```
2) **합계/집합 지표는 페이지네이션 헬퍼 `fetchAll`**(신규 `lib/supabase-paginate.ts` 설계) — `.range()` 1,000단위 루프.
```ts
// lib/supabase-paginate.ts (설계)
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  page = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw error          // ← B4와 정합: 실패를 삼키지 않고 상위 catch→apiError
    if (!data?.length) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
}
// 사용 예 (dashboard/kpi payments 합계)
const payments = await fetchAll<{ payment_amount: number; customer_id: number }>((from, to) =>
  applyClinicFilter(supabase.from('payments')
    .select('payment_amount, customer_id')
    .gte('payment_date', statStart).lte('payment_date', statEnd)
    .order('id').range(from, to), ctx)!)
```
- `.range()`에는 **안정 정렬(`order('id')`)** 필수(페이지 경계 누락/중복 방지) — B23(비결정 정렬)도 부수 해결.
- `campaigns` 목록 leads(`.limit(2000)`)도 `fetchAll`로 전환.
- **성능 주의**: `fetchAll`은 대량 병원에서 왕복 증가 → 로드맵 후속(Phase 3+)에 **DB-side 집계(Postgres RPC/뷰)**로 대체 여지 명시(이번엔 스키마 무변 원칙 → JS 페이지네이션).

**데이터 변경**: 없음(쿼리 전략). **영향 범위**: 위 10개 라우트 + `demo` 픽스처 시그니처 무관. 반환 스키마 불변 → 프론트 무변.
**검증**: 결제/리드 1,000건 초과 시드로 (a) `kpi.totalRevenue` == payments 실합계, (b) `channel` 채널 매출 합 == `kpi.totalRevenue`(모순 해소), (c) 상한 이전/이후 값 일치 회귀. 대량 시 응답시간 측정.

---

## B5 — 운영 매출 vs 코호트 ROAS 분리 (P0, 모집단 위반)

**대상**: `app/api/dashboard/kpi/route.ts:46,63-64` + `components/dashboard/kpi-section.tsx`(라벨)

**현재**(직접 확인):
```ts
// kpi:63-64 — 주석까지 "리드 귀속 제한 없음"
// ROAS: 기간 내 광고비 대비 전체 매출
roas: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0,
// totalRevenue = Σ 전체 payments (광고 무관)
```
**문제**: 헤드라인 "ROAS"가 **전체 매출/광고비 blended**. 기존고객·워크인·오가닉 매출까지 분자에 포함 → 광고 성과 과대. 모집단 원칙("전체 매출을 광고 성과로 해석 금지") 위반.

**개선 설계**(Phase 0 = 라벨·정의 정정; 정확 코호트 ROAS는 귀속 링크(Phase 3 B18) 후 완성):
- `totalRevenue` → **`operationalRevenue`(운영 매출)**로 명명·라벨. 카드 문구 "전체 결제(광고 성과 아님)".
- 헤드라인 "ROAS" 카드는 **"운영 ROAS(전체매출 기준)"**로 명시하거나, 광고 성과 카드에서 제거하고 코호트 ROAS 자리로 대체.
- **코호트 ROAS = 마케팅 기여 매출 ÷ 코호트 광고비 × 100(% 또는 배수)**. Phase 0에서는 임시로 `attribution/summary`(first-touch 귀속 매출)를 소스로 "잠정 코호트 ROAS"를 표시하되 **"잠정·근사" 뱃지**. 정확판은 B18(Last Paid Touch) 후.
- 응답 필드 예: `{ operationalRevenue, operationalRoas, cohortRoasProvisional, spendIncludesMarkup }`. 라벨/단위(%,배수)를 응답 또는 UI 상수로 고정.

**데이터 변경**: 없음(1단계 라벨·재명명). **영향 범위**: `kpi/route.ts` 반환 키 변경 → `kpi-section.tsx`·`use-dashboard-data.ts` 소비부 동기 수정, `demoKpi` 픽스처 키 정합.
**검증**: 운영 매출 카드 = 전체 payments 합. 코호트 ROAS 카드가 blended와 **다른 값**으로 분리 표시(같으면 미분리). 문구에 단위(%/배수)·"광고 성과 아님" 노출.

---

## B28 — 리드/고객 지표 분리 (P0, 건수/고객 혼용)

**대상**: `app/api/dashboard/kpi/route.ts:45,65` · `app/api/dashboard/channel/route.ts:149` · `app/api/dashboard/funnel/route.ts`(전환율)

**현재**(직접 확인):
```ts
// kpi:45,65 — 리드=행수, 전환율=예약행/리드행(기간운영)
totalLeads = leadsRes.data?.length            // 이벤트 건수
bookingRate = (bookedCount / totalLeads) * 100 // bookedCount=예약행, 서로 다른 모집단
// channel:149 — 분자 distinct 고객 / 분모 distinct 리드 id (혼용)
conversionRate: (payingCustomers / leads) * 100
```
**문제**: "예약 수"가 KPI(행)·퍼널(distinct 고객)로 이중 정의(§4.2-1). 전환율이 리드 이벤트와 고객을 섞음 → 왜곡(100% 초과 가능).

**개선 설계**(단위 명시, DIAGNOSIS §4.3):
- 6개 지표를 **분리·명명**: `adLeadEvents`(리드 이벤트 수), `adUniqueCustomers`(광고 유입 고유 고객), `attributedBookingLeads`(예약 기여 리드), `bookingCustomers`(예약 고객), `leadBookingRate`(예약 기여 리드 ÷ 리드 이벤트), `customerBookingRate`(예약 고객 ÷ 고유 고객).
- **메인 카드 기본 = `leadBookingRate`**, 분모·분자 단위를 라벨/툴팁에 명시("리드 이벤트 기준").
- 전환율은 **같은 모집단끼리** 나눔(이벤트/이벤트 또는 고객/고객). 혼용 금지.
- Phase 0 한계: `attributedBookingLeads`(귀속 예약)는 정확 링크(B18) 전까지 **기간 운영 근사**(현재 bookedCount 유지하되 "기간 운영·근사" 라벨). 정확 코호트는 Phase 3.

```ts
// kpi 개선(개념)
const adLeadEvents = totalLeadCount           // count:'exact'
const adUniqueCustomers = distinctCustomerCount(leads)  // fetchAll(customer_id) → Set
// 전환율은 라벨과 함께 반환
leadBookingRate: adLeadEvents>0 ? round1((attributedBookingLeads/adLeadEvents)*100) : 0,
customerBookingRate: adUniqueCustomers>0 ? round1((bookingCustomers/adUniqueCustomers)*100) : 0,
```
**데이터 변경**: 없음. **영향 범위**: `kpi`·`channel`·`funnel` 반환 키 + 프론트 라벨. `demo` 픽스처 정합.
**검증**: `leadBookingRate`·`customerBookingRate`가 별도 값. 어떤 전환율도 분모/분자 모집단이 일치. 카드 라벨에 단위 노출. 100% 초과 불가 회귀.

---

## B6 — 미귀속 매출 분리(정상 vs 귀속 실패 의심) (P0, 오탐 방지)

**대상**: `app/api/attribution/summary/route.ts:151-156` · `app/api/dashboard/channel/route.ts:116,128-129`

**현재**(직접 확인):
```ts
// channel:116 — 매칭 실패 결제를 'Unknown' 채널 매출로 집계
const channel = customerToChannel.get(payment.customer_id) || 'Unknown'
revenueByChannel[channel] += Number(payment.payment_amount)
// channel:128-129 — Unknown을 채널 결과에 포함(leads>0면 노출)
// attribution/summary:151-156 — 터치포인트 없는 매출을 'Unknown' 채널로 귀속
```
**문제**: `Unknown`이 **정상 성과 채널처럼** 집계됨(모집단 원칙 위반). 또한 광고 미귀속 매출 전체가 뭉뚱그려져, **정상 미귀속**(기존고객·윈도우 초과·코호트 이전)과 **귀속 실패 의심**(연결정보 있으나 누락/오류)이 구분 안 됨.

**개선 설계**(DIAGNOSIS §4.5):
- **`Unknown`을 채널 성과에서 제외**. 채널 표는 활성 광고 매체만(부록 A 화이트리스트; 정확 화이트리스트화는 B20). Phase 0 최소 조치 = `Unknown` 채널 row를 성과 목록에서 빼고, 그 금액을 **별도 버킷**으로 반환.
- 미귀속 매출을 두 필드로 분리 반환:
  - `normalUnattributedRevenue`(정상 미귀속): 귀속 규칙상 정상 제외(기존고객/윈도우 초과/코호트 이전). **오류 아님** — 표기만.
  - `suspectUnattributedRevenue`(귀속 실패 의심): 리드·예약·결제 연결정보는 있으나 미귀속. **DQ 경고·이상탐지 대상은 이것만.**
- Phase 0 근사 분류(신규 필드 없이): 결제 고객의 **광고 리드 존재 여부**로 1차 분류 — 광고 리드가 있는데 미귀속 = 의심, 광고 리드 자체가 없음 = 정상 미귀속(기존/오가닉·비광고). 정밀 분류(윈도우 초과 등)는 B18 이후.
```ts
// channel 개선(개념)
if (!customerToChannel.has(payment.customer_id)) {
  const hasAdLead = adLeadCustomerSet.has(payment.customer_id)
  if (hasAdLead) suspectUnattributed += amt   // 연결정보 有 → 의심
  else normalUnattributed += amt              // 광고 리드 無 → 정상 미귀속
  continue                                    // 채널 성과에 넣지 않음
}
```
**데이터 변경**: 없음(파생 분류). **영향 범위**: `attribution/summary`·`channel` 반환에 2개 버킷 추가, 프론트 채널 표에서 Unknown 제거 + "미귀속" 요약 카드. §2.2 이상탐지는 `suspectUnattributed`만 소비.
**검증**: 채널 표에 `Unknown` 미노출. 정상 미귀속(기존고객 결제)이 DQ 경고를 유발하지 않음. 의심 매출만 경고 대상. 운영 매출 = 마케팅 기여 + 정상 미귀속 + 의심(합계 정합).

---

## 전체 검증 체크리스트 (Phase 0 완료 기준)

- [ ] **B2**: agency_staff 병원 미선택 시 캠페인 목록에 타 병원 미노출; superadmin 전체 유지.
- [ ] **B3**: 동일 고객 상담 2회 추가 → 2행 보존, UI 타임라인 반영; 개별 수정 시 해당 행만. (B7 상태값 정합 동반 권장)
- [ ] **B4**: 라우트 500 강제 시 카드가 "0"이 아닌 에러/재시도; 정상 0건은 0으로 구분.
- [ ] **B1**: 1,000/5,000행 초과 시드에서 `kpi.operationalRevenue` == payments 실합계; **채널 매출 합 == KPI 매출**(모순 해소); 안정 정렬로 페이지 경계 누락 0.
- [ ] **B5**: 운영 매출/운영 ROAS와 (잠정)코호트 ROAS 분리 표시, 단위(%/배수)·"광고 성과 아님" 문구.
- [ ] **B28**: 리드 예약 전환율·고객 예약 전환율 별도, 분모/분자 모집단 일치, 100% 초과 불가, 단위 라벨.
- [ ] **B6**: 채널 표 Unknown 제거; 정상 미귀속 vs 귀속 실패 의심 분리; DQ 경고는 의심만.
- [ ] `npm run build`(타입) · `npm run lint` 통과.
- [ ] 반환 키 변경(B5·B28·B6) → `use-dashboard-data.ts`·소비 컴포넌트·`lib/demo/fixtures/*` 동기 수정 확인.
- [ ] `npm run test:e2e`(ads/dashboard 관련) 기존 통과 + 신규 케이스(테넌트 격리·에러 상태) 추가 검토.

## Phase 0 이후로 미루는 것(경계 명시)
- 정확 코호트 ROAS·Last Paid Touch·귀속 윈도우·환불 반영 → **Phase 3(B18·B19·B12)**. Phase 0의 코호트 ROAS·예약 기여 리드는 **"잠정·기간운영 근사"**로 라벨.
- 채널 화이트리스트 완전화·정규화 대소문자(`channel.ts:34`) → **B20(P2)**.
- DB-side 집계(RPC/뷰)로 `fetchAll` 대체 → 성능 최적화 후속.
- 상담 상태 화이트리스트 정합(B7)은 B3와 같은 PR 권장(도메인 회귀 일괄 검증).
