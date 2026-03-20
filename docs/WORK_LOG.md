# MMI 프로젝트 작업 로그

## 개요

shadcn/ui 기반 UI/UX 개선 및 기능 개발 작업 기록.
각 Phase별 상세 내용은 하위 파일 참조.

---

## 전체 요약

| 단계 | 기간 | 주요 작업 | 상태 | 상세 |
|------|------|----------|------|------|
| Phase 1: 초기 설정 | ~2026-03-14 | shadcn/ui, 접근성, 번들 최적화, 문서화 (Phase 1~9) | 완료 | [상세](work-log/phase1-setup.md) |
| Phase 2: 핵심 기능 | 2026-03-14~16 | KPI, UTM, 랜딩, 소재, 어드민 분리, 리드 필터 (P2~P12) | 완료 | [상세](work-log/phase2-features.md) |
| Phase 3: 운영 기능 | 2026-03-16~ | 캠페인, 알림, 상태관리, 예약 등록, UTM 개편 (P13~P17) | 완료 | [상세](work-log/phase3-operations.md) |
| Phase 4: 모니터링 + 역할 | 2026-03-16~ | 순위 모니터링, agency_staff 역할, 메뉴 권한 (P18) | 완료 | [상세](work-log/phase4-monitoring.md) |
| E2E 테스트 | 2026-03-16 | Playwright 106개 테스트 | 완료 | [상세](work-log/e2e-tests.md) |
| Phase 5: 대시보드 고도화 | 2026-03-17~18 | KPI 재구성, 오늘 요약, 듀얼 차트, 채널 바차트, 퍼널 분리 | 완료 | [상세](work-log/phase5-dashboard-overhaul.md) |
| Phase 6: 광고 성과 고도화 | 2026-03-19 | 소재 분석, 이상치 알림, CSV 내보내기, 주간 리포트, 멀티터치 어트리뷰션 | 완료 | [상세](work-log/phase6-ads-enhancement.md) |
| Phase 7: 병원별 API 키 관리 | 2026-03-19 | 매체별 API 키 CRUD, 연결 테스트, 암호화 저장, 동기화 리팩토링 | 완료 | [상세](plans/PLAN_clinic-api-configs.md) |
| Phase 8: 법적 페이지 + 앱 아이콘 | 2026-03-19 | 개인정보처리방침, 서비스약관 페이지, 앱 아이콘 생성, 로그인 푸터 링크 | 완료 | - |
| Phase 9: 광고 성과 재구성 | 2026-03-20 | /ads 페이지 3탭 구조, 4개 신규 API, 9개 신규 컴포넌트, 효율 기반 인사이트 | 완료 | - |
| Phase 10: 개선 + 버그 수정 | 2026-03-20 | 언론보도 기간 필터, 광고 날짜 버그 수정, 예약 유입 경로 표시 | 완료 | - |

---

## 최신 작업 (Phase 10: 언론보도 개선 + 광고 성과 버그 수정 + 예약 유입 경로)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P25-1 | 언론보도 기간 필터 | DateRangePicker 추가 (기본 90일), API에 from/to 날짜 파라미터 지원 (KST 기준) | 03-20 |
| P25-2 | 뉴스 검색 기간 제한 | Google News RSS에 `when:6m` 추가, 6개월 이상 오래된 기사 수집 차단 | 03-20 |
| P25-3 | 광고 성과 날짜 포맷 수정 | `stat_date`(YYYY-MM-DD)와 ISO 형식 비교로 모든 광고 데이터가 필터링되던 **치명적 버그** 수정. 페이지→API 날짜를 YYYY-MM-DD로 통일, timestamptz 비교 시 KST 타임존 명시. 영향 범위: ads/page, stats, efficiency-trend, platform-summary, day-analysis, landing-page-performance, dashboard/kpi, dashboard/funnel (8개 파일) | 03-20 |
| P25-4 | 예약 목록 유입 경로 표시 | API에 `leads(utm_source, utm_campaign)` 조인 추가, ChannelBadge + 캠페인명 컬럼 표시, `first_source` 폴백 | 03-20 |
| P25-5 | 단위 테스트 인프라 | Jest + next/jest 설정, 4개 테스트 파일(security/channel/utm/date), 53개 테스트 | 03-20 |
| P25-6 | Web Vitals 모니터링 | `useReportWebVitals` 기반 성능 측정, dev 콘솔 출력 + prod poor 등급 서버 로깅 | 03-20 |

---

## Phase 9 작업 (광고 성과 페이지 전면 재구성)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P24-1 | KPI API 확장 | `kpi/route.ts`에 clicks/impressions/cpc/ctr 추가, comparison에도 반영 | 03-20 |
| P24-2 | 효율 추이 API | `/api/ads/efficiency-trend` — 일별 CPL·CPC·CTR 시계열 데이터 | 03-20 |
| P24-3 | 매체별 비교 API | `/api/ads/platform-summary` — 채널별 spend/clicks/leads/revenue/ROAS 종합 | 03-20 |
| P24-4 | 요일별 분석 API | `/api/ads/day-analysis` — KST 요일별 리드·광고비·CPL | 03-20 |
| P24-5 | 랜딩페이지 성과 API | `/api/ads/landing-page-performance` — LP별 리드→결제 전환율·매출 | 03-20 |
| P24-6 | KPI 카드 8종 | CPL/CPC/CAC 역전 trend 로직, 전기 대비 변화율 표시 | 03-20 |
| P24-7 | 효율 추이 차트 | ComposedChart 이중 Y축 (₩/%), CPL Area + CPC/CTR Line | 03-20 |
| P24-8 | 매체별 성과 테이블 | 최저 CPL 하이라이트, ROAS 색상 분기, 인사이트 텍스트 | 03-20 |
| P24-9 | 광고 퍼널 | 노출→클릭→리드→예약→결제 5단계, 최대 이탈 구간 하이라이트 | 03-20 |
| P24-10 | 캠페인 순위 테이블 | 헤더 클릭 정렬, CPC 상태 표시(🟢🟡🔴), 검색/페이지네이션 | 03-20 |
| P24-11 | 요일별 바 차트 | 7칼럼 BarChart, 최다 리드 요일 강조, CPL 라벨 | 03-20 |
| P24-12 | 랜딩페이지 테이블 | LP별 전환율·매출, 활성/비활성 상태 표시 | 03-20 |
| P24-13 | 3탭 페이지 조립 | 성과 개요 / 캠페인 분석 / 매출 귀속, URL 파라미터 동기화, refreshKey 패턴 | 03-20 |

---

## Phase 8 작업 (법적 페이지 + 앱 아이콘)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P23-1 | 개인정보처리방침 | `/privacy` 공개 페이지 (9개 조항: 처리 목적, 수집 항목, 보유 기간, 안전성 확보 등) | 03-19 |
| P23-2 | 서비스 이용약관 | `/terms` 공개 페이지 (11개 조항 + 부칙: 정의, 서비스 제공, 계정 관리, 데이터 관리 등) | 03-19 |
| P23-3 | 앱 아이콘 | `app/icon.tsx` (1024x1024) + `app/apple-icon.tsx` (180x180), Edge Runtime, 브랜드 그라데이션 + Activity 아이콘 | 03-19 |
| P23-4 | 로그인 푸터 링크 | 로그인 페이지 하단에 개인정보처리방침·서비스약관 링크 추가 | 03-19 |

---

## Phase 7 작업 (병원별 API 키 관리)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P22-0 | 사전 확인 | Supabase 스키마 확인: clinic_api_configs 존재(ALTER TABLE), ad_campaign_stats UNIQUE 변경 안전 | 03-19 |
| P22-1 | DB + 암호화 | 마이그레이션 2개(컬럼 추가 + UNIQUE 변경) + AES-256-GCM 암호화 유틸 | 03-19 |
| P22-2 | 관리 API | 매체별 API 키 CRUD + Meta/Google/TikTok 연결 테스트 API | 03-19 |
| P22-3 | 관리 UI | ClinicApiConfigDialog (매체 탭, 토큰 마스킹, 연결 테스트, 활성화 토글) | 03-19 |
| P22-4 | 동기화 리팩토링 | adSyncManager 오케스트레이터, 서비스 options 패턴, Cron maxDuration 300, stats clinic_id 필터 | 03-19 |
| P22-5 | 연동 테스트 | 마이그레이션 실행, JSONB 이중 인코딩 버그 수정, Meta 토큰 저장/복호화 정상 확인 | 03-19 |

> 상세 구현 계획: [PLAN_clinic-api-configs.md](plans/PLAN_clinic-api-configs.md)
> 잔여: Meta 토큰 발급 이슈 (앱 연결/권한 재확인 필요, MMI 시스템 문제 아님)

---

## Phase 6 작업 (광고 성과 고도화)


| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P21-1 | 소재별 성과 API | utm_content 기반 소재별 리드/결제/전환율 집계 API | 03-19 |
| P21-2 | 소재별 성과 UI | 상위 5개 바차트 + 성과 테이블, /ads 페이지에 섹션 추가 | 03-19 |
| P21-3 | 이상치 알림 | CTR 급락/지출 급증 감지 → 관리자 SMS, sync-ads cron에 통합 | 03-19 |
| P21-4 | CSV 내보내기 | 퍼널단계/채널별 고객 CSV 다운로드, /leads 페이지에 버튼 추가 | 03-19 |
| P21-5 | 주간 리포트 집계 | 병원별 주간 성과(리드/예약/매출/광고) 집계 + SMS 요약 텍스트 | 03-19 |
| P21-6 | 주간 리포트 발송 | 매주 월요일 09:00 KST cron, notify_phones SMS 발송 | 03-19 |
| P21-7 | 멀티터치 어트리뷰션 | first/linear/time-decay 3종 모델, 매출 귀속 탭에 모델 선택 UI | 03-19 |

> 상세 구현 계획: [PLAN_phase6-ads-enhancement.md](plans/PLAN_phase6-ads-enhancement.md)

---

## Phase 5 작업 (대시보드 고도화)

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P20 | KST 타임존 전환 | 전체 프로젝트 시간 표기를 UTC → KST(Asia/Seoul) 기준으로 통일 | 03-18 |
| P19-1 | 공용 인프라 | 채널 색상 유틸, StatsCard 개선 | 03-17 |
| P19-2A | KPI API 개선 | 오늘 요약, comparison 확장, Trend 리드 추가 | 03-17 |
| P19-2B | 상단 섹션 컴포넌트 | TodaySummary, KpiSection, SpendLeadTrend | 03-17 |
| P19-2C | 하단 섹션 컴포넌트 | ChannelChart, TreatmentPie, FunnelSection | 03-17 |

> 상세 구현 계획: [PLAN_dashboard-overhaul.md](plans/PLAN_dashboard-overhaul.md)

---

## Phase 4 작업

| # | 작업 | 핵심 내용 | 날짜 |
|---|------|----------|------|
| P18 | 순위 모니터링 + agency_staff | DB 4테이블, agency_staff 역할, 메뉴 권한, 순위 CRUD, 월간 테이블+차트 | 03-16 |

## Phase 3 작업

| # | 작업 | 핵심 내용 | 커밋 | 날짜 |
|---|------|----------|------|------|
| P13 | 캠페인별 리드 뷰 | 캠페인 카드 목록 → 리드 상세, 설문 응답 인라인 표시 | 96f7166 | 03-16 |
| P14 | 담당자 SMS 알림 | 솔라피 SMS, 병원별 알림 설정, non-blocking 발송 | 2f51711 | 03-16 |
| P15 | 리드 상태/메모 | 6개 상태 관리, 예약완료 시 bookings 자동 생성, 메모 연동 | 83de85a | 03-16 |
| P16 | 예약 등록 | 예약/결제 페이지에서 직접 등록, 고객 자동 생성 | de204a4 | 03-16 |
| P17 | UTM 페이지 개편 | 목록 + 생성기 모드 분리 | 74760a9 | 03-16 |

---

## DB 마이그레이션 현황

| 파일 | 내용 | 실행 필요 |
|------|------|----------|
| `20240101_add_utm_fields.sql` | leads UTM 필드 추가 | ⚠️ |
| `20240315_utm_templates_links.sql` | utm_templates, utm_links 테이블 | ⚠️ |
| `20260315_landing_pages.sql` | landing_pages 테이블, leads 컬럼 추가 | ⚠️ |
| `20260315_ad_creatives.sql` | ad_creatives 테이블 | ⚠️ |
| `20260315_ad_creatives_utm.sql` | ad_creatives UTM 컬럼 추가 | ⚠️ |
| `20260316_clinic_notify.sql` | clinics 알림 컬럼 추가 | ⚠️ |
| `20260316_lead_status.sql` | leads 상태/타임스탬프 컬럼 추가 | ⚠️ |
| `20260316_lead_notes.sql` | leads 메모 컬럼 추가 | ⚠️ |
| `20260316_landing_pages_random_id.sql` | landing_pages ID 8자리 랜덤으로 변경 | ⚠️ |
| `20260316_leads_landing_page_on_delete.sql` | leads FK ON DELETE SET NULL 추가 | ⚠️ |
| `20260316_lead_raw_logs.sql` | 리드 원본 로그 테이블 (유실 방지) | ⚠️ |
| `20260316_clinic_notify_phones.sql` | 병원 알림 연락처 최대 3개 (TEXT[]) | ⚠️ |
| `20260316_sms_send_logs.sql` | SMS 발송 로그 테이블 | ⚠️ |
| `20260316_clinic_staff_activity.sql` | 활동 추적 컬럼 + activity_logs 테이블 | ⚠️ |
| `20260316_monitoring_agency.sql` | agency_staff 배정/권한 + 모니터링 키워드/순위 테이블 | ⚠️ |

---

## 향후 작업 (우선순위순)

### 완료

| 작업 | 핵심 내용 | 상태 |
|------|----------|------|
| 예약 페이지 유입 경로 | 채널/캠페인 컬럼 추가 | ✅ 완료 |
| 단위 테스트 | Jest 53개 테스트 (security, channel, utm, date) | ✅ 완료 |
| 성능 모니터링 | Web Vitals 측정 (dev: 콘솔, prod: poor만 로깅) | ✅ 완료 |

### 홀드 (외부 의존성)

| 작업 | 핵심 내용 | 홀드 사유 |
|------|----------|----------|
| 카카오톡 채널 연동 | 카카오톡 문의 → 리드 자동 수집 | 카카오 비즈니스 API 키/권한 미확보 |
| 네이버 예약 연동 | 네이버 예약 → 리드 자동 수집 | 네이버 공개 API 없음, 파트너 API 접근 권한 필요 |

### 예정

| 작업 | 핵심 내용 |
|------|----------|
| 코호트 분석 | 월별 가입자 리텐션 |
| 예측 모델 | LTV 예측, 이탈 예측 |
