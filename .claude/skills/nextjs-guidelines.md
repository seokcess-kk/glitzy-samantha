# Next.js 14 App Router Guidelines

## Purpose
Next.js 14 App Router 패턴을 일관되게 적용하여 유지보수성과 성능을 보장합니다.

## When to Use
- 새로운 페이지/컴포넌트 생성 시
- API Route 작성 시
- 레이아웃 구조 변경 시

---

## Quick Reference

### 1. API Route 패턴
```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getClinicId, requireSuperAdmin } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const clinicId = await getClinicId(req.url)
    if (!clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('clinic_id', clinicId)

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

### 2. 서버 컴포넌트 (기본)
```typescript
// app/(dashboard)/page/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // 서버에서 데이터 페칭
  const data = await fetchData()

  return <div>{/* UI */}</div>
}
```

### 3. 클라이언트 컴포넌트
```typescript
// components/ClientComponent.tsx
'use client'

import { useState, useEffect } from 'react'
import { useClinic } from '@/components/ClinicContext'

export function ClientComponent() {
  const { selectedClinic } = useClinic()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (selectedClinic) {
      fetch(`/api/resource?clinicId=${selectedClinic}`)
        .then(res => res.json())
        .then(setData)
    }
  }, [selectedClinic])

  return <div>{/* UI */}</div>
}
```

### 4. 그룹 라우트 구조
```
app/
├── (dashboard)/        # 인증 필요 페이지 그룹
│   ├── layout.tsx      # 공통 대시보드 레이아웃
│   ├── page.tsx        # /
│   ├── customers/      # /customers
│   └── settings/       # /settings
├── login/              # 공개 페이지
└── api/                # API 라우트
```

---

## DO ✅

- **Server Components 우선**: 가능하면 서버 컴포넌트 사용
- **Metadata 설정**: 각 페이지에 적절한 metadata export
- **Error Boundary**: error.tsx 파일로 에러 처리
- **Loading UI**: loading.tsx로 로딩 상태 표시
- **Parallel Routes**: 독립적인 섹션은 @folder 사용

```typescript
// 올바른 metadata 설정
export const metadata = {
  title: '고객 관리 | MMI',
  description: '병원 고객 데이터 관리'
}
```

## DON'T ❌

- **불필요한 'use client'**: 서버에서 처리 가능한 로직에 사용 금지
- **API Route에서 redirect()**: NextResponse.redirect() 사용
- **getServerSideProps**: App Router에서는 직접 async 컴포넌트 사용
- **pages 디렉토리 혼용**: App Router만 사용

```typescript
// ❌ 잘못된 패턴
export async function getServerSideProps() { ... }

// ✅ 올바른 패턴
export default async function Page() {
  const data = await fetchData()
  return <Component data={data} />
}
```

---

## 파일 명명 규칙

| 파일명 | 용도 |
|--------|------|
| `page.tsx` | 라우트 UI |
| `layout.tsx` | 공유 레이아웃 |
| `loading.tsx` | 로딩 UI |
| `error.tsx` | 에러 UI |
| `not-found.tsx` | 404 UI |
| `route.ts` | API 엔드포인트 |
