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

## 향후 작업 가능 항목

1. **추가 컴포넌트**: Popover, Tooltip, Progress, Slider
2. **테스트 추가**: Jest, React Testing Library
3. **Storybook**: 컴포넌트 문서화/테스트
4. **E2E 테스트**: Playwright
5. **성능 모니터링**: Web Vitals 측정
