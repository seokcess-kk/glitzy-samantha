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

# MMI (Medical Marketing Intelligence)

병원 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드. 슈퍼어드민이 여러 병원 고객사를 통합 관리.

**기술 스택**: Next.js 14 (App Router) · NextAuth.js (JWT) · Supabase (PostgreSQL) · Tailwind + shadcn/ui · Recharts · Sonner · Upstash QStash

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
| `components/ads/` | 광고 성과 UI (KPI카드, 효율추이, 매체비교, 퍼널, 캠페인, 요일, LP) | |
| `components/attribution/` | 매출 기여 분석 UI (퍼널, CPL/ROAS, 고객 여정) | |
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
| `superadmin` | 전체 병원 접근. `?clinic_id=X`로 조회 | |
| `agency_staff` | 다중 병원 배정. 메뉴 권한 제한 | superadmin과 달리 배정된 병원만 |
| `clinic_admin` | 자기 병원 전체 데이터 + 담당자 관리 | |
| `clinic_staff` | 예약/결제/고객/리드만. 광고/KPI 차단 | |

## 코딩 규칙

### 필수 (위반 시 버그/보안 이슈)
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `clinic_id` 필터. INSERT 시 `clinic_id` 포함. 예외 없음
2. **역할 검증**: API → `withSuperAdmin`/`withClinicAdmin`/`withClinicFilter` 래퍼. 페이지 → `useEffect` 역할 가드
3. **보안**: 사용자 입력 → `sanitizeString()`. ID → `parseId()`. 상태값 → 화이트리스트 검증
4. **활동 추적**: bookings/payments/consultations/leads 변경 시 `created_by`/`updated_by` + `logActivity()`
5. **삭제 보관**: 데이터 삭제 시 `archiveBeforeDelete()` 호출하여 `deleted_records`에 스냅샷 보관
6. **인증 타입**: `types/next-auth.d.ts` 수정 시 `password_version` 필드 반드시 유지
7. **KST 타임존**: 날짜 표시는 `lib/date.ts` 포맷 함수 사용. `toISOString().split('T')[0]` 금지 (UTC 기준이라 KST 자정~09시 날짜 오류)

### 네이밍 컨벤션
- 파일명: `kebab-case` (예: `date-range-picker.tsx`, `api-middleware.ts`)
- 컴포넌트: `PascalCase` (예: `DateRangePicker`, `StatsCard`)
- 함수/변수: `camelCase` (예: `getClinicId`, `assignedClinicIds`)
- DB 테이블/컬럼: `snake_case` (예: `clinic_api_configs`, `created_by`)
- API 라우트 폴더: `kebab-case` (예: `app/api/landing-pages/`)
- 환경변수: `UPPER_SNAKE_CASE` (예: `SUPABASE_SERVICE_ROLE_KEY`)

### 파일/폴더 구조 규칙
- 새 대시보드 페이지: `app/(dashboard)/페이지명/page.tsx`
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
- `toISOString().split('T')[0]` → `getKstDateString()` 사용

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
```
- 빌드/린트 에러가 남아 있는 상태로 사용자에게 결과를 보고하지 말 것
- "에러가 있지만 이렇게 수정하면 됩니다" 식의 안내 금지 — 직접 수정 후 재검증 완료한 뒤 결과 보고
- 3회 이상 같은 에러가 반복되면 접근 방식을 재검토할 것 (같은 수정을 반복하지 않기)

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
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 인덱스 |
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
