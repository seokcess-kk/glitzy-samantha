# MMI 개발 계획서 v2.0

## 개요
병원 마케팅 인텔리전스(MMI) 플랫폼을 멀티테넌트 SaaS로 확장.
슈퍼어드민이 여러 병원 고객사를 관리하고, 각 병원은 독립된 데이터·계정·광고 API를 가짐.

---

## 1. 아키텍처 변경 사항

### 멀티테넌트 구조
```
슈퍼어드민 (Glitzy)
├── 병원 A (미래성형외과)  ← clinic_id: 1
│   ├── 병원A 어드민 계정
│   ├── 병원A 광고 API 키 (Meta/Google/TikTok)
│   └── 병원A 고객/리드/예약/결제 데이터
├── 병원 B (강남피부과)   ← clinic_id: 2
└── 병원 C (서울치과)     ← clinic_id: 3
```

### 인증 변경
- 기존: 환경변수 고정 계정 (ADMIN_USERNAME/PASSWORD)
- 변경: Supabase `users` 테이블 DB 기반 인증
- 역할: `superadmin` (전체 접근) / `clinic_admin` (담당 병원만)

---

## 2. DB 스키마 추가/변경

### 신규 테이블
| 테이블 | 용도 |
|---|---|
| `clinics` | 병원 고객사 목록 |
| `users` | 로그인 계정 (역할 포함) |
| `clinic_api_configs` | 병원별 광고 API 키 저장 |
| `bookings` | 챗봇 확정 예약 목록 |

### 기존 테이블 변경
- `customers`, `leads`, `consultations`, `payments`, `ad_campaign_stats` 에 `clinic_id` 컬럼 추가

### 실행 SQL (Supabase SQL Editor)
```sql
-- clinics
CREATE TABLE public.clinics (
  id serial PRIMARY KEY,
  name varchar NOT NULL,
  slug varchar UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- users (DB 기반 인증)
CREATE TABLE public.users (
  id serial PRIMARY KEY,
  username varchar UNIQUE NOT NULL,
  password_hash varchar NOT NULL,
  role varchar NOT NULL DEFAULT 'clinic_admin',
  clinic_id integer REFERENCES clinics(id),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- clinic_api_configs
CREATE TABLE public.clinic_api_configs (
  id serial PRIMARY KEY,
  clinic_id integer REFERENCES clinics(id),
  platform varchar NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, platform)
);

-- bookings
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

## 3. 신규 기능

### 3-1. 예약 관리 (Bookings)
- 예약 목록 뷰: 상태별 필터 (확정/방문완료/취소/노쇼)
- 월별 캘린더 뷰: 날짜별 예약 시각화
- 예약 상태 변경 기능
- 챗봇 예약 확정 시 자동 등록

### 3-2. 어드민 관리 (Super Admin Only)
- 병원 고객사 목록 조회/등록
- 병원별 어드민 계정 생성/비활성화
- 병원별 광고 API 키 설정 (향후)

### 3-3. 클리닉 스위처 (Super Admin)
- 사이드바에서 병원 선택 → 해당 병원 데이터로 전환
- 전체 보기 모드 지원

---

## 4. 개발 우선순위

| 우선순위 | 항목 | 상태 |
|---|---|---|
| 1 | DB 스키마 마이그레이션 | 대기 (SQL 직접 실행 필요) |
| 2 | DB 기반 인증 전환 | 개발 예정 |
| 3 | 멀티테넌트 API 필터링 | 개발 예정 |
| 4 | 예약 페이지 | 개발 예정 |
| 5 | 어드민 관리 페이지 | 개발 예정 |
| 6 | 더미데이터 시드 | 개발 예정 |

---

## 5. 더미데이터 시나리오
- 병원 3개: 미래성형외과, 강남피부과, 서울치과
- 계정 4개: superadmin 1 + 병원어드민 3
- 고객 15명 (병원당 5명), 리드 20건, 예약 18건, 결제 15건
- 광고비 데이터 90건 (3병원 × 3매체 × 10일)
