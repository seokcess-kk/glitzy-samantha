# Supabase Guidelines

## Purpose
Supabase 쿼리 패턴을 일관되게 적용하여 데이터 무결성과 성능을 보장합니다.

## When to Use
- 데이터베이스 쿼리 작성 시
- 테이블 스키마 변경 시
- RLS 정책 관련 작업 시

---

## Quick Reference

### 1. 서버 클라이언트 생성
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { ... } }
  )
}

// Service Role 클라이언트 (서버 전용)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

### 2. 기본 CRUD 패턴
```typescript
// SELECT with clinic_id filter (필수!)
const { data, error } = await supabase
  .from('customers')
  .select('id, name, phone, created_at')
  .eq('clinic_id', clinicId)
  .order('created_at', { ascending: false })

// INSERT
const { data, error } = await supabase
  .from('customers')
  .insert({
    clinic_id: clinicId,  // 필수!
    name: 'John',
    phone: '010-1234-5678'
  })
  .select()
  .single()

// UPDATE with ownership check
const { data, error } = await supabase
  .from('customers')
  .update({ name: 'Jane' })
  .eq('id', customerId)
  .eq('clinic_id', clinicId)  // 필수!
  .select()
  .single()

// DELETE with ownership check
const { error } = await supabase
  .from('customers')
  .delete()
  .eq('id', customerId)
  .eq('clinic_id', clinicId)  // 필수!
```

### 3. 조인 쿼리
```typescript
// Foreign key 관계 조인
const { data, error } = await supabase
  .from('bookings')
  .select(`
    id,
    date,
    status,
    customer:customers(id, name, phone),
    staff:users(id, name)
  `)
  .eq('clinic_id', clinicId)

// 결과 구조
// { id, date, status, customer: { id, name, phone }, staff: { id, name } }
```

### 4. 집계 쿼리
```typescript
// 카운트
const { count, error } = await supabase
  .from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('clinic_id', clinicId)
  .eq('status', 'new')

// 날짜 범위 필터
const { data, error } = await supabase
  .from('payments')
  .select('amount')
  .eq('clinic_id', clinicId)
  .gte('created_at', startDate)
  .lte('created_at', endDate)
```

### 5. 에러 처리
```typescript
const { data, error } = await supabase.from('table').select()

if (error) {
  console.error('Supabase error:', {
    message: error.message,
    code: error.code,
    details: error.details
  })
  throw new Error(`Database error: ${error.message}`)
}

if (!data || data.length === 0) {
  return { data: [], count: 0 }
}
```

---

## DO ✅

- **항상 clinic_id 필터**: 모든 쿼리에 멀티테넌트 필터 적용
- **select() 명시**: 필요한 컬럼만 선택 (성능)
- **에러 로깅**: error 객체 전체 로깅
- **트랜잭션 대안**: 여러 쿼리 시 RPC 함수 사용 고려

```typescript
// ✅ 필요한 컬럼만 선택
.select('id, name, email, created_at')

// ✅ 페이지네이션
.range(0, 9)  // 10개 항목
```

## DON'T ❌

- **select('*') 남용**: 불필요한 데이터 전송
- **clinic_id 누락**: 데이터 유출 위험
- **Service Role 클라이언트 노출**: 서버 사이드에서만 사용
- **N+1 쿼리**: 조인으로 해결

```typescript
// ❌ 잘못된 패턴 - clinic_id 누락
const { data } = await supabase.from('customers').select('*')

// ❌ 잘못된 패턴 - N+1 쿼리
for (const booking of bookings) {
  const customer = await supabase.from('customers').select().eq('id', booking.customer_id)
}

// ✅ 올바른 패턴 - 조인 사용
const { data } = await supabase
  .from('bookings')
  .select('*, customer:customers(*)')
  .eq('clinic_id', clinicId)
```

---

## 핵심 테이블 스키마 참고

| 테이블 | 주요 컬럼 | 관계 |
|--------|----------|------|
| `clinics` | id, name, settings | - |
| `users` | id, email, role, clinic_id | → clinics |
| `customers` | id, name, phone, clinic_id | → clinics |
| `leads` | id, source, status, clinic_id | → clinics |
| `bookings` | id, customer_id, date, clinic_id | → customers, clinics |
| `payments` | id, booking_id, amount, clinic_id | → bookings, clinics |
