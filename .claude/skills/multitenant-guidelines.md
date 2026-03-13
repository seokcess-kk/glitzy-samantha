# Multitenant Guidelines (CRITICAL)

## ⚠️ ENFORCEMENT: BLOCK
이 가이드라인 위반 시 코드 작성이 차단됩니다.

## Purpose
멀티테넌트 데이터 격리를 보장하여 병원 간 데이터 유출을 방지합니다.

## When to Use
- 모든 API Route 작성 시
- 데이터베이스 쿼리 작성 시
- 권한 검증 로직 구현 시

---

## 핵심 원칙

### 1. 모든 데이터는 clinic_id로 격리
```
슈퍼어드민 (Glitzy)
├── 병원 A (clinic_id: 1) ← 병원A 데이터만 접근
├── 병원 B (clinic_id: 2) ← 병원B 데이터만 접근
└── 병원 C (clinic_id: 3) ← 병원C 데이터만 접근
```

### 2. 역할 기반 접근 제어
| 역할 | 권한 |
|------|------|
| `superadmin` | 모든 병원 접근, 병원 스위처 사용 가능 |
| `clinic_admin` | 자신의 clinic_id 데이터만 접근 |

---

## Quick Reference

### 1. clinic_id 추출 (필수)
```typescript
// lib/session.ts 헬퍼 사용
import { getClinicId, requireSuperAdmin } from '@/lib/session'

export async function GET(req: NextRequest) {
  // 방법 1: 세션 또는 쿼리 파라미터에서 추출
  const clinicId = await getClinicId(req.url)
  if (!clinicId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 이제 clinicId로 데이터 필터링
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('clinic_id', clinicId)  // 필수!
}
```

### 2. 슈퍼어드민 전용 작업
```typescript
export async function POST(req: NextRequest) {
  // 슈퍼어드민 권한 검증
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 병원 생성, 계정 관리 등 슈퍼어드민 작업
}
```

### 3. 리소스 소유권 검증
```typescript
// lib/permissions.ts
import { canModifyBooking, canAccessCustomer } from '@/lib/permissions'

export async function PUT(req: NextRequest) {
  const { bookingId } = await req.json()
  const session = await getServerSession(authOptions)

  // 소유권 검증
  const { allowed, reason } = await canModifyBooking(bookingId, session.user)
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 403 })
  }

  // 수정 작업 진행
}
```

### 4. 프론트엔드 병원 선택
```typescript
// components/ClinicContext.tsx 사용
'use client'
import { useClinic } from '@/components/ClinicContext'

export function Dashboard() {
  const { selectedClinic, setSelectedClinic, clinics } = useClinic()

  // selectedClinic으로 API 호출
  const fetchData = () => {
    fetch(`/api/customers?clinicId=${selectedClinic}`)
  }
}
```

---

## 필수 검증 체크리스트

### API Route 작성 시
- [ ] `getClinicId()` 호출하여 clinic_id 추출
- [ ] clinic_id null 체크 및 401 응답
- [ ] 모든 SELECT 쿼리에 `.eq('clinic_id', clinicId)`
- [ ] 모든 INSERT에 `clinic_id` 필드 포함
- [ ] 모든 UPDATE/DELETE에 소유권 검증

### 데이터 수정 작업 시
- [ ] 리소스 존재 확인
- [ ] clinic_id 일치 확인
- [ ] 권한(role) 확인

---

## DO ✅

```typescript
// ✅ 항상 clinic_id 필터링
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('clinic_id', clinicId)

// ✅ INSERT 시 clinic_id 포함
await supabase.from('leads').insert({
  clinic_id: clinicId,
  name: leadName,
  source: 'website'
})

// ✅ UPDATE/DELETE 시 이중 검증
await supabase
  .from('customers')
  .update({ status: 'inactive' })
  .eq('id', customerId)
  .eq('clinic_id', clinicId)  // 소유권 검증
```

## DON'T ❌

```typescript
// ❌ CRITICAL: clinic_id 없이 전체 조회
const { data } = await supabase.from('customers').select('*')

// ❌ CRITICAL: 요청에서 받은 clinic_id 그대로 신뢰
const { clinicId } = await req.json()  // 위조 가능!
await supabase.from('data').select().eq('clinic_id', clinicId)

// ❌ CRITICAL: ID만으로 리소스 접근
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('id', bookingId)  // clinic_id 검증 없음!
```

---

## 올바른 패턴 vs 잘못된 패턴

### 고객 조회 API
```typescript
// ❌ 잘못된 구현
export async function GET(req: NextRequest) {
  const { data } = await supabase.from('customers').select('*')
  return NextResponse.json(data)
}

// ✅ 올바른 구현
export async function GET(req: NextRequest) {
  const clinicId = await getClinicId(req.url)
  if (!clinicId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Query error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

---

## 위반 시 결과
- **데이터 유출**: 다른 병원의 환자 정보 노출
- **HIPAA/개인정보보호법 위반**: 법적 책임
- **신뢰 손상**: 서비스 신뢰도 하락

**이 가이드라인은 반드시 준수해야 합니다.**
