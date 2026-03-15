# MMI 프로젝트 작업 로그

## 개요

shadcn/ui 기반 UI/UX 개선 및 코드 품질 향상 작업 기록

---

## Phase 1: shadcn/ui 초기 설정

### 설치 패키지
```bash
npx shadcn@latest init
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge
```

### 설정 파일 수정

**tailwind.config.ts**
- shadcn 색상 시스템 통합 (border, background, foreground, primary 등)
- 기존 brand 색상 유지 (brand-50 ~ brand-900)
- CSS 변수 기반 테마 시스템

**app/globals.css**
- CSS 변수 정의 (:root)
- 다크 테마 기본값 설정
- glass-card, animate-fade-in-up 유지

**lib/utils.ts**
- `cn()` 유틸리티 함수 생성 (clsx + tailwind-merge)

---

## Phase 2: UI 컴포넌트 추가

### 설치된 shadcn/ui 컴포넌트
```
components/ui/
├── button.tsx      # glass variant 추가
├── badge.tsx       # 채널별 variant (meta, google, tiktok, naver, kakao)
├── card.tsx        # glass variant 추가
├── input.tsx       # 다크 테마 기본 적용
├── select.tsx      # 다크 테마 기본 적용
├── label.tsx
├── skeleton.tsx
├── table.tsx
├── tabs.tsx        # 다크 테마 기본 적용
├── dialog.tsx
├── sheet.tsx
├── dropdown-menu.tsx
└── sonner.tsx
```

### 컴포넌트 커스터마이징

**Button** - glass variant
```tsx
glass: "glass-card hover:bg-white/10 text-slate-400 hover:text-white"
```

**Badge** - 채널/상태 variants
```tsx
meta: "bg-blue-500/20 text-blue-400 border-blue-500/30"
google: "bg-red-500/20 text-red-400 border-red-500/30"
success: "bg-emerald-500/20 text-emerald-400"
warning: "bg-amber-500/20 text-amber-400"
```

**Input/Select/Tabs** - 다크 테마 기본 적용
```tsx
// Input
"border-white/10 bg-white/5 text-white placeholder:text-slate-500"

// Select
"bg-[#1a1a2e]/95 backdrop-blur-xl border-white/10"
```

---

## Phase 3: 공통 컴포넌트 생성

### 디렉토리 구조
```
components/common/
├── index.ts           # 통합 export
├── page-header.tsx    # 페이지 헤더 (title, description, actions)
├── stats-card.tsx     # 통계 카드 (label, value, trend, icon)
├── channel-badge.tsx  # 채널 자동 감지 뱃지
├── status-badge.tsx   # 상태 자동 감지 뱃지
└── empty-state.tsx    # 빈 상태 표시
```

### 사용 현황
| 컴포넌트 | 사용 페이지 수 |
|----------|----------------|
| PageHeader | 8 |
| StatsCard | 6 |
| ChannelBadge | 4 |
| StatusBadge | 3 |
| EmptyState | 2 |

---

## Phase 4: 페이지별 적용

### 적용 완료 페이지

| 페이지 | 파일 | 주요 변경 |
|--------|------|-----------|
| 로그인 | `login/page.tsx` | Card, Input, Button, Label |
| 대시보드 | `page.tsx` | Card, Button, Badge, Table, Skeleton, 차트 래퍼 |
| 고객(CDP) | `leads/page.tsx` | Card, Badge, Sheet, Select, Input |
| 리드 폼 | `lead-form/page.tsx` | Card, Input, Select, Button |
| 광고 분석 | `ads/page.tsx` | Card, Badge, Button, Select, 차트 래퍼 |
| 예약/결제 | `patients/page.tsx` | Card, Tabs, Badge, Dialog |
| 콘텐츠 | `content/page.tsx` | Card, Dialog, Table, 차트 래퍼 |
| 어드민 | `admin/page.tsx` | Tabs, Dialog, Table, Input, Select |
| 챗봇 | `chatbot/page.tsx` | Card, Badge, Table |
| 모니터 | `monitor/page.tsx` | Card, Table, Button |
| 언론보도 | `press/page.tsx` | Card, Badge, EmptyState |
| UTM 생성기 | `utm/page.tsx` | Card, Input, Select, Button |

### Sidebar 업데이트
- DropdownMenu 적용
- Select 컴포넌트 (병원 선택)

---

## Phase 5: 코드 품질 개선

### ESLint 경고 수정 (0 errors, 0 warnings)

| 파일 | 문제 | 해결 |
|------|------|------|
| `admin/page.tsx` | useEffect 의존성 누락 | `router` 추가 |
| `ads/page.tsx` | useEffect 의존성 누락 | `useCallback` 적용 |
| `layout.tsx` | Google Fonts CDN 경고 | `next/font/google` 사용 |
| `channel-badge.tsx` | 타입 불일치 | `NonNullable<BadgeProps['variant']>` 사용 |

### 타입 안전성 개선
- tickFormatter 콜백에 `(v: number)` 타입 명시
- 차트 컴포넌트 `ComponentType<any>` 캐스팅

---

## Phase 6: 접근성 개선

### ARIA 속성 추가

| 파일 | 요소 | 추가된 속성 |
|------|------|-------------|
| `layout.tsx` | 모바일 메뉴 버튼 | `aria-label="메뉴 열기"` |
| `admin/page.tsx` | 토글 버튼 | `aria-label` (동적) |
| `monitor/page.tsx` | 펼치기/접기 버튼 | `aria-label`, `aria-expanded` |
| `leads/page.tsx` | 필터 버튼 | `aria-pressed`, `aria-label` |
| `leads/page.tsx` | 고객 선택 버튼 | `aria-pressed`, `aria-label` |
| `patients/page.tsx` | 아코디언 | `aria-expanded`, `aria-label` |
| `utm/page.tsx` | 히스토리 토글 | `aria-expanded`, `aria-label` |
| `utm/page.tsx` | 삭제 버튼 | `aria-label` (동적) |
| `Sidebar.tsx` | 사용자 메뉴 | `aria-label="사용자 메뉴"` |

---

## Phase 7: 모바일 UX 개선

### 반응형 그리드 수정

| 파일 | 이전 | 이후 |
|------|------|------|
| `chatbot/page.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `press/page.tsx` | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| `leads/page.tsx` | `grid-cols-5` | `grid-cols-3 sm:grid-cols-5` |
| `content/page.tsx` | `grid-cols-5` | `grid-cols-2 sm:grid-cols-5` |
| `patients/page.tsx` | `min-h-[80px]` | `min-h-[60px] sm:min-h-[80px]` |

### 터치 타겟 개선
- `layout.tsx`: 모바일 메뉴 버튼 `p-1.5` → `p-2.5`

### 버그 수정
- `leads/page.tsx`: Sheet 모달 데스크톱 오버레이 버그 수정
  - `SheetContent`에만 `md:hidden` 적용 → `Sheet` 전체를 `<div className="md:hidden">`으로 감싸기

---

## Phase 8: 번들 최적화

### 분석 도구 설치
```bash
npm install @next/bundle-analyzer --save-dev
```

**next.config.mjs**
```javascript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
```

**package.json**
```json
"scripts": {
  "analyze": "ANALYZE=true next build"
}
```

### 차트 래퍼 컴포넌트

**components/charts/index.tsx**
```tsx
// Dynamic Import (코드 스플리팅)
export const AreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  { ssr: false, loading: () => <ChartLoading /> }
)
export const BarChart = dynamic(...)
export const PieChart = dynamic(...)
export const LineChart = dynamic(...)
export const ResponsiveContainer = dynamic(...)

// 직접 Re-export (자식 컴포넌트)
export { Area, Bar, Line, Pie, Cell, XAxis, YAxis, ... } from 'recharts'
```

### 번들 크기 개선 결과

| 페이지 | 이전 | 이후 | 절감 |
|--------|------|------|------|
| `/` (대시보드) | 213 kB | 191 kB | -22 kB (-10%) |
| `/ads` | 249 kB | 237 kB | -12 kB (-5%) |
| `/content` | 238 kB | 225 kB | -13 kB (-5%) |

---

## Phase 9: 문서화

### 생성된 문서

| 파일 | 내용 |
|------|------|
| `docs/API.md` | REST API 엔드포인트 문서 (26개 API) |
| `docs/COMPONENTS.md` | UI 컴포넌트 사용 가이드 (13개 컴포넌트) |
| `docs/WORK_LOG.md` | 작업 로그 (현재 파일) |

### CLAUDE.md 업데이트
- docs 디렉토리 참조 추가
- UI 컴포넌트 사용법 추가

---

## 최종 빌드 상태

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ 39 pages generated
✓ 0 ESLint errors, 0 warnings
```

### 페이지별 번들 크기
```
/                 7.57 kB  (총 191 kB)
/admin           10.2 kB   (총 157 kB)
/ads              7.21 kB  (총 237 kB)
/chatbot          5.27 kB  (총 102 kB)
/content          9.77 kB  (총 225 kB)
/lead-form        6.41 kB  (총 113 kB)
/leads            6.55 kB  (총 149 kB)
/login            4.46 kB  (총 111 kB)
/monitor          6.59 kB  (총 113 kB)
/patients         6.12 kB  (총 154 kB)
/press            5.58 kB  (총 112 kB)
/utm              6.7 kB   (총 113 kB)

First Load JS shared: 87.6 kB
```

---

## P2: KPI 대시보드 개선 (2026-03-14)

### 목표
KPI 대시보드에 기간 선택, 채널별 성과 테이블, 전기 대비 변화율 표시 기능 추가

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/dashboard/kpi/route.ts` | compare 모드 추가, fetchMetrics 함수 추출, 전기 대비 변화율 계산 |
| `app/(dashboard)/page.tsx` | 기간 선택 UI (Select), 채널별 테이블, KPI trend 연동 |

### 구현 내용

#### 1. KPI API 개선
```typescript
// compare=true 시 전기 데이터와 변화율 함께 반환
GET /api/dashboard/kpi?startDate=...&compare=true

// 응답 예시
{
  cpl: 25000,
  roas: 1.5,
  // ...
  comparison: {
    cpl: -5.2,    // 전기 대비 5.2% 감소 (좋음)
    roas: 12.3,   // 전기 대비 12.3% 증가 (좋음)
    // ...
  }
}
```

#### 2. 기간 선택 UI
- Select 드롭다운: 7일 / 14일 / 30일 / 90일
- 기간 변경 시 모든 API에 startDate 파라미터 전달

#### 3. 채널별 성과 테이블
- 채널, 리드, 광고비, 결제액, CPL, ROAS, 전환율 표시
- 캠페인 테이블과 동일한 스타일

#### 4. KPI 변화율 표시
- StatsCard에 trend prop 전달
- CPL/CAC: 낮아지면 좋음 (역방향 지표)
- ROAS/매출/전환율: 높아지면 좋음

### 코드 리뷰 후 수정

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | content_posts 기간 필터 누락 | `.gte('created_at', start).lte('created_at', end)` 추가 |
| 중간 | trend/funnel API에 startDate 미적용 | 모든 API에 startDate 파라미터 추가 |
| 낮음 | TrendingUp 미사용 import | 제거 |
| 낮음 | roas 0일 때 NaN 가능성 | `kpi.roas \|\| 0` 안전 처리 |

### 빌드 결과
```
✓ Compiled successfully
✓ TypeScript 타입 검사 통과
✓ ESLint 경고 1건 (기존 useEffect 의존성)
```

---

## P3: UTM 링크 생성기 기능 향상 (2026-03-14)

### 목표
UTM 링크 생성기를 로컬스토리지 기반에서 DB 기반으로 업그레이드, 캠페인 템플릿 및 QR 코드 생성 기능 추가

### 신규 파일

| 파일 | 용도 |
|------|------|
| `app/api/utm/templates/route.ts` | 템플릿 CRUD API (GET/POST) |
| `app/api/utm/templates/[id]/route.ts` | 단일 템플릿 API (PUT/DELETE) |
| `app/api/utm/links/route.ts` | 링크 히스토리 API (GET/POST) |
| `app/api/utm/links/[id]/route.ts` | 단일 링크 API (DELETE) |
| `app/(dashboard)/utm/components/TemplateSelector.tsx` | 템플릿 선택/저장 UI |
| `app/(dashboard)/utm/components/QRCodeDialog.tsx` | QR 코드 생성 다이얼로그 |
| `supabase/migrations/20240315_utm_templates_links.sql` | DB 테이블 생성 SQL |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/utm.ts` | `buildUtmUrl()` 함수 추가 |
| `app/(dashboard)/utm/page.tsx` | DB 연동, 템플릿/QR 기능 통합 |

### DB 테이블

**utm_templates** (캠페인 템플릿)
```sql
CREATE TABLE utm_templates (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  name VARCHAR(100) NOT NULL,
  base_url VARCHAR(500),
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  platform VARCHAR(30),
  is_default BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP,
  UNIQUE(clinic_id, name)
);
```

**utm_links** (링크 히스토리)
```sql
CREATE TABLE utm_links (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  original_url TEXT NOT NULL,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  label VARCHAR(100),
  template_id INTEGER REFERENCES utm_templates(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP
);
```

### 설치 패키지
```bash
npm install qrcode.react
```

### 구현 기능
- ✅ DB 기반 템플릿 저장/불러오기
- ✅ 기본 템플릿 자동 적용 (is_default)
- ✅ 중복 기본 템플릿 방지 (애플리케이션 레벨)
- ✅ DB 기반 링크 히스토리 (디바이스 간 공유)
- ✅ QR 코드 생성 (PNG/SVG 다운로드)
- ✅ QR 코드 크기/색상 커스터마이징
- ✅ 멀티테넌트 격리 (clinic_id 기반)
- ✅ 삭제 확인 다이얼로그 (confirm → Dialog)

### 코드 품질 개선 (리뷰 반영)
- JSON 파싱 에러 핸들링 추가
- limit 파라미터 NaN 처리
- 사용하지 않는 import 제거 (X from lucide-react)
- URL 빈 값 처리 (QRCodeDialog)

### 빌드 결과
```
/utm    16.1 kB (총 155 kB)
✓ Build 성공
✓ Lint 통과
```

### 다음 단계
⚠️ **DB 테이블 생성 필요**: `supabase/migrations/20240315_utm_templates_links.sql` 실행

---

## P4: API 기간 필터 통일 (2026-03-14)

### 목표
대시보드 기간 선택이 모든 API에 적용되도록 startDate 파라미터 통일

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/dashboard/trend/route.ts` | startDate 파라미터 추가 (기본값: 8주 전) |
| `app/api/content/analytics/route.ts` | startDate/endDate 파라미터 추가 |
| `app/api/leads/route.ts` | startDate, limit 파라미터 추가 |

### API startDate 지원 현황 (완료)

| API | 지원 | 비고 |
|-----|------|------|
| `/api/dashboard/kpi` | ✅ | compare 모드 포함 |
| `/api/dashboard/channel` | ✅ | |
| `/api/dashboard/campaign` | ✅ | |
| `/api/dashboard/funnel` | ✅ | |
| `/api/dashboard/trend` | ✅ | 이번 작업에서 추가 |
| `/api/content/analytics` | ✅ | 이번 작업에서 추가 |
| `/api/leads` | ✅ | 이번 작업에서 추가 (limit 파라미터도 추가) |

### 빌드 결과
```
✓ Build 성공
✓ TypeScript 타입 검사 통과
```

---

## P5: 메뉴 구조 개선 (2026-03-14)

### 목표
사용자 플로우와 권한 기반으로 메뉴 구조 재설계

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/Sidebar.tsx` | 그룹 기반 메뉴 구조, 리드 등록 메뉴 추가, 타입 정의 추가 |

### 구현 내용

#### 1. 메뉴 그룹화
```
📊 대시보드

────────── 고객 관리 ──────────
👥 고객(CDP)
📅 예약/결제
💬 챗봇 현황
📝 리드 등록 ← 신규 추가

────────── 마케팅 분석 ──────────
📈 광고 성과
🎬 콘텐츠 분석
🔍 콘텐츠 모니터링
📰 언론보도

────────── 슈퍼어드민 ──────────
🔗 UTM 생성기
⚙️ 어드민 관리
```

#### 2. 타입 정의 추가
```typescript
interface MenuItem {
  href: string
  label: string
  icon: LucideIcon
}

interface MenuGroup {
  label?: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [...]
```

#### 3. 버그 수정
- `SelectItem value=""` → `value="all"` 변경 (radix-ui 빈 문자열 value 오류 해결)

### 빌드 결과
```
✓ TypeScript 타입 검사 통과
✓ ESLint 통과
```

---

## P6-B: 고객 여정 타임라인 개선 (2026-03-15)

### 목표
고객 상세 패널의 여정 타임라인을 개선하여 유입→예약→상담→결제까지의 전체 여정을 직관적으로 시각화

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/common/customer-journey.tsx` | 신규 - 여정 타임라인 재사용 컴포넌트 |
| `components/common/index.ts` | CustomerJourney export 추가 |
| `app/(dashboard)/leads/page.tsx` | 기존 타임라인 → CustomerJourney 컴포넌트로 교체 |

### 신규 컴포넌트: CustomerJourney

#### 이벤트 유형별 설정

| 유형 | 아이콘 | 색상 | 상태별 변형 |
|------|--------|------|------------|
| 유입 (inflow) | MousePointerClick | brand-500 | - |
| 챗봇 (chatbot) | MessageSquare | emerald-500 (발송), slate-600 (대기) | 발송/대기 |
| 예약 (booking) | CalendarCheck | blue-500 (확정), amber-500 (대기), purple-500 (방문), red-500 (노쇼), slate-600 (취소) | 상태별 |
| 상담 (consultation) | Users | purple-500 | - |
| 결제 (payment) | CreditCard | emerald-400 | - |

#### Props 인터페이스
```typescript
interface CustomerJourneyProps {
  leads: any[]
  bookings: any[]
  consultations: any[]
  payments: any[]
  className?: string
}
```

#### 사용 예시
```tsx
<CustomerJourney
  leads={allLeads}
  bookings={bookings}
  consultations={consultations}
  payments={payments}
/>
```

### 코드 품질 개선 (리뷰 반영)

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | 날짜 null/invalid 시 에러 | `formatDate()` 등에 null 체크 및 `isNaN` 검증 추가 |
| 높음 | 챗봇 이벤트 정렬 불안정 | 동일 시간 시 `typeOrder` 기반 안정 정렬 |
| 중간 | leads 빈 배열 처리 | `lead.leads?.length ? lead.leads : [lead]` |
| 중간 | 접근성 속성 누락 | `role="list"`, `role="listitem"`, `aria-label` 추가 |
| 낮음 | 미사용 import | `getUtmSourceLabel` 제거 |
| 낮음 | 중복 UI 섹션 | "유입 이력" 박스 제거 (타임라인에서 이미 표시) |

### 구현 상세

#### 1. 시간순 정렬 안정화
```typescript
const typeOrder: Record<JourneyEventType, number> = {
  inflow: 0, chatbot: 1, booking: 2, consultation: 3, payment: 4,
}
return events.sort((a, b) => {
  const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (timeDiff !== 0) return timeDiff
  return typeOrder[a.type] - typeOrder[b.type]  // 동일 시간: 타입 순서 보장
})
```

#### 2. 날짜 포맷 안전 처리
```typescript
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko', { month: 'short', day: 'numeric' })
}
```

#### 3. 접근성 개선
```tsx
<div role="list" aria-label="고객 여정 타임라인">
  <div role="listitem" aria-label={`${label} - ${formatDate(event.date)}`}>
    <div aria-hidden="true">...</div>  // 장식 요소
  </div>
</div>
```

### 빌드 결과
```
/leads    7.18 kB (총 150 kB)  ← 이전 7.29 kB에서 -0.11 kB

✓ Build 성공
✓ TypeScript 타입 검사 통과
✓ ESLint 통과
```

### 커밋
```
84f68d3 feat: P6-B 고객 여정 타임라인 컴포넌트 개선
```

---

## P7: 랜딩 페이지 관리 및 리드 수집 연동 (2026-03-15)

### 목표
- 기존 HTML 랜딩 페이지 파일들을 프로젝트에서 서빙
- 슈퍼관리자가 각 랜딩 페이지에 병원(clinic_id) 배정
- URL에 `?id=고유번호`로 랜딩 페이지 식별
- 폼 제출 시 `/api/webhook/lead` API로 리드 + 설문 응답(JSONB) 수집

### URL 형식
```
/lp?id=1001&utm_source=meta&utm_medium=cpc&utm_campaign=march_promo

구성요소:
- /lp: 공통 랜딩 라우트
- id=1001: 랜딩 페이지 고유 번호 (landing_pages.id)
- utm_*: 기존 UTM 파라미터들
```

### 데이터베이스 변경

#### landing_pages 테이블 (신규)
```sql
CREATE TABLE landing_pages (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,           -- "세레아 3월 프로모션"
  file_name VARCHAR(100) NOT NULL,      -- "lp_A1.html"
  description TEXT,                      -- 관리자 메모
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### leads 테이블 수정
```sql
ALTER TABLE leads ADD COLUMN custom_data JSONB DEFAULT '{}';
ALTER TABLE leads ADD COLUMN landing_page_id INTEGER REFERENCES landing_pages(id);
```

### 파일 구조
```
프로젝트 루트/
├── public/landing/                    # HTML 파일 저장
│   └── lp_A1.html
├── app/lp/page.tsx                    # 동적 랜딩 페이지 라우트
├── app/api/admin/landing-pages/       # 관리 API
│   ├── route.ts                       # GET, POST
│   └── [id]/route.ts                  # GET, PUT, DELETE
└── supabase/migrations/
    └── 20260315_landing_pages.sql     # 마이그레이션 파일
```

### 수정된 파일

| 파일 | 작업 |
|------|------|
| `middleware.ts` | `/lp` 경로 인증 제외 |
| `public/landing/lp_A1.html` | submitForm API 호출 추가, custom_data 전송 |
| `app/lp/page.tsx` | 신규 - 동적 랜딩 페이지 서빙 |
| `app/api/admin/landing-pages/route.ts` | 신규 - GET, POST API |
| `app/api/admin/landing-pages/[id]/route.ts` | 신규 - GET, PUT, DELETE API |
| `app/api/webhook/lead/route.ts` | custom_data, landing_page_id 필드 추가 |
| `app/api/leads/route.ts` | landing_page 정보 JOIN 추가 |
| `app/(dashboard)/admin/page.tsx` | 랜딩 페이지 탭 추가 |
| `app/(dashboard)/leads/page.tsx` | 랜딩 페이지/설문 응답 표시 |
| `app/(dashboard)/utm/page.tsx` | 랜딩 페이지 + 광고 소재 선택 드롭다운 추가 |
| `components/ui/textarea.tsx` | 신규 - shadcn/ui 스타일 |
| `components/ui/switch.tsx` | 신규 - shadcn/ui 스타일 |

### 광고 소재 관리 추가 (P7-B)

#### ad_creatives 테이블
```sql
CREATE TABLE ad_creatives (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  landing_page_id INTEGER REFERENCES landing_pages(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,           -- "3월 프로모션 영상 30초"
  description TEXT,
  utm_content VARCHAR(100) NOT NULL,    -- UTM에 사용될 값
  platform VARCHAR(50),                  -- "meta", "google" 등
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 추가 파일
| 파일 | 작업 |
|------|------|
| `supabase/migrations/20260315_ad_creatives.sql` | 신규 - 마이그레이션 |
| `app/api/admin/ad-creatives/route.ts` | 신규 - GET, POST |
| `app/api/admin/ad-creatives/[id]/route.ts` | 신규 - GET, PUT, DELETE |
| `app/(dashboard)/admin/page.tsx` | 광고 소재 탭 추가 |
| `app/(dashboard)/utm/page.tsx` | 소재 선택 드롭다운 추가 |

### 주요 기능

1. **광고 소재 관리** (admin 페이지 > 광고 소재 탭)
   - 소재 CRUD (이름, UTM Content, 플랫폼)
   - 병원 배정
   - 랜딩 페이지 연결
   - 활성/비활성 토글

2. **랜딩 페이지 관리** (admin 페이지)
   - 랜딩 페이지 CRUD
   - 병원 배정
   - 활성/비활성 토글
   - URL 복사 및 미리보기

3. **동적 랜딩 페이지 서빙** (/lp?id=X)
   - HTML 파일 동적 로드
   - clinic_id, landing_page_id 자동 주입
   - UTM 파라미터 전달

4. **리드 수집** (webhook/lead API)
   - 설문 응답을 custom_data JSONB로 저장
   - landing_page_id 연결

5. **UTM 페이지 연동**
   - 광고 소재 선택 → utm_content + 랜딩 페이지 자동 설정
   - 랜딩 페이지 선택 드롭다운
   - 선택 시 기본 URL 자동 입력

6. **고객 상세** (leads 페이지)
   - 유입 랜딩 페이지 표시
   - 설문 응답 표시
   - 마케팅 수신 동의 표시

### 빌드 결과
```
✓ Build 성공
✓ TypeScript 타입 검사 통과
✓ ESLint 통과

/lp           143 B (총 87.7 kB)  ← 동적 라우트
/admin       13.4 kB (총 160 kB)  ← 랜딩 페이지 + 광고 소재 탭 추가
/utm         17.4 kB (총 162 kB)  ← 소재 + 랜딩 페이지 선택 추가
```

### 다음 단계
⚠️ **DB 마이그레이션 필요**:
1. `supabase/migrations/20260315_landing_pages.sql` 실행
2. `supabase/migrations/20260315_ad_creatives.sql` 실행

---

## P8: 광고 소재 UTM 확장 및 어드민 메뉴 분리 (2026-03-15)

### 목표
1. 광고 소재에 전체 UTM 파라미터 저장 기능 추가
2. 어드민 관리 탭들을 별도 페이지로 분리 (UTM 생성기와 동일 위계)

### 데이터베이스 변경

#### ad_creatives 테이블 컬럼 추가
```sql
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
ALTER TABLE ad_creatives ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100);
```

### 신규/수정 파일

| 파일 | 작업 |
|------|------|
| `supabase/migrations/20260315_ad_creatives_utm.sql` | 신규 - UTM 컬럼 추가 마이그레이션 |
| `app/api/admin/ad-creatives/route.ts` | 수정 - UTM 파라미터 처리 추가 |
| `app/api/admin/ad-creatives/[id]/route.ts` | 수정 - UTM 파라미터 처리 추가 |
| `app/(dashboard)/admin/clinics/page.tsx` | 신규 - 병원 관리 페이지 |
| `app/(dashboard)/admin/users/page.tsx` | 신규 - 계정 관리 페이지 |
| `app/(dashboard)/admin/landing-pages/page.tsx` | 신규 - 랜딩 페이지 관리 |
| `app/(dashboard)/admin/ad-creatives/page.tsx` | 신규 - 광고 소재 관리 |
| `app/(dashboard)/admin/page.tsx` | 수정 - /admin/ad-creatives로 리다이렉트 |
| `app/(dashboard)/utm/page.tsx` | 수정 - 소재 선택 시 전체 UTM 자동 적용, clinic_id 저장 |
| `components/Sidebar.tsx` | 수정 - 메뉴 구조 변경 |

### 메뉴 구조 변경

**변경 전:**
```
슈퍼어드민
├── UTM 생성기
└── 어드민 관리 (탭: 병원/계정/랜딩페이지/소재)
```

**변경 후:**
```
슈퍼어드민
├── UTM 생성기
├── 광고 소재
├── 랜딩 페이지
├── 병원 관리
└── 계정 관리
```

### 주요 기능

#### 1. 광고 소재 전체 UTM 저장
- 소재 등록 시 utm_source, utm_medium, utm_campaign, utm_term 입력 가능
- UTM 생성기에서 소재 선택 시 모든 UTM 값 자동 적용

#### 2. UTM 생성기 개선
- 소재 선택 시 clinic_id 자동 저장 (링크 히스토리 저장에 사용)
- 소재에 설정된 UTM 파라미터 전체 자동 적용

#### 3. 페이지 분리 및 코드 품질 개선
- 각 관리 기능을 독립 페이지로 분리
- 로딩 상태 표시 추가
- API 에러 핸들링 추가
- toggleUser 에러 핸들링 추가

### 코드 리뷰 후 수정

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | toggleUser 에러 핸들링 없음 | try-catch 및 toast 메시지 추가 |
| 높음 | fetchData 에러 핸들링 없음 | try-catch 및 toast 에러 메시지 추가 |
| 중간 | 로딩 상태 없음 | loading 상태 및 "로딩 중..." 표시 추가 |

### 빌드 결과
```
/admin                 147 B (리다이렉트)
/admin/ad-creatives   3.77 kB (총 156 kB)
/admin/clinics        4.62 kB (총 134 kB)
/admin/landing-pages  3.1 kB (총 155 kB)
/admin/users          5.79 kB (총 153 kB)
/utm                  17.3 kB (총 162 kB)

✓ Build 성공
✓ TypeScript 타입 검사 통과
```

### 전체 플로우 (완성)
```
1. 광고 소재 등록 (/admin/ad-creatives)
   └─ UTM 파라미터 전체 입력 (source, medium, campaign, content, term)
   └─ 랜딩 페이지 연결
        ↓
2. UTM 생성기에서 소재 선택 (/utm)
   └─ 모든 UTM 값 자동 적용
   └─ clinic_id 자동 설정
        ↓
3. 링크 생성 & 저장
   └─ 생성된 URL 복사/QR 생성
   └─ 히스토리에 저장 (clinic_id 포함)
        ↓
4. 랜딩 페이지 유입 → 리드 수집
   └─ 설문 응답 custom_data JSONB 저장
   └─ landing_page_id 연결
        ↓
5. 리드 관리 (/leads)
   └─ 유입 랜딩 페이지 확인
   └─ 설문 응답 확인
```

---

## P9: 랜딩 페이지 Hydration 에러 수정 (2026-03-15)

### 목표
`/lp?id=X` 랜딩 페이지 접근 시 발생하는 React Hydration 에러 수정

### 문제 상황
```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

서버 컴포넌트에서 `dangerouslySetInnerHTML`로 HTML을 직접 렌더링할 때, 서버와 클라이언트 간 렌더링 불일치로 인해 Hydration 에러 발생

### 해결 방법
iframe 방식으로 변경하여 HTML을 별도 API에서 서빙

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/lp/page.tsx` | 서버 컴포넌트 → 클라이언트 컴포넌트, iframe 방식으로 변경 |
| `app/api/lp/render/route.ts` | 신규 - HTML 파일 서빙 API |

### 구현 상세

#### 1. 클라이언트 컴포넌트로 변경 (app/lp/page.tsx)
```tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LandingPageContent() {
  const searchParams = useSearchParams()
  const lpId = searchParams.get('id')
  const allParams = searchParams.toString()

  return (
    <iframe
      src={`/api/lp/render?${allParams}`}
      className="w-full h-screen border-0"
      title="Landing Page"
    />
  )
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <LandingPageContent />
    </Suspense>
  )
}
```

#### 2. HTML 렌더링 API (app/api/lp/render/route.ts)
```typescript
export async function GET(req: NextRequest) {
  const lpId = searchParams.get('id')

  // DB에서 랜딩 페이지 조회
  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('*, clinic:clinics(id, name)')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  // HTML 파일 읽기
  let htmlContent = fs.readFileSync(htmlPath, 'utf-8')

  // 데이터 주입 (window.__LP_DATA__)
  const dataScript = `
  <script>
    window.__LP_DATA__ = {
      clinicId: ${landingPage.clinic_id || 'null'},
      landingPageId: ${landingPage.id},
      clinicName: "${clinicName}"
    };
  </script>`

  htmlContent = htmlContent.replace('</head>', `${dataScript}</head>`)

  return new NextResponse(htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
```

### 장점
- Hydration 에러 완전 해결
- 모든 쿼리 파라미터 (UTM 포함) iframe에 전달
- 미들웨어 수정 불필요 (`/api` 경로는 이미 인증 제외)

### 빌드 결과
```
/lp              763 B (총 88.3 kB)
/api/lp/render   0 B (API 라우트)

✓ Build 성공
✓ TypeScript 타입 검사 통과
```

### 커밋
```
d0b4ae6 fix: 랜딩 페이지 Hydration 에러 수정
```

---

## 전체 시스템 플로우 (완성)

```
┌─────────────────────────────────────────────────────────────────┐
│                        슈퍼어드민 관리                           │
├─────────────────────────────────────────────────────────────────┤
│  1. 광고 소재 등록 (/admin/ad-creatives)                         │
│     └─ UTM 전체 입력 (source, medium, campaign, content, term)  │
│     └─ 랜딩 페이지 연결                                          │
│                              ↓                                   │
│  2. UTM 생성기 (/utm)                                            │
│     └─ 소재 선택 → 모든 UTM 값 자동 적용                          │
│     └─ 랜딩 페이지 URL 자동 생성                                  │
│     └─ QR 코드 생성/복사                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 플로우                             │
├─────────────────────────────────────────────────────────────────┤
│  3. 광고 클릭 → 랜딩 페이지 (/lp?id=X&utm_source=...&...)        │
│     └─ iframe으로 HTML 렌더링                                    │
│     └─ window.__LP_DATA__ 주입 (clinicId, landingPageId)        │
│                              ↓                                   │
│  4. 설문 진행 & 폼 제출                                          │
│     └─ /api/webhook/lead 호출                                   │
│     └─ custom_data (설문 응답) JSONB 저장                        │
│     └─ landing_page_id, UTM 파라미터 저장                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        리드 관리                                 │
├─────────────────────────────────────────────────────────────────┤
│  5. 리드 관리 (/leads)                                           │
│     └─ 유입 랜딩 페이지 표시                                      │
│     └─ 설문 응답 표시 (step1~5)                                  │
│     └─ 마케팅 수신 동의 표시                                      │
│     └─ 고객 여정 타임라인                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## P10: UTM 생성기 히스토리 UI 개선 및 코드 품질 개선 (2026-03-15)

### 목표
UTM 생성기에서 생성된 UTM 목록을 더 쉽게 확인하고 관리할 수 있도록 UI 개선 및 코드 품질 향상

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/(dashboard)/utm/page.tsx` | 히스토리 UI 개선, 코드 리팩토링 |

### UI 개선 사항

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| 기본 상태 | 접힘 | 펼침 |
| 제목 | "URL 히스토리" | "생성된 UTM 목록" |
| 검색 | 없음 | 라벨, 소스, 캠페인, 콘텐츠 검색 가능 |
| UTM 표시 | URL만 표시 | source, medium, campaign, content 태그 표시 |
| 시간 표시 | 날짜만 | 날짜 + 시간 상세 표시 |
| 액션 | 복사, 불러오기 | 복사, 불러오기, 열기 |

### 코드 품질 개선

| 우선순위 | 문제 | 수정 내용 |
|---------|------|----------|
| 높음 | 필터 로직 중복 (2곳) | `filteredLinks` useMemo 변수로 통합 |
| 높음 | 매 렌더링마다 필터링 재계산 | `useMemo`로 메모이제이션 적용 |
| 중간 | handleLoadLink 쿼리 파라미터 손실 | UTM 제외 후 기존 쿼리(`?id=X`) 보존 |
| 낮음 | 날짜 포맷 옵션 매번 생성 | `DATE_FORMAT_OPTIONS` 상수로 추출 |

### 구현 코드

#### 1. 필터링된 링크 메모이제이션
```typescript
const filteredLinks = useMemo(() => {
  if (!historySearch) return links
  const search = historySearch.toLowerCase()
  return links.filter(item =>
    item.label?.toLowerCase().includes(search) ||
    item.utm_source?.toLowerCase().includes(search) ||
    item.utm_campaign?.toLowerCase().includes(search) ||
    item.utm_content?.toLowerCase().includes(search) ||
    item.utm_medium?.toLowerCase().includes(search)
  )
}, [links, historySearch])
```

#### 2. handleLoadLink 쿼리 파라미터 보존
```typescript
function handleLoadLink(link: UtmLink) {
  try {
    const url = new URL(link.original_url)
    // UTM 파라미터를 제외한 기존 쿼리 파라미터 보존 (예: ?id=X)
    const baseParams = new URLSearchParams(url.search)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
      .forEach(p => baseParams.delete(p))
    const baseQuery = baseParams.toString()
    setBaseUrl(url.origin + url.pathname + (baseQuery ? '?' + baseQuery : ''))
    // ... 나머지 설정
  } catch {
    toast.error('URL 파싱 실패')
  }
}
```

#### 3. 날짜 포맷 상수
```typescript
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}
```

### 빌드 결과
```
/utm    17.8 kB (총 163 kB)

✓ Build 성공
✓ TypeScript 타입 검사 통과
```

### 커밋
```
de4ec90 feat: UTM 생성기 히스토리 UI 개선
add7816 refactor: UTM 생성기 코드 품질 개선
```

---

## 향후 작업 가능 항목

1. **추가 컴포넌트**: Popover, Tooltip, Progress, Slider
2. **테스트 추가**: Jest, React Testing Library
3. **Storybook**: 컴포넌트 문서화/테스트
4. **E2E 테스트**: Playwright
5. **성능 모니터링**: Web Vitals 측정
