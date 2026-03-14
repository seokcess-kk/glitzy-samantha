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
