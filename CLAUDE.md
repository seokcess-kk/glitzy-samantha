# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MMI(Medical Marketing Intelligence) - 병원 마케팅 인텔리전스 멀티테넌트 SaaS 대시보드.
슈퍼어드민이 여러 병원 고객사를 통합 관리하고, 병원별 독립된 데이터/계정/광고 API를 운영.

## 개발 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
npm run start    # 프로덕션 서버 실행
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **인증**: NextAuth.js (Credentials Provider, JWT 전략)
- **데이터베이스**: Supabase (PostgreSQL)
- **스타일링**: Tailwind CSS
- **차트**: Recharts

## 아키텍처

### 멀티테넌트 구조
```
슈퍼어드민 (Glitzy)
├── 병원 A (clinic_id: 1) ← 병원A 어드민, 광고 API 키, 고객/리드/예약/결제 데이터
├── 병원 B (clinic_id: 2)
└── 병원 C (clinic_id: 3)
```

### 역할 기반 접근
| 역할 | 권한 |
|------|------|
| `superadmin` | 전체 병원 접근, 병원/계정 관리, `?clinic_id=X`로 특정 병원 조회 |
| `clinic_admin` | 자신의 clinic_id 데이터만 접근 |

### 데이터 흐름
```
외부 API (Google/Meta/TikTok/YouTube/Instagram)
    ↓ lib/services/* (동기화 함수)
    ↓ app/api/*/route.ts (API 엔드포인트)
    ↓ Supabase Database
    ↓ app/(dashboard)/*/page.tsx (프론트엔드)
```

### 주요 디렉토리
- `app/(dashboard)/` - 인증된 대시보드 페이지들 (그룹 라우트)
- `app/api/` - API 라우트
- `lib/services/` - 외부 API 동기화 서비스
- `lib/api-middleware.ts` - API 래퍼 함수 (withAuth, withClinicFilter, withSuperAdmin)
- `lib/security.ts` - 입력 검증 및 권한 검증 헬퍼
- `lib/session.ts` - 세션 헬퍼 (getClinicId, requireSuperAdmin)
- `components/ClinicContext.tsx` - 병원 선택 상태 Context

## API 개발 패턴

### 미들웨어 래퍼 사용
```typescript
// lib/api-middleware.ts의 래퍼 함수 활용
import { withAuth, withClinicFilter, withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'

// 인증만 필요한 경우
export const GET = withAuth(async (req, { user }) => {
  return apiSuccess({ data })
})

// clinic_id 필터링이 필요한 경우 (대부분의 API)
export const GET = withClinicFilter(async (req, { user, clinicId }) => {
  // clinicId가 자동으로 세션/쿼리에서 추출됨
  let query = supabase.from('table').select('*')
  if (clinicId) query = query.eq('clinic_id', clinicId)
  return apiSuccess(data)
})

// superadmin 전용 API
export const POST = withSuperAdmin(async (req, { user }) => {
  // superadmin만 접근 가능
  return apiSuccess({ created: true })
})
```

### 권한 검증 헬퍼 (lib/security.ts)
```typescript
import { getSessionUser, canModifyBooking, canAccessCustomer } from '@/lib/security'

// 리소스 수정 전 소유권 검증
const accessCheck = await canModifyBooking(bookingId, user)
if (!accessCheck.allowed) {
  return apiError(accessCheck.error || '권한이 없습니다.', 403)
}
```

### 입력 검증 헬퍼 (lib/security.ts)
```typescript
import { parseId, sanitizeString, isValidBookingStatus, isValidDate } from '@/lib/security'

// ID 파싱 (문자열/숫자 모두 허용)
const bookingId = parseId(id)
if (!bookingId) return apiError('유효한 ID가 필요합니다.')

// 상태값 검증
if (!isValidBookingStatus(status)) return apiError('유효하지 않은 상태입니다.')

// XSS 방지 문자열 sanitize
const safeNotes = sanitizeString(notes, 1000)
```

## 데이터베이스 스키마

### 핵심 테이블
- `clinics` - 병원 고객사
- `users` - 로그인 계정 (role, clinic_id)
- `customers` - 고객 정보 (clinic_id)
- `leads` - 리드/문의 (clinic_id)
- `bookings` - 예약 (clinic_id)
- `payments` - 결제 (clinic_id)
- `ad_campaign_stats` - 광고 통계 (clinic_id)
- `clinic_api_configs` - 병원별 광고 API 키

### 멀티테넌트 필터링 (필수)
```typescript
// 모든 쿼리에 clinic_id 필터 적용
const clinicId = await getClinicId(req.url)
if (clinicId) query = query.eq('clinic_id', clinicId)

// INSERT 시 clinic_id 포함
await supabase.from('table').insert({ clinic_id: clinicId, ...data })
```

## 환경변수

필수 환경변수 (.env.local):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)
- 광고 API: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*`
- 콘텐츠 API: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`

## 브랜치 전략

```
main (프로덕션) → Production 배포
  └── develop (개발/스테이징) → Preview 배포
        └── feature/* (기능 개발)
```

## Cron Jobs

| 경로 | 스케줄 | 용도 |
|------|--------|------|
| `/api/cron/sync-ads` | 매일 03:00 | 광고 데이터 동기화 |
| `/api/cron/sync-press` | 매일 00:00 | 언론보도 동기화 |

로컬 테스트:
```bash
curl -X POST http://localhost:3000/api/cron/sync-ads -H "Authorization: Bearer $CRON_SECRET"
```

## AI 협업 인프라 (.claude/)

### Skills (가이드라인)
| 스킬 | 모드 | 트리거 키워드 |
|------|------|---------------|
| `nextjs-guidelines` | suggest | API, route, 페이지, component |
| `supabase-guidelines` | suggest | DB, 쿼리, supabase, 테이블 |
| `multitenant-guidelines` | **block** | 병원, clinic, 권한, role |
| `ads-sync-guidelines` | suggest | 광고, ads, 동기화, sync |
| `security-guidelines` | **block** | 보안, 인증, 검증, XSS |

### Agents
- `planner` - 구현 계획 수립 (코드 작성 금지)
- `plan-reviewer` - 계획 검증, 멀티테넌트/보안 체크
- `mmi-api-developer` - API 개발 전문
- `multitenant-auditor` - clinic_id 격리 위반 검사
- `auto-error-resolver` - 빌드/타입 에러 자동 해결

### Hooks
- `UserPromptSubmit` → 키워드 기반 스킬 자동 활성화
- `PostToolUse (Edit|Write)` → 파일 변경 추적, 감사 권장
- `Stop` → TypeScript/ESLint 검사 (빌드는 환경변수로 제어)
