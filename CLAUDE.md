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
npm run analyze  # 번들 크기 분석 (브라우저에서 시각화)
```

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **인증**: NextAuth.js (Credentials Provider, JWT 전략)
- **데이터베이스**: Supabase (PostgreSQL)
- **스타일링**: Tailwind CSS + shadcn/ui
- **차트**: Recharts (코드 스플리팅 래퍼 사용)
- **토스트**: Sonner
- **작업 큐**: Upstash QStash

## 문서

| 문서 | 설명 |
|------|------|
| [docs/SPEC.md](docs/SPEC.md) | 프로젝트 요구사항 명세 |
| [docs/API.md](docs/API.md) | REST API 엔드포인트 문서 |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI 컴포넌트 사용 가이드 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 작업 로그 |

## 아키텍처

### 멀티테넌트 구조
```
슈퍼어드민 (Glitzy)
├── 실행사 담당자 (agency_staff) ← 다중 병원 배정, 메뉴 권한 제한
├── 병원 A (clinic_id: 1)
│   ├── 병원 관리자 (clinic_admin) ← 전체 데이터 조회, 담당자 관리
│   └── 병원 담당자 (clinic_staff) ← 예약/결제/고객/리드만
├── 병원 B (clinic_id: 2)
└── 병원 C (clinic_id: 3)
```

### 역할 기반 접근 (4단계)
| 역할 | 권한 |
|------|------|
| `superadmin` | 전체 병원 접근, 병원/계정 관리, `?clinic_id=X`로 특정 병원 조회 |
| `agency_staff` | 다중 병원 배정(`user_clinic_assignments`), 계정별 메뉴 권한(`user_menu_permissions`), `?clinic_id=X`로 배정된 병원만 조회 |
| `clinic_admin` | 자신의 병원 전체 데이터, KPI/광고/콘텐츠, 담당자 계정 관리 |
| `clinic_staff` | 예약/결제, 고객(CDP), 캠페인 리드, 챗봇만 접근 (광고/KPI 차단) |

### 데이터 흐름
```
외부 API (Google/Meta/TikTok/YouTube/Instagram)
    ↓ lib/services/* (동기화 함수)
    ↓ app/api/*/route.ts (API 엔드포인트)
    ↓ Supabase Database
    ↓ app/(dashboard)/*/page.tsx (프론트엔드)
```

### 주요 디렉토리
| 디렉토리 | 용도 |
|---------|------|
| `app/(dashboard)/` | 인증된 대시보드 페이지들 (그룹 라우트) |
| `app/api/` | API 라우트 |
| `lib/services/` | 외부 API 동기화 서비스 |
| `lib/` | 유틸리티 모듈 (아래 상세) |
| `components/ui/` | shadcn/ui 컴포넌트 (다크테마 커스텀) |
| `components/common/` | 프로젝트 공용 컴포넌트 |
| `components/charts/` | Recharts 래퍼 (코드 스플리팅) |

## 인증 보안

### 로그인 흐름
```
사용자 → NextAuth Credentials → lib/auth.ts authorize()
  ├─ Rate Limit 체크 (lib/rate-limit.ts: IP:username 키, 15분/5회)
  ├─ DB 사용자 조회 + bcrypt 검증
  ├─ 성공/실패 로그 기록 (login_logs 테이블, non-blocking)
  └─ JWT 토큰 발급 (password_version 포함)
```

### 세션 무효화 (password_version)
- `users.password_version` 컬럼 (기본값 1)
- 비밀번호 변경 시 `password_version` 증가
- `getAuthUser()`에서 토큰의 `password_version`과 DB 비교 → 불일치 시 401
- 레거시 토큰(password_version 없음)은 검증 건너뜀

### IP/UA 전달 패턴
`app/api/auth/[...nextauth]/route.ts`에서 `headers()`로 IP/UA 추출 → `setRequestContext()`로 모듈 레벨 변수에 저장 → `authorize()`에서 사용

### 미들웨어 (middleware.ts)
NextAuth 미들웨어로 인증 필수 경로 제어. 인증 불필요 경로: `api/`, `login`, `lp`(랜딩페이지)

## 핵심 유틸리티 모듈

### API 미들웨어 (lib/api-middleware.ts)
```typescript
import { withAuth, withClinicFilter, withClinicAdmin, withSuperAdmin, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'

// 인증만 필요한 경우
export const GET = withAuth(async (req, { user }) => {
  return apiSuccess({ data })
})

// clinic_id 필터링이 필요한 경우 (대부분의 API)
export const GET = withClinicFilter(async (req, { user, clinicId, assignedClinicIds }) => {
  let query = supabase.from('table').select('*')
  // applyClinicFilter: clinicId, assignedClinicIds 자동 처리 (agency_staff 포함)
  const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
  if (!filtered) return apiSuccess([]) // agency_staff 배정 병원 0개
  return apiSuccess(data)
})

// clinic_admin 이상 (clinic_staff 차단)
export const GET = withClinicAdmin(async (req, { user, clinicId }) => {
  return apiSuccess(data)
})

// superadmin 전용 API
export const POST = withSuperAdmin(async (req, { user }) => {
  return apiSuccess({ created: true })
})
```

### 로깅 (lib/logger.ts)
```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('ServiceName')

logger.debug('디버그 메시지', { context: 'value' })  // 개발환경만
logger.info('정보 로그', { clinicId, action: 'sync' })
logger.warn('경고', { reason: 'rate limit' })
logger.error('에러 발생', error, { userId })
```
- 개발환경: 읽기 쉬운 형식 출력
- 프로덕션: JSON 형식 (로그 수집 도구 호환)

### 외부 API 클라이언트 (lib/api-client.ts)
```typescript
import { fetchJSON, fetchWithRetry } from '@/lib/api-client'

// JSON 응답 처리 (재시도 + 타임아웃 내장)
const result = await fetchJSON<ResponseType>(url, {
  service: 'MetaAds',  // 로깅용
  timeout: 30000,      // 타임아웃 (기본 30초)
  retries: 3,          // 재시도 횟수 (기본 3회)
})

if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error, `시도 횟수: ${result.attempts}`)
}
```
- 429 Too Many Requests: Retry-After 헤더 자동 처리
- Exponential backoff 재시도

### UTM 파라미터 처리 (lib/utm.ts)
```typescript
import { parseUtmFromUrl, sanitizeUtmParams, mergeUtmParams, getUtmSourceLabel } from '@/lib/utm'

// URL에서 UTM 추출
const utmFromUrl = parseUtmFromUrl(inflowUrl)

// sanitize (XSS 방지)
const safeUtm = sanitizeUtmParams(requestBody)

// 병합 (명시적 값 우선)
const finalUtm = mergeUtmParams(explicit, utmFromUrl)

// 표시용 라벨
getUtmSourceLabel('meta')  // → 'Meta'
```

### 보안 헬퍼 (lib/security.ts)
```typescript
import { parseId, sanitizeString, isValidBookingStatus, canModifyBooking } from '@/lib/security'

// ID 파싱
const bookingId = parseId(id)
if (!bookingId) return apiError('유효한 ID가 필요합니다.')

// 상태값 검증
if (!isValidBookingStatus(status)) return apiError('유효하지 않은 상태')

// XSS 방지 sanitize
const safeNotes = sanitizeString(notes, 1000)

// 리소스 소유권 검증
const check = await canModifyBooking(bookingId, user)
if (!check.allowed) return apiError(check.error, 403)
```

## UI 컴포넌트 (요약)

```typescript
// shadcn/ui 기본
import { Button, Card, Badge, Input, Select, Dialog, Table, Skeleton } from '@/components/ui/*'
import { toast } from 'sonner'

// 커스텀 Variants
<Card variant="glass" />      // 글래스모피즘
<Button variant="glass" />    // 글래스 버튼
<Badge variant="meta" />      // 채널별 색상 (meta/google/tiktok/naver/kakao)
<Badge variant="success" />   // 상태별 색상 (success/warning/info)

// 공용 컴포넌트
import { PageHeader, ChannelBadge, StatusBadge, EmptyState } from '@/components/common'

// 차트 (코드 스플리팅 적용)
import { AreaChart, BarChart, PieChart, LineChart, ... } from '@/components/charts'
```

상세 사용법: [docs/COMPONENTS.md](docs/COMPONENTS.md)

### 활동 추적 (lib/activity-log.ts)
```typescript
import { logActivity } from '@/lib/activity-log'

// 데이터 변경 시 활동 로그 기록 (non-blocking, 실패해도 메인 플로우 안 막음)
await logActivity(supabase, {
  userId: user.id,
  clinicId: targetClinicId,
  action: 'booking_create',       // booking_create, booking_status_change, payment_create, lead_status_change 등
  targetTable: 'bookings',
  targetId: booking.id,
  detail: { customer_id: 123, status: 'confirmed' },
})
```
- bookings/payments/consultations/leads에 `created_by`/`updated_by` 컬럼으로 마지막 수정자 추적
- `activity_logs` 테이블에 변경 이력 전체 기록

### SMS 발송 (lib/solapi.ts)
```typescript
import { sendSmsWithLog } from '@/lib/solapi'

// 발송 + DB 로그 기록, 실패 시 logId 반환하여 QStash 재시도 활용
const { success, logId, error } = await sendSmsWithLog(supabase, {
  to: '010-1234-5678', text: '알림 메시지',
  clinicId: 1, leadId: 123,
})
```
- `sms_send_logs` 테이블에 모든 발송 내역 기록 (status: sent/retrying/failed)
- 실패 시 `/api/qstash/sms-retry`로 자동 재시도 (최대 3회, 3분→5분 간격)
- 병원별 알림 연락처 최대 3개 (`clinics.notify_phones TEXT[]`)

## 데이터베이스 스키마

### 핵심 테이블
| 테이블 | 용도 |
|--------|------|
| `clinics` | 병원 고객사 (notify_phones, notify_enabled) |
| `users` | 로그인 계정 (role: superadmin/clinic_admin/clinic_staff, clinic_id) |
| `customers` | 고객 정보 (phone_number로 식별) |
| `leads` | 리드/문의 (UTM 파라미터, landing_page_id, updated_by) |
| `bookings` | 예약 (created_by, updated_by) |
| `consultations` | 상담 (created_by, updated_by) |
| `payments` | 결제 (created_by) |
| `ad_campaign_stats` | 광고 통계 |
| `clinic_api_configs` | 병원별 광고 API 키 |
| `landing_pages` | 랜딩 페이지 (8자리 랜덤 ID) |
| `lead_raw_logs` | 리드 원본 로그 (유실 방지, 멱등성 키) |
| `sms_send_logs` | SMS 발송 로그 (재시도 추적) |
| `activity_logs` | 활동 이력 (누가 무엇을 변경했는지) |
| `user_clinic_assignments` | agency_staff 다중 병원 배정 |
| `user_menu_permissions` | agency_staff 메뉴 권한 |
| `monitoring_keywords` | 순위 모니터링 키워드 (place/website/smartblock) |
| `monitoring_rankings` | 일별 순위 데이터 (keyword_id + rank_date UNIQUE) |
| `login_logs` | 로그인 시도 이력 (user_id, ip_address, success, failure_reason) |

### 멀티테넌트 필터링 (필수)
```typescript
// 모든 쿼리에 clinic_id 필터 적용
const clinicId = await getClinicId(req.url)
if (clinicId) query = query.eq('clinic_id', clinicId)

// INSERT 시 clinic_id 포함
await supabase.from('table').insert({ clinic_id: clinicId, ...data })
```

## 환경변수

### 필수
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)

### 선택 (서비스별)
- 광고 API: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*`
- 콘텐츠 API: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`
- AI: `ANTHROPIC_API_KEY`
- SMS: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- 메시징: `QSTASH_*`, `KAKAO_*`

## 환경 분리 운영

### 브랜치 전략
```
main (프로덕션) → Production 배포
  └── develop (개발/스테이징) → Preview 배포
        └── feature/* (기능 개발)
```

| 브랜치 | 용도 | Vercel 환경 |
|--------|------|-------------|
| `main` | 프로덕션 배포 | Production |
| `develop` | 개발/테스트 | Preview |
| `feature/*` | 기능 개발 | Preview (PR 생성 시) |

### Cron Jobs

| 경로 | 스케줄 | 용도 |
|------|--------|------|
| `/api/cron/sync-ads` | 매일 03:00 | 광고 데이터 동기화 |
| `/api/cron/sync-press` | 매일 00:00 | 언론보도 동기화 |

로컬 테스트:
```bash
curl -X POST http://localhost:3000/api/cron/sync-ads -H "Authorization: Bearer $CRON_SECRET"
```

## 주의사항

### 코드 작성 시 필수 체크리스트
1. **멀티테넌트 격리**: 모든 DB 쿼리에 `clinic_id` 필터 적용 확인
2. **역할 검증**: API는 `withSuperAdmin`/`withClinicAdmin`/`withClinicFilter` 래퍼 사용, 페이지는 `useEffect`로 역할 가드 추가
3. **활동 추적**: bookings/payments/consultations/leads 변경 시 `created_by`/`updated_by` + `logActivity()` 호출
4. **보안**: 사용자 입력은 `sanitizeString`, ID는 `parseId`로 검증
5. **타입 안전**: TypeScript strict 모드 준수
6. **인증 타입**: `types/next-auth.d.ts`에서 Session/JWT 타입 확장 시 `password_version` 필드 유지

### 페이지 역할 가드 패턴
```typescript
// superadmin 전용 페이지
useEffect(() => {
  if (user && user.role !== 'superadmin') router.replace('/')
}, [user, router])
if (user?.role !== 'superadmin') return null

// clinic_admin 이상 (clinic_staff 차단)
useEffect(() => {
  if (user?.role === 'clinic_staff') router.replace('/patients')
}, [user, router])
```

### 테스트 방법
```bash
# 빌드 검증 (타입 에러 검출)
npm run build

# ESLint 검사
npm run lint
```
