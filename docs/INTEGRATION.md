# Samantha ↔ glitzy-web ERP 연동 가이드

## 개요

glitzy-web에서 경량 ERP(견적서, 세금계산서, 수금)를 구축하고,
Samantha에서는 병원 고객이 자기 병원의 견적서를 **읽기 전용**으로 조회하는 구조.

```
glitzy-web (ERP)                         Samantha
──────────────                           ─────────────────────
견적 생성/수정/확정                       견적 조회 (읽기 전용)
계산서 발행/수금 관리    ──→ API ──→     계산서 확인 (읽기 전용)
거래처 = 병원 고객사                      clinic_id로 필터링
```

---

## 시스템 비교

| 항목 | Samantha | glitzy-web (ERP) |
|------|----------|------------------|
| **프레임워크** | Next.js 14 (App Router) | Next.js 15 (App Router) |
| **인증** | NextAuth.js (JWT, credentials) | Better Auth (Google OAuth) |
| **세션** | JWT (`username`, `password_version`) | Cookie (`email`, `role`) |
| **역할** | `superadmin` / `agency_staff` / `clinic_admin` / `clinic_staff` | `admin` / `member` / `user` |
| **테넌트** | 멀티테넌트 (`clinic_id` INTEGER) | 싱글테넌트 |
| **유저 ID 타입** | INTEGER | TEXT (UUID) |
| **DB** | Supabase (JS Client) | Supabase (JS Client + pg 직접 연결) |
| **컬러** | Blue 기반 (brand-500: #3b82f6) | CSS Variables 테마 |

---

## 연동 아키텍처

### 데이터 흐름 (단방향: ERP → Samantha)

```
[glitzy-web ERP]
  └─ /api/external/quotes?service_key=xxx&clinic_id=123
       │
       ▼
[Samantha API]
  └─ /api/quotes (내부)
       ├─ 서비스 키로 glitzy-web API 호출
       ├─ clinic_id 필터 적용 (멀티테넌트 격리 유지)
       └─ 응답을 프론트에 전달
           │
           ▼
[Samantha 프론트]
  └─ /quotes 페이지 (읽기 전용)
```

### 인증 분리 원칙

두 시스템의 인증은 **완전 분리** 유지. 크로스 인증 통합은 하지 않음.

- glitzy-web → Samantha: **서비스 API 키** 방식
- Samantha → glitzy-web: **서비스 API 키** 방식
- 병원 사용자가 glitzy-web에 직접 로그인하는 구조는 불필요

---

## glitzy-web ERP 구축 시 필수 사항

### 1. `clients` 테이블에 `clinic_id` 필드

```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id INTEGER UNIQUE,       -- Samantha clinics.id 논리적 참조
  name TEXT NOT NULL,
  business_number TEXT,            -- 사업자등록번호
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- FK 제약 없음 (별개 DB이므로 논리적 매핑)
- `clinic_id`는 UNIQUE → 1:1 매핑
- Samantha `clinics.id`와 동일한 INTEGER 값 저장

### 2. 외부 조회 API 설계

glitzy-web에 Samantha가 호출할 수 있는 외부 API 필요:

```
GET  /api/external/quotes?clinic_id=123&status=sent
GET  /api/external/quotes/:id
GET  /api/external/invoices?clinic_id=123
GET  /api/external/invoices/:id
```

인증: 요청 헤더에 서비스 키
```
Authorization: Bearer {SERVICE_KEY}
```

응답 형식 (Samantha API 패턴과 호환):
```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "totalPages": 5, "totalCount": 48 }
}
```

### 3. 견적서 상태와 Samantha 노출 범위

| 견적 상태 | Samantha 노출 |
|----------|--------------|
| `draft` | X (미노출) |
| `sent` | O (확인 대기) |
| `approved` | O (승인됨) |
| `converted` | O (매출 전환됨) |
| `rejected` | O (반려됨) |

- `draft` 상태는 내부 작업 중이므로 Samantha에 노출하지 않음
- Samantha에서 병원 고객이 견적을 "승인/반려"하는 기능은 Phase 2에서 검토

---

## Samantha 측 참고 정보

### clinics 테이블 구조

```sql
clinics (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  notify_phones TEXT[],  -- 알림 연락처 (최대 3개)
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### 역할별 견적 접근 권한 (예정)

| 역할 | 견적 조회 | 비고 |
|------|----------|------|
| `superadmin` | 전체 병원 | `?clinic_id=X`로 필터 |
| `agency_staff` | 배정된 병원만 | `assignedClinicIds` 체크 |
| `clinic_admin` | 자기 병원만 | `session.clinic_id` 자동 필터 |
| `clinic_staff` | 접근 차단 | KPI/광고와 동일하게 차단 |

### API 미들웨어 패턴

Samantha의 API는 아래 래퍼를 사용:
```typescript
// 인증 + clinic_id 필터 자동 적용
export async function GET(req: NextRequest) {
  return withClinicFilter(req, async (clinicId, assignedClinicIds) => {
    // clinicId: 단일 병원 ID
    // assignedClinicIds: agency_staff의 배정 병원 목록
    const data = await fetchQuotesFromERP(clinicId)
    return apiSuccess(data)
  })
}
```

### 날짜 처리

- Samantha는 KST (Asia/Seoul) 기준
- API 날짜 파라미터: `YYYY-MM-DD` 형식
- `toISOString().split('T')[0]` 사용 금지 → `getKstDateString()` 사용

---

## 환경변수 (연동 시 추가 예정)

### Samantha (.env.local)
```
# glitzy-web ERP 연동
ERP_API_URL=https://glitzy-web.vercel.app/api/external
ERP_SERVICE_KEY=xxx
```

### glitzy-web (.env.local)
```
# Samantha 연동
SERVICE_KEY=xxx
```

---

## 주의사항 체크리스트

- [ ] DB는 별개 Supabase 프로젝트 → 크로스 DB 쿼리 불가, API 기반 연동만
- [ ] 인증 시스템 통합 불필요 → 서비스 키로 API 호출
- [ ] `clients.clinic_id`로 병원 매핑 (FK 아닌 논리적 참조)
- [ ] 데이터 흐름 단방향 유지 (ERP → Samantha 읽기 전용)
- [ ] Samantha 멀티테넌트 원칙 유지 → 견적 조회에도 `clinic_id` 필터 필수
- [ ] 견적서 `draft` 상태는 Samantha에 미노출
- [ ] 날짜는 KST 기준 통일
- [ ] 에러 시 재시도 로직 필요 (네트워크 장애 대비)
