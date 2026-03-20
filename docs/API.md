# MMI API 문서

## 개요

MMI 대시보드의 REST API 엔드포인트 문서입니다.
모든 API는 NextAuth.js 인증이 필요하며, 멀티테넌트 환경에서 `clinic_id` 기반 데이터 격리를 지원합니다.

---

## 인증

### 세션 기반 인증
- NextAuth.js Credentials Provider 사용
- JWT 전략 (세션 토큰)
- 쿠키: `next-auth.session-token`

### 역할 (Role)
| 역할 | 권한 |
|------|------|
| `superadmin` | 전체 병원 데이터 접근, 병원/계정 관리 |
| `agency_staff` | 배정된 병원 데이터 접근, 계정별 메뉴 권한 제한 |
| `clinic_admin` | 자신의 clinic_id 데이터만 접근 |
| `clinic_staff` | 예약/결제, 고객, 리드, 챗봇만 접근 |

---

## 공통 파라미터

### 타임존
- 모든 날짜/시간은 **KST (Asia/Seoul, UTC+9)** 기준으로 처리됩니다.
- DB에는 UTC ISO 문자열로 저장되지만, 날짜 경계 계산(오늘/어제, 기간 필터 등)은 KST 기준입니다.
- `startDate`/`endDate` 미지정 시 기본값도 KST 기준으로 계산됩니다.

### Query Parameters
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `clinic_id` | number | 병원 ID (superadmin, agency_staff 사용 가능) |
| `startDate` | string | 시작일 (ISO 8601, KST 기준 00:00:00) |
| `endDate` | string | 종료일 (ISO 8601, KST 기준 23:59:59) |

---

## 대시보드 API

### GET /api/dashboard/kpi

전체 KPI 지표 + 오늘 요약을 조회합니다.

**Query Parameters:**
- `startDate` (optional): 시작일
- `endDate` (optional): 종료일 (기본: 최근 30일)
- `compare` (optional): `true`이면 전기 대비 변화율 포함
- `clinic_id` (optional): 병원 ID

**Response:**
```json
{
  "cpl": 15000,
  "roas": 3.5,
  "bookingRate": 25.5,
  "totalRevenue": 50000000,
  "totalLeads": 150,
  "totalSpend": 5000000,
  "totalConsultations": 45,
  "cac": 250000,
  "arpc": 1500000,
  "payingCustomerCount": 20,
  "today": {
    "leads": 5,
    "bookings": 3,
    "revenue": 3000000,
    "leadsDiff": 2,
    "bookingsDiff": -1,
    "revenueDiff": 500000
  },
  "totalClicks": 5000,
  "totalImpressions": 100000,
  "cpc": 1000,
  "ctr": 5.0,
  "comparison": {
    "cpl": -12.5,
    "roas": 8.3,
    "bookingRate": 5.0,
    "totalRevenue": 15.2,
    "totalLeads": 10.0,
    "totalConsultations": 7.5,
    "totalSpend": -3.2,
    "cac": -8.1,
    "arpc": 12.0,
    "cpc": -5.2,
    "ctr": 3.1
  }
}
```

> `today`: 항상 포함 (KST 기준 오늘 00:00~23:59 + 전일 대비 증감)
> `comparison`: `compare=true`일 때만 포함 (전기 대비 변화율 %)
> 기본 기간: KST 기준 최근 30일 (startDate/endDate 미지정 시)

### GET /api/dashboard/channel

채널별 KPI를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
[
  {
    "channel": "Meta",
    "leads": 80,
    "spend": 3000000,
    "revenue": 30000000,
    "payingCustomers": 12,
    "cpl": 37500,
    "roas": 10.0,
    "conversionRate": 15.0
  }
]
```

### GET /api/dashboard/campaign

캠페인별 KPI를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`
- `channel` (optional): 특정 채널 필터

**Response:**
```json
[
  {
    "campaign": "spring_promo_2024",
    "channel": "Meta",
    "leads": 50,
    "bookings": 20,
    "payingCustomers": 8,
    "spend": 1500000,
    "revenue": 15000000,
    "clicks": 5000,
    "impressions": 100000,
    "cpl": 30000,
    "roas": 10.0,
    "roasPercent": 1000,
    "bookingRate": 40.0,
    "conversionRate": 16.0,
    "ctr": 5.0
  }
]
```

### GET /api/dashboard/funnel

퍼널 분석 데이터를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`
- `groupBy` (optional): `total` | `channel` | `campaign`

**Response:**
```json
{
  "type": "total",
  "funnel": {
    "stages": [
      { "stage": "Lead", "label": "리드", "count": 150, "rate": 100, "dropoff": 0 },
      { "stage": "Booking", "label": "예약", "count": 60, "rate": 40.0, "dropoff": 60.0 },
      { "stage": "Visit", "label": "방문", "count": 45, "rate": 30.0, "dropoff": 25.0 },
      { "stage": "Consultation", "label": "상담", "count": 40, "rate": 26.7, "dropoff": 11.1 },
      { "stage": "Payment", "label": "결제", "count": 20, "rate": 13.3, "dropoff": 50.0 }
    ],
    "totalConversionRate": 13.3,
    "summary": { "leads": 150, "payments": 20 }
  }
}
```

### GET /api/dashboard/trend

주별 트렌드 데이터를 조회합니다. 광고비와 리드 수를 KST 기준 주 단위로 집계합니다.

**Query Parameters:**
- `startDate` (optional): 시작일 (기본: 8주 전)
- `clinic_id`

**Response:**
```json
[
  {
    "week": "2026-03-08T15:00:00.000Z",
    "spend": 5000000,
    "campaigns": 3,
    "leads": 45
  }
]
```

> `week`: 해당 주 시작일 (일요일) UTC ISO 문자열. 클라이언트에서 KST 변환하여 표시

---

## 광고 API

### GET /api/ads/stats

광고 캠페인 통계를 조회합니다.

**Query Parameters:**
- `days`: 조회 일수
- `clinic_id`

**Response:**
```json
[
  {
    "id": 1,
    "platform": "Meta",
    "campaign_name": "캠페인명",
    "stat_date": "2024-01-15",
    "spend_amount": 100000,
    "clicks": 500,
    "impressions": 10000
  }
]
```

### POST /api/ads/sync

광고 데이터를 외부 API에서 동기화합니다.

**Request Body:**
```json
{
  "platform": "all" | "meta" | "google" | "tiktok"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "meta": 15,
    "google": 10,
    "tiktok": 5
  }
}
```

### GET /api/ads/efficiency-trend

일별 광고 효율 추이(CPL·CPC·CTR)를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate` (기본: 최근 28일)
- `clinic_id`

**Response:**
```json
[
  {
    "date": "2026-03-15",
    "spend": 500000,
    "clicks": 250,
    "impressions": 10000,
    "leads": 12,
    "cpl": 41667,
    "cpc": 2000,
    "ctr": 2.5
  }
]
```

### GET /api/ads/platform-summary

매체별 종합 성과 비교를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
[
  {
    "channel": "Meta",
    "spend": 3000000,
    "clicks": 1500,
    "impressions": 50000,
    "leads": 80,
    "revenue": 30000000,
    "payingCustomers": 12,
    "cpl": 37500,
    "cpc": 2000,
    "ctr": 3.0,
    "roas": 10.0,
    "conversionRate": 15.0
  }
]
```

### GET /api/ads/day-analysis

요일별 리드·광고비·CPL을 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
{
  "byDay": [
    { "day": 0, "dayLabel": "일", "leads": 5, "spend": 200000, "cpl": 40000 },
    { "day": 1, "dayLabel": "월", "leads": 15, "spend": 500000, "cpl": 33333 }
  ]
}
```

> `day`: 0(일)~6(토). 리드는 KST 기준 요일 집계, 광고비는 stat_date 기준.

### GET /api/ads/landing-page-performance

랜딩페이지별 리드→결제 전환 성과를 조회합니다.

**Query Parameters:**
- `startDate`, `endDate`, `clinic_id`

**Response:**
```json
{
  "pages": [
    {
      "landingPageId": 1,
      "name": "봄 프로모션 LP",
      "isActive": true,
      "leads": 50,
      "customers": 8,
      "revenue": 12000000,
      "conversionRate": 16.0
    }
  ]
}
```

---

## 리드/고객 API

### GET /api/leads

리드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id`

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "utm_source": "meta",
    "utm_campaign": "spring_promo",
    "chatbot_sent": true,
    "created_at": "2024-01-15T10:30:00Z",
    "customer": {
      "name": "홍길동",
      "phone_number": "010-1234-5678",
      "first_source": "Meta"
    }
  }
]
```

### POST /api/webhook/lead

외부에서 리드를 등록합니다 (웹훅).

**Request Body:**
```json
{
  "name": "홍길동",
  "phoneNumber": "010-1234-5678",
  "utm_source": "meta",
  "utm_medium": "cpc",
  "utm_campaign": "spring_promo",
  "utm_content": "banner_v1",
  "utm_term": "성형외과",
  "inflowUrl": "https://...",
  "clinic_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "leadId": 123,
  "customerId": 456,
  "isNewCustomer": true,
  "utm": { "utm_source": "meta", "utm_campaign": "spring_promo" }
}
```

---

## 예약/결제 API

### GET /api/bookings

예약 목록을 조회합니다.

**Query Parameters:**
- `clinic_id`

**Response:**
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "status": "confirmed",
    "booking_datetime": "2024-01-20T14:00:00Z",
    "notes": "메모",
    "customer": {
      "name": "홍길동",
      "phone_number": "010-1234-5678",
      "consultations": [...],
      "payments": [...]
    }
  }
]
```

### PUT /api/bookings

예약 정보를 수정합니다.

**Request Body:**
```json
{
  "id": 1,
  "status": "visited",
  "booking_datetime": "2024-01-20T14:00:00Z",
  "notes": "메모 수정"
}
```

### PUT /api/patients/{id}/consultation

상담 기록을 저장합니다.

**Request Body:**
```json
{
  "status": "방문완료",
  "notes": "상담 내용",
  "consultationDate": "2024-01-20"
}
```

### POST /api/patients/{id}/payment

결제 내역을 등록합니다.

**Request Body:**
```json
{
  "treatmentName": "쌍꺼풀",
  "paymentAmount": 1500000,
  "paymentDate": "2024-01-20"
}
```

---

## 콘텐츠 API

### GET /api/content/posts

콘텐츠 목록을 조회합니다.

### POST /api/content/posts

콘텐츠를 등록합니다.

### PUT /api/content/posts

콘텐츠 통계를 업데이트합니다.

### GET /api/content/analytics

콘텐츠 분석 데이터를 조회합니다.

**Query Parameters:**
- `groupBy`: `platform` | `campaign` | `month` | `post`
- `clinic_id`

### POST /api/content/audit

콘텐츠 의료광고법 위반 검사를 실행합니다.

---

## 언론보도 API

### GET /api/press

언론보도 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "title": "신사세레아의원, 리뉴얼 오픈",
    "source": "조선일보",
    "url": "https://...",
    "published_at": "2026-03-20T03:00:00Z",
    "collected_at": "2026-03-20T09:00:00Z",
    "keyword_id": 1
  }
]
```

### POST /api/press/sync

Google 뉴스에서 키워드별 언론보도를 수집합니다.
`press_keywords`에 등록된 활성 키워드별로 RSS 검색. 키워드 미등록 시 병원명으로 폴백.

**Query Parameters:**
- `clinic_id` (optional): 특정 병원만 수집

### GET /api/press/keywords

언론보도 검색 키워드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "keyword": "신사세레아의원",
    "is_active": true,
    "created_by": 1,
    "created_at": "2026-03-20T00:00:00Z"
  }
]
```

### POST /api/press/keywords

언론보도 검색 키워드를 등록합니다. 병원당 최대 5개.

**Request Body:**
```json
{
  "clinic_id": 1,
  "keyword": "신사세레아의원"
}
```

### DELETE /api/press/keywords

언론보도 검색 키워드를 삭제합니다. 삭제 전 `deleted_records`에 스냅샷 보관.

**Request Body:**
```json
{
  "id": 1
}
```

---

## 관리자 API (superadmin 전용)

### GET /api/admin/clinics

병원 목록을 조회합니다.

### POST /api/admin/clinics

병원을 등록합니다.

**Request Body:**
```json
{
  "name": "미래성형외과",
  "slug": "mirae"
}
```

### GET /api/admin/users

사용자 목록을 조회합니다.

### POST /api/admin/users

사용자를 생성합니다.

**Request Body (clinic_admin/clinic_staff):**
```json
{
  "username": "admin_mirae",
  "password": "초기비밀번호",
  "role": "clinic_admin",
  "clinic_id": 1
}
```

**Request Body (agency_staff):**
```json
{
  "username": "agency_kim",
  "password": "초기비밀번호",
  "role": "agency_staff",
  "assigned_clinic_ids": [1, 2, 3],
  "menu_permissions": ["dashboard", "monitoring", "monitoring-input"]
}
```

### GET /api/admin/users/{id}/permissions

agency_staff 계정의 병원 배정 및 메뉴 권한을 조회합니다.

**Response:**
```json
{
  "assigned_clinic_ids": [1, 2],
  "menu_permissions": ["dashboard", "monitoring"]
}
```

### PUT /api/admin/users/{id}/permissions

agency_staff 계정의 병원 배정 및 메뉴 권한을 수정합니다.

**Request Body:**
```json
{
  "assigned_clinic_ids": [1, 2, 3],
  "menu_permissions": ["dashboard", "campaigns", "monitoring", "monitoring-input"]
}
```

---

## 내 정보 API

### GET /api/my/clinics

현재 로그인 사용자의 접근 가능 병원 목록을 조회합니다.
- superadmin: 전체 활성 병원
- agency_staff: 배정된 병원만
- clinic_admin/staff: 자기 병원만

### GET /api/my/menu-permissions

현재 로그인 사용자의 메뉴 권한을 조회합니다.

**Response:**
```json
{
  "all": false,
  "permissions": ["dashboard", "monitoring", "monitoring-input"]
}
```

---

## 순위 모니터링 API

### GET /api/monitoring/keywords

모니터링 키워드 목록을 조회합니다.

**Query Parameters:**
- `clinic_id` (optional)
- `active_only` (optional): `true`이면 활성 키워드만

**Response:**
```json
[
  {
    "id": 1,
    "clinic_id": 1,
    "keyword": "강남 성형외과",
    "category": "place",
    "is_active": true
  }
]
```

### POST /api/monitoring/keywords (superadmin/agency_staff)

키워드를 등록합니다.

**Request Body:**
```json
{
  "clinic_id": 1,
  "keyword": "강남 성형외과",
  "category": "place"
}
```

### PATCH /api/monitoring/keywords (superadmin/agency_staff)

키워드를 수정합니다.

**Request Body:**
```json
{
  "id": 1,
  "is_active": false
}
```

### DELETE /api/monitoring/keywords (superadmin/agency_staff)

키워드를 삭제합니다. 관련 순위 데이터도 CASCADE 삭제. 삭제 전 `deleted_records`에 스냅샷 보관.

**Request Body:**
```json
{
  "id": 1
}
```

### GET /api/monitoring/rankings

월간 순위 데이터를 조회합니다.

**Query Parameters:**
- `month` (필수): `YYYY-MM`
- `category` (optional): `place` | `website` | `smartblock`
- `clinic_id` (optional)

**Response:**
```json
{
  "keywords": [
    { "id": 1, "keyword": "강남 성형외과", "category": "place", "clinic_id": 1 }
  ],
  "rankings": [
    { "keyword_id": 1, "rank_date": "2026-03-01", "rank_position": 3, "url": null }
  ]
}
```

### POST /api/monitoring/rankings

단건 순위를 입력합니다 (UPSERT).

**Request Body:**
```json
{
  "keyword_id": 1,
  "rank_date": "2026-03-16",
  "rank_position": 3,
  "url": "https://..."
}
```

### POST /api/monitoring/rankings/bulk

일괄 순위를 입력합니다 (UPSERT, 최대 200개).

**Request Body:**
```json
{
  "rankings": [
    { "keyword_id": 1, "rank_date": "2026-03-16", "rank_position": 3 },
    { "keyword_id": 2, "rank_date": "2026-03-16", "rank_position": 5, "url": "https://..." }
  ]
}
```

---

## Cron API

### POST /api/cron/sync-ads
광고 데이터 자동 동기화 (매일 03:00)

### POST /api/cron/sync-press
언론보도 자동 수집 (매일 00:00)

**인증:**
```
Authorization: Bearer $CRON_SECRET
```

---

## 병원 API 키 관리 API (superadmin 전용)

### GET /api/admin/clinics/{id}/api-configs

병원의 매체별 API 키 설정을 조회합니다.

### PUT /api/admin/clinics/{id}/api-configs

병원의 매체별 API 키 설정을 저장/수정합니다.

### POST /api/admin/clinics/{id}/api-configs/test

매체별 API 키 연결 테스트를 실행합니다.

---

## 공개 페이지 (인증 불필요)

| 경로 | 설명 |
|------|------|
| `/privacy` | 개인정보처리방침 |
| `/terms` | 서비스 이용약관 |

---

## 에러 응답

### 공통 에러 형식
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE"
}
```

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 에러 |
