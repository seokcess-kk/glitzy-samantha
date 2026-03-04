# MMI 작업보고서 v2.0

**작업일**: 2026-03-04
**작업자**: Claude Sonnet 4.6
**커밋**: `fe45cb5` → GitHub `mbu-glitzy/glitzy_MMI`

---

## 작업 요약

기존 단일 병원 대시보드를 **멀티테넌트 SaaS 플랫폼**으로 확장.
슈퍼어드민이 여러 병원 고객사를 통합 관리하고, 병원별 독립된 데이터·계정·광고 API를 운영할 수 있는 구조로 전환.

---

## 1. DB 스키마 변경사항

### 신규 테이블 (Supabase SQL Editor 실행 필요)

```sql
-- 병원 고객사
CREATE TABLE public.clinics (
  id serial PRIMARY KEY,
  name varchar NOT NULL,
  slug varchar UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 로그인 계정 (DB 기반 인증으로 전환)
CREATE TABLE public.users (
  id serial PRIMARY KEY,
  username varchar UNIQUE NOT NULL,
  password_hash varchar NOT NULL,
  role varchar NOT NULL DEFAULT 'clinic_admin',
  clinic_id integer REFERENCES clinics(id),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 병원별 광고 API 키
CREATE TABLE public.clinic_api_configs (
  id serial PRIMARY KEY,
  clinic_id integer REFERENCES clinics(id),
  platform varchar NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, platform)
);

-- 예약 관리
CREATE TABLE public.bookings (
  id serial PRIMARY KEY,
  clinic_id integer REFERENCES clinics(id),
  customer_id integer REFERENCES customers(id),
  booking_datetime timestamp,
  status varchar DEFAULT 'confirmed',
  notes text,
  chatbot_confirmed_at timestamp,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 기존 테이블에 clinic_id 추가
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id);
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id);
ALTER TABLE public.ad_campaign_stats ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id);
```

---

## 2. 신규/변경 파일 목록 (19개)

| 파일 | 변경 유형 | 내용 |
|---|---|---|
| `PLAN.md` | 신규 | 개발 계획서 |
| `types/next-auth.d.ts` | 신규 | Session 타입 확장 (role, clinic_id) |
| `lib/auth.ts` | 수정 | 환경변수 인증 → DB users 테이블 bcrypt 인증 |
| `lib/session.ts` | 신규 | clinic_id 헬퍼, requireSuperAdmin 헬퍼 |
| `components/ClinicContext.tsx` | 신규 | 클리닉 선택 상태 React Context |
| `components/Sidebar.tsx` | 수정 | 역할별 메뉴, 클리닉 스위처, 사용자 정보 표시 |
| `app/(dashboard)/layout.tsx` | 수정 | ClinicProvider 래핑 추가 |
| `app/(dashboard)/bookings/page.tsx` | 신규 | 예약 목록 + 월별 캘린더 뷰 |
| `app/(dashboard)/admin/page.tsx` | 신규 | 병원/계정 관리 (슈퍼어드민 전용) |
| `app/api/bookings/route.ts` | 신규 | 예약 조회(GET), 상태 변경(PATCH) |
| `app/api/admin/clinics/route.ts` | 신규 | 병원 목록/등록 |
| `app/api/admin/users/route.ts` | 신규 | 계정 목록/생성/활성화 토글 |
| `app/api/seed/route.ts` | 신규 | 더미데이터 시드 엔드포인트 |
| `app/api/dashboard/kpi/route.ts` | 수정 | clinic_id 필터 적용 |
| `app/api/dashboard/trend/route.ts` | 수정 | clinic_id 필터 적용 |
| `app/api/dashboard/channel/route.ts` | 수정 | clinic_id 필터 적용 |
| `app/api/leads/route.ts` | 수정 | clinic_id 필터 적용 |
| `app/api/ads/stats/route.ts` | 수정 | clinic_id 필터 적용 |
| `app/api/patients/route.ts` | 수정 | clinic_id 필터 적용 |

---

## 3. 주요 기능 상세

### 3-1. 멀티테넌트 인증
- **인증 방식**: 환경변수 고정 계정 → Supabase `users` 테이블 bcrypt 인증
- **역할**: `superadmin` (전체 병원 접근) / `clinic_admin` (담당 병원만)
- **JWT 세션**: role, clinic_id 포함

### 3-2. 클리닉 스위처 (슈퍼어드민)
- 사이드바 드롭다운에서 병원 선택
- 선택 상태 localStorage 유지 (새로고침 후에도 유지)
- 전체 병원 모드 지원 (전체 집계 데이터 조회)
- 선택된 clinic_id를 API 호출 시 쿼리 파라미터로 전달

### 3-3. 예약 관리 페이지 (`/bookings`)
- **목록 뷰**: 상태별 필터 (예약확정/방문완료/취소/노쇼), 인라인 상태 변경
- **캘린더 뷰**: 월별 그리드, 날짜별 예약 표시, 월 이동 버튼

### 3-4. 어드민 관리 페이지 (`/admin`)
- 슈퍼어드민 전용 (접근 시 역할 확인, 리다이렉트)
- 병원 등록: 병원명 + 슬러그 입력 → DB insert
- 계정 생성: 아이디/비밀번호/역할/담당병원 → bcrypt 해시 후 DB insert
- 계정 활성/비활성 토글

### 3-5. 더미데이터 시드
- 엔드포인트: `POST /api/seed?secret=CRON_SECRET`
- 생성 데이터: 병원 3개, 계정 4개, 고객 15명, 예약 15건, 상담 12건, 결제 10건, 광고데이터 90건

---

## 4. 빌드 결과

```
✓ Compiled successfully
✓ Linting and checking validity of types

Route (app)                              Size
├ ○ /                    (Dashboard)     13.3 kB
├ ○ /admin               (신규)          3.89 kB
├ ○ /bookings            (신규)          3.83 kB
├ ○ /ads, /chatbot, /leads, /patients
├ ƒ /api/admin/clinics   (신규)
├ ƒ /api/admin/users     (신규)
├ ƒ /api/bookings        (신규)
├ ƒ /api/seed            (신규)
└ ... (기존 15개 API 유지)

총 26개 라우트 빌드 성공
```

**에러 수정**: `channel/route.ts` - Map.get() 반환타입 `unknown` → `string | undefined` 명시 캐스팅

---

## 5. 배포 후 필수 작업

### ① Supabase SQL 실행 (위 섹션 1의 SQL)
신규 테이블 4개 + 기존 테이블 5개에 clinic_id 컬럼 추가

### ② 더미데이터 시드 실행
```bash
curl -X POST "https://glitzy-mmi.vercel.app/api/seed?secret=YOUR_CRON_SECRET"
```
실행하면 다음 계정이 생성됩니다 (비밀번호: `password123`):

| 아이디 | 역할 | 담당 병원 |
|---|---|---|
| `superadmin` | 슈퍼어드민 | 전체 |
| `mirae_admin` | 병원어드민 | 미래성형외과 |
| `kangnam_admin` | 병원어드민 | 강남피부과의원 |
| `seoul_admin` | 병원어드민 | 서울치과 |

### ③ Vercel Redeploy
GitHub push 후 자동 배포 또는 Vercel 대시보드에서 Redeploy

---

## 6. 다음 단계 (미구현 항목)

| 항목 | 설명 |
|---|---|
| 병원별 광고 API 키 관리 | `clinic_api_configs` 테이블 활용, 어드민 페이지에서 입력 UI |
| 비밀번호 변경 기능 | 각 계정의 비밀번호 변경 |
| 예약 상세 모달 | 예약 클릭 시 상세 정보 팝업 |
| 웹훅 clinic 식별 | `/api/webhook/lead?clinic_id=X` 파라미터 처리 강화 |
| 대시보드 실시간 새로고침 | ClinicContext 변경 시 모든 위젯 자동 갱신 |
