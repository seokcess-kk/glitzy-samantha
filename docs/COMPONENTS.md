# MMI 컴포넌트 가이드

## 개요

MMI 대시보드는 **shadcn/ui** 기반의 커스텀 디자인 시스템을 사용합니다.
모든 컴포넌트는 다크 테마(글래스모피즘)가 기본 적용되어 있습니다.

---

## 디렉토리 구조

```
components/
├── ui/                    # shadcn/ui 컴포넌트
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── label.tsx
│   ├── skeleton.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   ├── dropdown-menu.tsx
│   └── sonner.tsx
│
├── common/                # 프로젝트 공용 컴포넌트
│   ├── page-header.tsx
│   ├── stats-card.tsx
│   ├── channel-badge.tsx
│   ├── status-badge.tsx
│   └── empty-state.tsx
│
├── charts/               # Recharts 코드 스플리팅 래퍼
│   └── index.tsx          # AreaChart, BarChart, PieChart, LineChart, ComposedChart 등
│
├── dashboard/            # 대시보드 섹션 컴포넌트
│   ├── today-summary.tsx  # 오늘 요약 (문의/예약/매출)
│   ├── kpi-section.tsx    # KPI 카드 6개 (비즈니스 흐름순)
│   └── spend-lead-trend.tsx # 광고비+리드 듀얼 축 차트
│
├── ads/                 # 광고 성과 페이지 컴포넌트
│   ├── ads-kpi-cards.tsx           # 8종 KPI 카드 (전기 대비 변화율)
│   ├── efficiency-trend-chart.tsx  # CPL·CPC·CTR 이중축 추이 차트
│   ├── platform-comparison-table.tsx # 매체별 성과 비교 테이블
│   ├── ads-funnel.tsx              # 노출→결제 5단계 퍼널
│   ├── campaign-ranking-table.tsx  # 캠페인 정렬·검색·CPC 상태 테이블
│   ├── day-of-week-analysis.tsx    # 요일별 리드 바 차트
│   ├── landing-page-performance.tsx # LP별 전환율 테이블
│   ├── ads-overview-tab.tsx        # 성과 개요 탭 레이아웃
│   ├── ads-campaign-tab.tsx        # 캠페인 분석 탭 레이아웃
│   └── CreativePerformance.tsx     # 소재별 성과 (기존)
│
├── admin/               # 관리자 전용 컴포넌트
│   └── ClinicApiConfigDialog.tsx  # 매체별 API 키 관리 다이얼로그
│
├── Sidebar.tsx            # 사이드바 네비게이션
├── ClinicContext.tsx      # 병원 선택 Context
└── Providers.tsx          # 전역 Provider
```

---

## UI 컴포넌트

### Button

```tsx
import { Button } from '@/components/ui/button'

// 기본
<Button>기본 버튼</Button>

// Variants
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="glass">Glass (커스텀)</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// 링크로 사용
<Button asChild>
  <a href="/path">링크</a>
</Button>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// 기본 (다크테마)
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
  </CardHeader>
  <CardContent>내용</CardContent>
</Card>

// Glass variant (글래스모피즘)
<Card variant="glass" className="p-4">
  내용
</Card>
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

// 기본 variants
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>

// 채널별 variants
<Badge variant="meta">Meta</Badge>
<Badge variant="google">Google</Badge>
<Badge variant="tiktok">TikTok</Badge>
<Badge variant="naver">Naver</Badge>
<Badge variant="kakao">Kakao</Badge>

// 상태별 variants
<Badge variant="success">성공</Badge>
<Badge variant="warning">주의</Badge>
<Badge variant="info">정보</Badge>
```

### Input

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 기본 (다크테마 자동 적용)
<div className="space-y-2">
  <Label>레이블</Label>
  <Input placeholder="입력하세요" />
</div>

// 타입별
<Input type="text" />
<Input type="password" />
<Input type="email" />
<Input type="number" />
<Input type="date" />
<Input type="datetime-local" />
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="선택하세요" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">옵션 1</SelectItem>
    <SelectItem value="option2">옵션 2</SelectItem>
  </SelectContent>
</Select>
```

### Table

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>컬럼 1</TableHead>
      <TableHead>컬럼 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>데이터 1</TableCell>
      <TableCell>데이터 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialog

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>제목</DialogTitle>
    </DialogHeader>
    <div>내용</div>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      <Button onClick={handleSave}>저장</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Toast (Sonner)

```tsx
import { toast } from 'sonner'

// 성공
toast.success('저장되었습니다.')

// 에러
toast.error('오류가 발생했습니다.')

// 정보
toast.info('안내 메시지')

// 로딩
toast.loading('처리 중...')
```

### Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// 로딩 상태
{loading ? (
  <Skeleton className="h-10 w-full" />
) : (
  <div>{data}</div>
)}
```

---

## 공용 컴포넌트

### PageHeader

```tsx
import { PageHeader } from '@/components/common'

<PageHeader
  title="페이지 제목"
  description="페이지 설명 (선택)"
  actions={
    <Button>액션 버튼</Button>
  }
/>
```

### ChannelBadge

```tsx
import { ChannelBadge } from '@/components/common'

// 채널명에 따라 자동으로 색상 결정
<ChannelBadge channel="Meta" />
<ChannelBadge channel="Google" />
<ChannelBadge channel="네이버" />
```

### StatusBadge

```tsx
import { StatusBadge } from '@/components/common'

<StatusBadge status="confirmed" />
<StatusBadge status="cancelled" />
```

### StatsCard

```tsx
import { StatsCard } from '@/components/common'
import { TrendingUp } from 'lucide-react'

// 기본
<StatsCard label="총 문의" value="150건" />

// 트렌드 표시 (전기 대비 %)
<StatsCard
  label="총 매출"
  value="₩5,000만"
  trend={{ value: 15.2, isPositive: true }}
/>

// 클릭 네비게이션
<StatsCard
  label="광고비"
  value="₩500만"
  onClick={() => router.push('/ads')}
/>

// 큰 사이즈 + 아이콘 + 서브타이틀 (오늘 요약용)
<StatsCard
  label="오늘 문의"
  value="5건"
  size="lg"
  icon={TrendingUp}
  subtitle="전일 대비 +2건"
  subtitleColor="positive"   // 'default' | 'positive' | 'negative'
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | required | 카드 라벨 |
| `value` | string \| number | required | 표시 값 |
| `loading` | boolean | false | 스켈레톤 표시 |
| `icon` | LucideIcon | - | 라벨 옆 아이콘 |
| `trend` | `{ value: number, isPositive: boolean }` | - | 증감 화살표 + 퍼센트 |
| `onClick` | `() => void` | - | 클릭 시 커서/호버 효과 |
| `subtitle` | string | - | value 아래 보조 텍스트 |
| `subtitleColor` | `'default' \| 'positive' \| 'negative'` | `'default'` | 서브타이틀 색상 |
| `size` | `'default' \| 'lg'` | `'default'` | lg: 큰 폰트 + 패딩 |

### EmptyState

```tsx
import { EmptyState } from '@/components/common'
import { FileX } from 'lucide-react'

<EmptyState
  icon={FileX}
  title="데이터가 없습니다"
  description="새 데이터를 추가하세요"
/>
```

---

## 대시보드 섹션 컴포넌트

대시보드 page.tsx를 섹션별로 분리한 컴포넌트들입니다.
각 컴포넌트는 `data`와 `loading` props로 독립 로딩이 가능합니다.

### TodaySummary

오늘 문의/예약/매출 3카드를 큰 사이즈로 표시합니다.

```tsx
import { TodaySummary } from '@/components/dashboard/today-summary'

<TodaySummary
  data={{
    leads: 5, bookings: 3, revenue: 3000000,
    leadsDiff: 2, bookingsDiff: -1, revenueDiff: 500000,
  }}
  loading={false}
/>
```

### KpiSection

6개 KPI를 비즈니스 흐름순(총 문의 → 예약 전환율 → 총 방문 → 총 매출 → 광고비 → ROAS)으로 표시합니다.

```tsx
import { KpiSection } from '@/components/dashboard/kpi-section'

<KpiSection
  data={kpiData}        // KPI API 응답 객체
  loading={false}
  onNavigate={(path) => router.push(path)}  // 카드 클릭 시 이동
/>
```

### SpendLeadTrend

광고비(Area) + 리드 수(Line) 듀얼 축 차트입니다.

```tsx
import { SpendLeadTrend } from '@/components/dashboard/spend-lead-trend'

<SpendLeadTrend
  data={[
    { date: '3/1', spend: 500000, leads: 12 },
    { date: '3/8', spend: 600000, leads: 15 },
  ]}
  loading={false}
/>
```

---

## 광고 성과 컴포넌트

`/ads` 페이지는 3탭 구조로 구성되어 있으며, 각 탭 컴포넌트가 독립적으로 데이터를 fetch합니다.

### 탭 구조

```
Tab 1: 성과 개요 (AdsOverviewTab)
  ├─ AdsKpiCards        — 8종 KPI (trend 포함)
  ├─ EfficiencyTrendChart — CPL·CPC·CTR 이중축 차트
  ├─ PlatformComparisonTable — 매체별 성과 테이블
  ├─ AdsFunnel          — 노출→결제 5단계 퍼널
  └─ grid 2열
     ├─ DayOfWeekAnalysis — 요일별 바 차트
     └─ LandingPagePerformance — LP별 전환율

Tab 2: 캠페인 분석 (AdsCampaignTab)
  ├─ 매체 필터 버튼
  ├─ CampaignRankingTable — 정렬·검색·CPC 상태
  └─ CreativePerformance — 소재별 성과

Tab 3: 매출 귀속 (AttributionView) — 변경 없음
```

### AdsKpiCards

```tsx
import AdsKpiCards from '@/components/ads/ads-kpi-cards'

<AdsKpiCards days="30" />
```

8개 카드: 총 광고비, 총 리드, CPL, ROAS, CPC, CTR, 리드→결제 전환율, CAC.
CPL/CPC/CAC는 역전 trend (감소=긍정).

### EfficiencyTrendChart

```tsx
import EfficiencyTrendChart from '@/components/ads/efficiency-trend-chart'

<EfficiencyTrendChart days="30" />
```

ComposedChart 이중 Y축: 좌축(₩) CPL Area + CPC Line, 우축(%) CTR Line.

### PlatformComparisonTable

```tsx
import PlatformComparisonTable from '@/components/ads/platform-comparison-table'

<PlatformComparisonTable days="30" />
```

매체별 8개 지표 테이블. 최저 CPL 하이라이트, ROAS 색상 분기, 하단 인사이트 텍스트.

### AdsFunnel

```tsx
import AdsFunnel from '@/components/ads/ads-funnel'

<AdsFunnel days="30" />
```

노출→클릭→리드→예약→결제 5단계 수평 바 퍼널. 최대 이탈 구간 자동 감지.

### CampaignRankingTable

```tsx
import CampaignRankingTable from '@/components/ads/campaign-ranking-table'

<CampaignRankingTable days="30" platformFilter="Meta" />
```

캠페인별 지출/클릭/노출/CPC/CTR. 헤더 클릭 정렬, CPC 상태 표시(🟢🟡🔴), 검색, 10건 단위 펼치기.

### DayOfWeekAnalysis

```tsx
import DayOfWeekAnalysis from '@/components/ads/day-of-week-analysis'

<DayOfWeekAnalysis days="30" />
```

7칼럼 BarChart. 최다 리드 요일 강조 색상, 바 위 CPL 라벨.

### LandingPagePerformance

```tsx
import LandingPagePerformance from '@/components/ads/landing-page-performance'

<LandingPagePerformance days="30" />
```

LP별 리드·결제 고객·전환율·매출. 활성/비활성 상태 표시.

---

## 차트 래퍼

`components/charts/index.tsx`에서 Recharts를 코드 스플리팅으로 제공합니다.

```tsx
import {
  AreaChart, BarChart, PieChart, LineChart, ComposedChart,
  ResponsiveContainer,
  Area, Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from '@/components/charts'
```

- 컨테이너 컴포넌트(`AreaChart`, `ComposedChart` 등)는 `dynamic()` import (SSR 비활성)
- 자식 컴포넌트(`Area`, `XAxis` 등)는 직접 re-export (번들 분리 불필요)
- `ComposedChart`: Area + Line 등 서로 다른 차트를 한 축에 결합할 때 사용

### 채널 색상 유틸

```tsx
import { getChannelColor, CHANNEL_COLORS } from '@/lib/channel-colors'

getChannelColor('Meta')    // → '#3b82f6'
getChannelColor('Google')  // → '#ef4444'
getChannelColor('unknown') // → '#64748b' (기본 slate)
```

---

## 스타일 가이드

### CSS 변수 (globals.css)

```css
:root {
  --background: 240 20% 5%;       /* 배경색 */
  --foreground: 214 32% 91%;      /* 텍스트 색상 */
  --primary: 239 84% 67%;         /* 브랜드 색상 */
  --border: 240 10% 15%;          /* 테두리 색상 */
  --radius: 0.75rem;              /* 기본 border-radius */
}
```

### 글래스모피즘 (glass-card)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
```

### 브랜드 색상

```
brand-50:  #eef2ff
brand-100: #e0e7ff
brand-400: #818cf8
brand-500: #6366f1  (Primary)
brand-600: #4f46e5
brand-700: #4338ca
brand-900: #1e1b4b
```

---

## 사용 패턴

### 데이터 로딩

```tsx
{loading ? (
  <div className="space-y-3">
    {Array(5).fill(0).map((_, i) => (
      <Skeleton key={i} className="h-12" />
    ))}
  </div>
) : data.length > 0 ? (
  <Table>...</Table>
) : (
  <EmptyState title="데이터가 없습니다" />
)}
```

### 폼 패턴

```tsx
<Card variant="glass" className="p-6">
  <form onSubmit={handleSubmit} className="space-y-4">
    <div className="space-y-2">
      <Label>필드명</Label>
      <Input value={value} onChange={e => setValue(e.target.value)} />
    </div>
    <Button type="submit" className="w-full bg-brand-600">
      제출
    </Button>
  </form>
</Card>
```

### 필터 버튼 그룹

```tsx
<div className="flex gap-2">
  {filters.map(filter => (
    <Button
      key={filter.key}
      variant={active === filter.key ? 'default' : 'glass'}
      size="sm"
      onClick={() => setActive(filter.key)}
      className={active === filter.key ? 'bg-brand-600' : ''}
    >
      {filter.label}
    </Button>
  ))}
</div>
```
