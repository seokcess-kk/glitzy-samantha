<!--
팀 공유 학습 시스템
이 파일은 Git으로 관리됩니다. 규칙 추가/수정 시 PR을 통해 팀원 리뷰를 받아주세요.
누군가 발견한 AI의 실수 패턴은 팀 전체가 공유하여 같은 실수를 반복하지 않도록 합니다.
-->
<!--
이 파일은 점진적으로 개선됩니다.
클로드가 실수하거나 의도와 다른 결과를 낼 때마다,
해당 케이스를 방지하는 규칙을 한 줄씩 추가해 주세요.
예: "API 응답 타입을 변경할 때 프론트엔드 타입도 반드시 함께 수정할 것"
-->

# Samantha — Medical Marketing Intelligence

병원 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드. 슈퍼어드민이 여러 병원 고객사를 통합 관리.

**서비스명**: Samantha (브랜드 가이드: [docs/BRAND.md](docs/BRAND.md))
**기술 스택**: Next.js 14 (App Router) · NextAuth.js (JWT) · Supabase (PostgreSQL) · Tailwind + shadcn/ui · Recharts · Sonner · Upstash QStash
**컬러 시스템**: Blue 기반 (`brand-500: #3b82f6`, `brand-600: #2563eb`) — 다크모드 기본

## 빌드 & 실행

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (:3000)
npm run build        # 프로덕션 빌드 (타입 체크 포함)
npm run lint         # ESLint
npm run test:e2e     # Playwright E2E 테스트
npm run analyze      # 번들 크기 분석
```

## 디렉토리 구조

| 디렉토리 | 용도 | 하위 규칙 |
|---------|------|----------|
| `app/(dashboard)/` | 인증된 대시보드 페이지 (그룹 라우트) | |
| `app/privacy/`, `app/terms/` | 공개 페이지 (개인정보처리방침, 서비스약관) | |
| `app/icon.tsx`, `app/apple-icon.tsx` | 앱 아이콘 (Next.js ImageResponse, Edge Runtime) | |
| `app/api/` | REST API 라우트 | `app/api/CLAUDE.md` |
| `lib/` | 핵심 유틸리티 (auth, security, logger 등) | `lib/CLAUDE.md` |
| `lib/services/` | 외부 API 동기화 서비스 | |
| `components/` | UI 컴포넌트 | `components/CLAUDE.md` |
| `components/ads/` | 광고 성과 UI (KPI카드, 효율추이, 매체비교, 퍼널, 캠페인, 소재별 성과, 요일, LP) | |
| `components/attribution/` | 매출 기여 분석 UI (전환 퍼널, 채널 매출 도넛, ROAS 추이, LP 전환 테이블, 고객 여정) | |
| `components/medichecker/` | 원고 검수 UI (텍스트 입력, 위반 하이라이트, 진행 표시, 이력) | |
| `components/erp-documents/` | ERP 문서 UI (견적서/계산서 목록, Sheet 상세) |
| `app/api/admin/backfill-ads/` | 광고 데이터 backfill (CRON_SECRET 인증, 최대 90일) | |
| `lib/medichecker/` | 의료광고 검증 도메인 서비스 (7단계 AI 파이프라인, RAG, 온톨로지) | |
| `data/medichecker-seed/` | 의료광고법 시드 데이터 (법조문 15건, 시술 50건, 관계, 청크) | |
| `supabase/migrations/` | DB 마이그레이션 (`YYYYMMDD_설명.sql`) | |
| `e2e/` | Playwright E2E 테스트 | |

## 도메인 용어

| 용어 | 정의 | 혼동 주의 |
|------|------|-----------|
| `Clinic` | 병원 고객사 (테넌트 단위). `clinics` 테이블 | `User`(시스템 사용자)와 구분 |
| `User` | 시스템 로그인 계정. 역할별 4종 | `Customer`와 구분 — User만 로그인 가능 |
| `Customer` | 환자/고객. `phone_number`로 식별 | 시스템 로그인 불가. CDP에서 관리 |
| `Lead` | 리드/문의. UTM + 랜딩페이지 추적 | `Customer`와 1:N. 유입 시점 데이터 |
| `Booking` | 예약. `created_by`/`updated_by` 추적 | `Consultation`과 구분 — Booking은 일정, Consultation은 상담 기록 |
| `Consultation` | 상담 기록. 예약 이후 실제 상담 내용 | `Booking`의 후속 단계 |
| `Payment` | 결제. `created_by` 추적 | Booking/Consultation과 별도 테이블 |
| `Campaign` | 광고 캠페인 (Meta/Google/Naver 플랫폼 레벨) | |
| `AdSet`/`AdGroup` | 캠페인 하위 타겟팅 그룹 | Meta=AdSet, Google=AdGroup |
| `LandingPage` | 리드 수집 랜딩페이지. 8자리 랜덤 ID | `landing_pages` 테이블 |
| `UTM` | 유입 추적 파라미터 (source/medium/campaign/term/content) | `lib/utm.ts`로 파싱/검증 |
| `CDP` | Customer Data Platform. 고객 통합 프로필 | 환자 관리 페이지의 내부 명칭 |
| `KPI` | 핵심 성과 지표. 대시보드 상단 요약 카드 | clinic_staff는 접근 차단 |
| `MediChecker` | 의료광고법 제56조 기반 AI 위반 검증 도구 | 7단계 파이프라인: 키워드→분류→RAG→온톨로지→판단→검증 |
| `Verification` | 광고 텍스트 검증 1건. `mc_verification_logs` 테이블 | SSE 스트리밍으로 진행 상황 전달 |
| `superadmin` | 전체 병원 접근. `?clinic_id=X`로 조회 | |
| `agency_staff` | 다중 병원 배정. 메뉴 권한 제한 | superadmin과 달리 배정된 병원만 |
| `clinic_admin` | 자기 병원 전체 데이터 + 담당자 관리 | |
| `clinic_staff` | 예약/결제/고객/리드/언론보도만. 광고/KPI 차단 | |

## 코딩 규칙

### 필수 (위반 시 버그/보안 이슈)
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `clinic_id` 필터. INSERT 시 `clinic_id` 포함. 예외 없음
2. **역할 검증**: API → `withSuperAdmin`/`withClinicAdmin`/`withClinicFilter` 래퍼. 페이지 → `useEffect` 역할 가드
3. **보안**: 사용자 입력 → `sanitizeString()`. ID → `parseId()`. 상태값 → 화이트리스트 검증
4. **활동 추적**: bookings/payments/consultations/leads 변경 시 `created_by`/`updated_by` + `logActivity()`
5. **삭제 보관**: 데이터 삭제 시 `archiveBeforeDelete()` 호출하여 `deleted_records`에 스냅샷 보관
6. **인증 타입**: `types/next-auth.d.ts` 수정 시 `password_version` 필드 반드시 유지
7. **KST 타임존 일관성**: 모든 날짜/시간은 KST(Asia/Seoul) 기준으로 변환·저장·표시. 아래 규칙 필수 준수 (상세: `lib/CLAUDE.md` > KST 타임존 규칙)

### 네이밍 컨벤션
- 파일명: `kebab-case` (예: `date-range-picker.tsx`, `api-middleware.ts`)
- 컴포넌트: `PascalCase` (예: `DateRangePicker`, `StatsCard`)
- 함수/변수: `camelCase` (예: `getClinicId`, `assignedClinicIds`)
- DB 테이블/컬럼: `snake_case` (예: `clinic_api_configs`, `created_by`)
- API 라우트 폴더: `kebab-case` (예: `app/api/landing-pages/`)
- 환경변수: `UPPER_SNAKE_CASE` (예: `SUPABASE_SERVICE_ROLE_KEY`)

### 파일/폴더 구조 규칙
- 새 대시보드 페이지: `app/(dashboard)/페이지명/page.tsx`
- 페이지별 브라우저 탭 제목: `app/(dashboard)/페이지명/layout.tsx` (thin server 래퍼로 `metadata.title` 설정 — `'use client'` 페이지에서 metadata export 불가하므로)
- 새 API 라우트: `app/api/리소스명/route.ts` (CRUD), `app/api/리소스명/[id]/route.ts` (개별)
- 새 공용 컴포넌트: `components/common/컴포넌트명.tsx` → `components/common/index.ts`에 re-export
- 페이지 전용 컴포넌트: `components/페이지명/컴포넌트명.tsx`
- 새 유틸리티: `lib/모듈명.ts`. 한 파일 200줄 초과 시 분리 검토

### 선호 패턴
- 토스트: `import { toast } from 'sonner'` → `toast.success()`, `toast.error()`
- 로깅: `createLogger('ServiceName')` → `logger.info/warn/error`
- 외부 API: `fetchJSON<T>(url, { service, timeout, retries })`
- 날짜: `lib/date.ts` 함수 사용 (`formatDate`, `formatDateTime`, `getKstDateString`)
- 채널 정규화: `normalizeChannel()` 사용, 차트 색상은 `getChannelColor()`

### 금지 패턴
- `console.log` 직접 사용 → `createLogger` 사용
- DB 쿼리에서 `clinic_id` 필터 누락
- `any` 타입 남용 — 불가피 시 주석으로 사유 명시
- `items-stretch`로 카드 높이 억지 정렬 (하단 빈 여백 발생)
- `NextResponse.json()` 직접 사용 → `apiSuccess`/`apiError` 사용
- URL 값에 `sanitizeString()` 사용 (`&` 제거됨) → `sanitizeUrl()` 사용
- **타임존 금지 패턴** (위반 시 날짜가 하루 밀림):
  - `toISOString().split('T')[0]` — UTC 날짜 추출 → `getKstDateString()` 사용
  - `toISOString().slice(0, 7)` — UTC 월 추출 → `getKstDateString(toUtcDate()).slice(0, 7)` 사용
  - `split('T')[0]` 으로 쿼리 파라미터에서 날짜 추출 — `getKstDateString(new Date(param))` 사용
  - `new Date('YYYY-MM-DD' + 'T00:00:00')` — 타임존 없음 → `'T00:00:00+09:00'` 명시
  - `toLocaleDateString()` 에서 `timeZone` 생략 — 반드시 `{ timeZone: 'Asia/Seoul' }` 지정

## 검증 규칙 (Self-Verification)

코드 변경 후 반드시 아래 순서로 검증. **에러 발생 시 직접 원인을 분석하고 수정한 뒤 재검증. 사용자에게 에러만 보고하지 말 것.**

### 항상 실행 (모든 변경)
1. **전체 맥락 코드 리뷰**: 구현한 코드만 단독 검토하지 말 것. 반드시 아래 관점에서 프로젝트 전체 맥락과의 정합성을 확인:
   - **호출자/피호출자 추적**: 변경한 함수/API를 호출하는 곳, 변경한 함수가 호출하는 곳 모두 확인. 시그니처·반환 타입·에러 처리가 일관되는지 검증
   - **데이터 흐름 추적**: DB → API → 프론트 전체 파이프라인에서 타입·필드명·변환 로직이 일관되는지 확인. 한 레이어만 바꾸고 나머지를 누락하지 않기
   - **역할별 접근 경로**: superadmin/agency_staff/clinic_admin/clinic_staff 각 역할이 해당 기능에 접근할 때 정상 동작하는지 확인
   - **기존 패턴과의 일관성**: 같은 도메인의 기존 코드(예: 다른 API 라우트, 유사 컴포넌트)와 패턴·네이밍·에러 처리 방식이 일치하는지 확인
   - **에러/엣지 케이스 경로**: 정상 경로뿐 아니라 데이터 없음, 권한 없음, 잘못된 입력 등 비정상 경로도 전체 흐름에서 검증
2. **빌드**: `npm run build` — 타입 에러, import 누락 검출. 실패 시 에러 파일 직접 수정 후 재빌드
3. **린트**: `npm run lint` — ESLint 경고/에러 수정
4. **영향 범위**: API 타입 변경 → 프론트도 수정. DB 스키마 변경 → `supabase/migrations/` 생성. `lib/` 변경 → 호출처 확인

### DB 쿼리 변경 시 추가
5. 새 쿼리에 `clinic_id` 필터 존재 확인
6. `applyClinicFilter()` 사용 + `assignedClinicIds` 처리 확인

### UI 변경 시 추가
7. **기획/검토**: UI를 새로 만들거나 대폭 변경할 때, `.claude/skills/ui-ux-pro-max/SKILL.md` 스킬을 활용하여 디자인 시스템(스타일, 컬러, 타이포, 레이아웃 패턴)을 기획·검토할 것. 구현 전 설계 단계와 구현 후 품질 검토 모두에 활용
8. `npm run dev` 실행 후 브라우저에서 직접 확인:
   - [ ] 같은 행 카드 높이 균일한가?
   - [ ] 차트 범례 5~6개 이내인가?
   - [ ] 모바일 뷰포트(375px)에서 깨지지 않는가?
   - [ ] 다크 테마에서 텍스트/배경 대비 정상인가?

### 주요 기능 변경 시 추가
9. **E2E 테스트**: `npm run test:e2e` — 기존 테스트 통과 확인. 새 기능이면 `e2e/` 테스트 추가 검토
   - 인증 상태: `storageState` (`.auth/superadmin.json`)
   - 특정 파일만: `npx playwright test e2e/tests/auth.spec.ts`
   - 구조: `e2e/fixtures/` (인증), `e2e/pages/` (POM), `e2e/tests/` (스펙)

### 반복 수정 루프 (핵심)
**검증은 코드 구현이 끝날 때마다 매번 실행한다.** 한 번에 통과하지 않으면 아래 루프를 에러가 0건이 될 때까지 반복:
```
구현 → 전체 맥락 코드 리뷰 → 불일치? → 수정 → 리뷰 → ... → 통과
                                                              ↓
                                                        build → 에러? → 수정 → build → ... → 통과
                                                                                              ↓
                                                                                        lint → 에러? → 수정 → lint → ... → 통과
                                                                                                                              ↓
                                                                                                                        2차 코드 리뷰 → 이슈? → 수정 → 빌드 → ... → 이슈 0건까지 반복
                                                                                                                                                                              ↓
                                                                                                                                                                        문서 업데이트
```
- 빌드/린트 에러가 남아 있는 상태로 사용자에게 결과를 보고하지 말 것
- "에러가 있지만 이렇게 수정하면 됩니다" 식의 안내 금지 — 직접 수정 후 재검증 완료한 뒤 결과 보고
- 3회 이상 같은 에러가 반복되면 접근 방식을 재검토할 것 (같은 수정을 반복하지 않기)
- **코드 리뷰는 수정사항이 0건이 될 때까지 반복**한다 (1차 빌드/린트 통과 후에도 데이터 흐름·타입·RPC 시그니처 등 런타임 이슈를 잡기 위해 반드시 추가 리뷰 실행)

### 문서 업데이트 (필수 — 코드 리뷰 완료 후)
**모든 기능 구현이 완료되고 코드 리뷰 이슈가 0건이 된 후, 반드시 관련 문서를 업데이트한다.** 문서 업데이트 없이 작업 완료를 보고하지 말 것.

| 변경 유형 | 업데이트 대상 문서 |
|-----------|-------------------|
| 새 페이지/기능 추가 | `CLAUDE.md` (디렉토리 구조, 도메인 용어, 변경 이력), `docs/WORK_LOG.md` (Phase/작업 항목) |
| 새 API 엔드포인트 | `docs/API.md` (엔드포인트 스펙, 요청/응답 예시) |
| 새 컴포넌트 | `docs/COMPONENTS.md` (디렉토리 구조, 사용법 예시) |
| 새 DB 테이블/마이그레이션 | `lib/CLAUDE.md` (DB 핵심 테이블), `docs/WORK_LOG.md` (마이그레이션 현황) |
| 새 유틸리티/서비스 | `lib/CLAUDE.md` (유틸리티 모듈 요약) |
| 환경변수 추가 | `lib/CLAUDE.md` (환경변수 섹션) |
| 참조 문서 신규 생성 | `CLAUDE.md` (참조 문서 테이블) |

## 환경 분리

| 브랜치 | 용도 | Vercel |
|--------|------|--------|
| `main` | 프로덕션 | Production |
| `develop` | 개발/스테이징 | Preview |
| `feature/*` | 기능 개발 | Preview (PR) |

`instrumentation.ts`에서 서버 시작 시 `lib/env.ts`의 `validateEnv()`를 호출하여 필수 환경변수 검증. 프로덕션 누락 시 서버 시작 실패.

## Cron Jobs

| 경로 | 스케줄 | 용도 |
|------|--------|------|
| `/api/cron/sync-ads` | 매일 03:00 | 광고 데이터 동기화 |
| `/api/cron/sync-press` | 매일 00:00 | 언론보도 동기화 |
| `/api/cron/weekly-report` | 매주 월 09:00 KST | 병원별 주간 성과 리포트 SMS 발송 |

## 참조 문서

| 문서 | 내용 |
|------|------|
| [docs/SPEC.md](docs/SPEC.md) | 프로젝트 요구사항 명세 |
| [docs/API.md](docs/API.md) | REST API 엔드포인트 상세 |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI 컴포넌트 사용 가이드 |
| [docs/BRAND.md](docs/BRAND.md) | Samantha 브랜드 가이드 (컬러, 타이포, 심볼) |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 인덱스 |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | glitzy-web ERP 연동 가이드 (견적서/계산서) |
| [docs/MEDICHECKER.md](docs/MEDICHECKER.md) | MediChecker 의료광고 검증 모듈 가이드 |
| `app/api/CLAUDE.md` | API 라우트 작성 규칙 |
| `components/CLAUDE.md` | UI 컴포넌트/레이아웃 규칙 |
| `lib/CLAUDE.md` | 인증 흐름, 환경변수, DB 스키마 요약 |
| `.claude/skills/ads-sync-guidelines.md` | 광고 동기화 가이드라인 |
| `.claude/skills/multitenant-guidelines.md` | 멀티테넌트 가이드라인 |
| `.claude/skills/security-guidelines.md` | 보안 가이드라인 |
| `.claude/skills/supabase-guidelines.md` | Supabase 사용 가이드라인 |
| `.claude/skills/nextjs-guidelines.md` | Next.js 규칙 |
| `.claude/skills/paid-ads/SKILL.md` | 유료 광고 캠페인 가이드 |
| `.claude/skills/ui-ux-pro-max/SKILL.md` | UI/UX 디자인 가이드 |

## 변경 이력

규칙 추가/수정 시 날짜와 사유를 기록. 불필요해진 규칙은 삭제하되 이력에 사유 남길 것.

| 날짜 | 내용 |
|------|------|
| 2026-03-19 | CLAUDE.md 재설계: 모듈 분리, 검증 루프, 도메인 용어, 네이밍 컨벤션, 팀 가이드 추가 |
| 2026-03-19 | 원격 변경 병합: ClinicContext, archive, error-alert, channel, date 유틸, deleted_records, E2E 상세 |
| 2026-03-19 | 검증 규칙에 '전체 맥락 코드 리뷰' 단계 추가 — 구현부만 단독 검토하지 않고 호출자/데이터 흐름/역할별/기존 패턴과의 정합성까지 확인 |
| 2026-03-19 | 디렉토리 구조에 공개 페이지(privacy, terms), 앱 아이콘(icon.tsx, apple-icon.tsx) 추가 |
| 2026-03-20 | 디렉토리 구조에 `components/ads/` 추가 — 광고 성과 페이지 3탭 구조 재구성 (4개 신규 API, 9개 신규 컴포넌트) |
| 2026-03-20 | 언론보도 다중 키워드 지원: `press_keywords` 테이블, 키워드 CRUD API, pressSync 다중 키워드 검색, clinic_staff 언론보도 접근 허용 |
| 2026-03-20 | 순위 모니터링 키워드 삭제 기능 추가 (DELETE API + AlertDialog UI) |
| 2026-03-20 | 언론보도 DateRangePicker 추가, Google News 검색 기간 제한(6개월) |
| 2026-03-20 | 광고 성과 날짜 포맷 불일치 수정: ISO→YYYY-MM-DD 통일, timestamptz KST 명시 (8개 API 파일) |
| 2026-03-23 | 예약/결제 관리 필터·정렬 추가: DateRangePicker, 상태/유입경로/결제 필터, SortSelect 공용 컴포넌트(`components/common/sort-select.tsx`) |
| 2026-03-23 | 캠페인 리드 필터·페이지네이션: 목록/상세 검색·채널·정렬, DateRangePicker, 50건 페이지네이션, `normalizeChannel` 재사용(`lib/channel.ts`) |
| 2026-03-23 | UI/UX 감사 P0~P3: `prefers-reduced-motion`, StatsCard/퍼널/상태배지 키보드 접근성, 하드코딩 hex→COLORS 상수, `text-[10px]`→`text-xs` 상향, `navLinkClass()` 추출, Firefox 스크롤바, transition `duration-200` 통일, `as any` 제거 |
| 2026-03-23 | 페이지별 브라우저 탭 제목: thin server layout.tsx 래퍼 패턴 (18개 페이지), `metadata.title.template` 설정 |
| 2026-03-23 | Samantha 브랜드: 서비스명 확정, 컬러 마이그레이션 Indigo→Blue (15개 파일), `docs/BRAND.md` 생성 |
| 2026-03-23 | agency_staff 메뉴 권한에 키워드 관리 항목 추가 |
| 2026-03-24 | glitzy-web ERP 연동 가이드 문서 추가 (`docs/INTEGRATION.md`): 견적서/계산서 읽기 전용 연동 설계 |
| 2026-03-24 | MediChecker 통합: 의료광고법 제56조 AI 검증 기능 (7단계 파이프라인, 5 DB 테이블, 3 API, 8 컴포넌트, 사이드바 메뉴) |
| 2026-03-24 | MediChecker UI/UX 감사: 2컬럼 레이아웃, 심각도 그룹핑, 컴팩트 카드, A11y 13건 수정, getRiskLevel 유틸 추출 |
| 2026-03-24 | 검증 규칙에 '문서 업데이트 필수' 단계 추가 — 코드 리뷰 완료 후 관련 문서(CLAUDE.md, API.md, COMPONENTS.md 등) 반드시 업데이트 |
| 2026-03-24 | MediChecker Phase 2: logActivity 연동 + 이력 상세 보기 |
| 2026-03-24 | MediChecker Phase 3: agency_staff 메뉴 권한에 `medichecker` 항목 추가 (MENU_OPTIONS) |
| 2026-03-24 | ERP 연동: glitzy-web 견적서/계산서 읽기 전용 프록시 (erpClient, API 2개, UI 2컴포넌트, Sheet 상세) |
| 2026-03-24 | ERP Phase 2: 견적서 승인/반려 (PATCH API, erpClient method/body 확장, Sheet 내 승인/반려 버튼, 반려 사유 다이얼로그) |
| 2026-03-24 | fix: 대시보드 퍼널 API `applyDateFilter` 날짜 이중 타임존 버그 수정 (전 단계 0명 표시) |
| 2026-03-26 | 광고 backfill API (`/api/admin/backfill-ads`): 특정 병원의 과거 광고 데이터 일괄 수집 (최대 90일, CRON_SECRET 인증) |
| 2026-03-26 | `sanitizeUrl()` 도입: URL용 sanitize 함수 추가 (`&` 보존, 위험 스킴 차단). `sanitizeString`이 URL의 `&`를 제거하여 CAPI event_source_url/DB inflow_url 깨지는 버그 수정 (6곳 교체) |
| 2026-03-26 | Ad 레벨 수집: `ad_stats` 테이블, `fetchMetaAdStats()` (페이지네이션+url_tags/effective_link→utm_content), 소재별 성과에 광고 지표(지출/노출/클릭/CPC/CTR/CPL) 통합, 캠페인 CPL ad_stats 경유 매칭 |
| 2026-03-26 | StatsCard 동적 폰트 크기: 값 길이에 따라 폰트 자동 축소 (`getValueSizeClass`), `truncate` 제거 → `break-all` 적용. 좁은 카드에서 금액 잘림 방지 |
| 2026-03-26 | DateRangePicker 개선: 시작일/종료일 명시 표시, 팝오버 상단 선택 상태, "이번 달" 프리셋, 캘린더 2개월 표시. 광고 성과 기본값 이번 달로 변경 |
| 2026-03-26 | fix: 캠페인 CPL + 소재별 광고 지표 — inflow_url utm_id 기반 매칭 (ads_read 권한 불필요), 날짜 표시 "최근 N일" → "M.D ~ M.D" 통일 |
| 2026-03-26 | 전체 프로젝트 감수 및 수정: (1) GAQL 쿼리 파라미터 인젝션 방어 (googleAds.ts), (2) `session?.user as any` 제거 14개 페이지, (3) 대시보드 API 인라인 `applyFilter` → 중앙 `applyClinicFilter`/`applyDateRange` 교체 6개 파일, (4) Recharts 툴팁 `any` → `ChartTooltipProps` 타입 적용 9개 컴포넌트 (`types/recharts.d.ts` 신규), (5) API try-catch 래핑 6개 파일, (6) `NextResponse.json` → `apiSuccess` 7개 API, (7) 차트 컬러 중앙화 `lib/chart-colors.ts` 신규 + 9개 컴포넌트 교체, (8) 다크모드 `--overlay` CSS 변수 도입 + 5개 UI 컴포넌트 적용, (9) 정렬 테이블 aria-sort/키보드 접근성 2개 컴포넌트, (10) 터치 타겟 44px 확대 3개 컴포넌트, (11) console.log → createLogger 1건, toISOString → getKstDateString 2건 |
| 2026-03-27 | 순위 모니터링 "함께많이찾는" 카테고리 추가: DB CHECK 제약조건 확장(`related`), API validCategories, UI 3개 페이지 CATEGORY_LABELS/LIST 업데이트 |
| 2026-03-30 | fix: 전체 프로젝트 KST 타임존 일관성 감사 및 수정 — (1) KPI API `split('T')[0]` UTC→KST 오변환 (`getKstDateString` 교체), (2) 콘텐츠 분석 `toISOString().slice(0,7)` UTC 월 오류 (`getKstDateString(toUtcDate())` 교체), (3) 순위입력 날짜 이동 타임존 미지정 (`+09:00` 추가), (4) stat_date `split('T')[0]` → `slice(0,10)` 정리 (2곳), (5) E2E 헬퍼 `toISOString()` → KST 변환. `toISOString().split('T')[0]` 패턴 프로젝트에서 완전 제거 |
| 2026-03-30 | TikTok Ads API 연동: (1) `data_level` 필수 파라미터 추가, (2) `fetchTikTokAdStats` ad 레벨 수집 신규 (ad_stats 저장), (3) 캠페인+ad 레벨 페이지네이션 공통 헬퍼 `fetchTikTokReport`, (4) adSyncManager Meta 동일 병렬 수집 구조, (5) 소재별 성과 API에 utm_content 없는 ad_stats(TikTok) ad_id 기준 표시, (6) 90일 backfill 완료 (clinic_id=20) |
| 2026-03-30 | 대시보드 재설계: (1) 기본 날짜 "오늘"→"이번 달", (2) KPI 6카드→5카드(광고비/리드+오늘/CPL/매출/ROAS), (3) 퍼널 5단계→3단계(리드→예약→결제)+인사이트, (4) TodaySummary/ChannelChart/CplRoasChart 제거, (5) RecentLeads 최근 8건 피드 신규, (6) ChannelTable 정렬 가능 테이블 신규(clicks/impressions/ctr 추가), (7) 채널 API에 clicks/impressions/ctr 필드 추가 |
| 2026-03-30 | 시스템 메뉴 토글: `system_settings` 테이블, 슈퍼어드민 설정 페이지(`/admin/settings`), 사이드바 동적 숨김 메뉴 로드. 하드코딩 `hidden` 플래그 → DB 기반 동적 제어로 전환 |
| 2026-03-30 | 광고 성과 3탭 지표 재배치: (1) 성과 개요: KPI 8→5카드(ROAS/전환율/CAC→매출귀속), 매체비교에 노출/클릭 추가+ROAS/전환율 제거, 퍼널 5→3단계(2-Zone+미니카드), LP분석→캠페인탭 이동, 💡emoji→Lightbulb SVG (2) 캠페인분석: LP분석 추가(mode prop delivery/full), 소재별 13→10컬럼(결제/전환율/매출 제거), StatusDot emoji→CSS도트, LP 1개 조건부 레이아웃 (3) 매출귀속: KPI 3→6카드(ROAS/전환율/CAC 추가), 전환퍼널(리드→예약→결제) 신규, 채널별 매출비중 도넛 신규, ROAS 추이 라인차트 신규(`/api/attribution/roas-trend`), LP 전환 테이블 신규 |
| 2026-03-30 | 외부 API: `GET /api/external/ad-spend` — 병원별 월간 광고 실집행비(매체별) + SMS 발송 건수. `withExternalAuth` 미들웨어 신규 (`EXTERNAL_SERVICE_KEY` Bearer 인증). glitzy-web 결산용 |
| 2026-03-30 | 광고 성과 UI 개선: (1) 퍼널 수평바→수직 스텝 카드 + 요일별 분석과 2컬럼 배치, flex 높이 밸런스 (2) 소재별 성과 기본 정렬 리드 내림차순, 10건 페이지네이션 + "전체 N건 보기" (3) 캠페인 행 클릭→소재 필터링 (API에 campaign_ids 추가, 클라이언트 필터) (4) LP 섹션 간 mt-6 여백 추가 |
