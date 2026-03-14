# Phase 2: KPI 대시보드 실질화

## 현재 문제점

### channel API (`/api/dashboard/channel`)
```
현재: customers.first_source 기준으로 채널 집계
      → leads 테이블의 utm_source 무시
      → 정확한 리드 수 집계 불가

목표: leads.utm_source 기준으로 채널별 집계
      → 각 리드의 정확한 유입 채널 추적
```

### kpi API (`/api/dashboard/kpi`)
```
현재: 전체 합계만 계산
      → 채널별/캠페인별 비교 불가

목표: 채널별, 캠페인별 상세 KPI 제공
```

### 퍼널 분석
```
현재: 없음

목표: Lead → Booking → Visit → Payment 전환율 제공
```

---

## 작업 목록

### Task 1: channel API 수정
**파일**: `app/api/dashboard/channel/route.ts`

- leads.utm_source 기준으로 리드 집계
- 전화(phone), 기타(unknown) 채널 추가
- 정확한 CPL, ROAS 계산

### Task 2: 캠페인별 분석 API
**파일**: `app/api/dashboard/campaign/route.ts` (신규)

- leads.utm_campaign 기준 집계
- 캠페인별 리드수, CPL, ROAS

### Task 3: 퍼널 분석 API
**파일**: `app/api/dashboard/funnel/route.ts` (신규)

- 단계별 전환율 계산
- 채널별 퍼널 비교

### Task 4: 대시보드 UI 수정
**파일**: `app/(dashboard)/page.tsx`

- 퍼널 시각화 추가
- 채널별/캠페인별 탭 추가

---

## 구현 시작
