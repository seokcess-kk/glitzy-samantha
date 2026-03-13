# Security Guidelines (CRITICAL)

## ⚠️ ENFORCEMENT: BLOCK
이 가이드라인 위반 시 코드 작성이 차단됩니다.

## Purpose
OWASP Top 10 및 의료 데이터 보안 요구사항을 준수하여 시스템을 보호합니다.

## When to Use
- 모든 API 엔드포인트 작성 시
- 사용자 입력 처리 시
- 인증/인가 로직 구현 시

---

## Quick Reference

### 1. 인증 검증 (Authentication)
```typescript
// 모든 보호된 API에서 세션 검증
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 인증된 사용자만 접근
}
```

### 2. 인가 검증 (Authorization)
```typescript
import { getClinicId, requireSuperAdmin } from '@/lib/session'

// 역할 기반 접근 제어
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  // 슈퍼어드민 전용 작업
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

// 리소스 소유권 검증
export async function PUT(req: NextRequest) {
  const clinicId = await getClinicId(req.url)
  const { resourceId } = await req.json()

  // 리소스가 해당 병원 소유인지 확인
  const { data } = await supabase
    .from('resources')
    .select('clinic_id')
    .eq('id', resourceId)
    .single()

  if (data?.clinic_id !== clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

### 3. 입력 검증 (Input Validation)
```typescript
import { z } from 'zod'

// Zod 스키마 정의
const CustomerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^01[0-9]-[0-9]{4}-[0-9]{4}$/),
  email: z.string().email().optional()
})

export async function POST(req: NextRequest) {
  const body = await req.json()

  // 검증
  const result = CustomerSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({
      error: 'Validation failed',
      details: result.error.flatten()
    }, { status: 400 })
  }

  // 검증된 데이터 사용
  const { name, phone, email } = result.data
}
```

### 4. SQL Injection 방지
```typescript
// ✅ Supabase 파라미터 바인딩 (안전)
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('name', userInput)  // 자동 이스케이프

// ✅ RPC 함수 사용 (안전)
const { data } = await supabase.rpc('search_customers', {
  search_term: userInput
})

// ❌ 절대 금지: 문자열 연결
const query = `SELECT * FROM customers WHERE name = '${userInput}'`
```

### 5. XSS 방지
```typescript
// React는 기본적으로 이스케이프하지만, 주의 필요

// ❌ 위험: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ 안전: 텍스트로 렌더링
<div>{userContent}</div>

// ✅ HTML 필요시: sanitize 라이브러리 사용
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### 6. CSRF 방지
```typescript
// Next.js API Route는 기본적으로 CSRF 토큰 불필요
// 단, 쿠키 기반 인증 시 SameSite 설정 확인

// lib/auth.ts
export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
}
```

### 7. 민감 데이터 보호
```typescript
// 환경변수로 시크릿 관리
const apiKey = process.env.GOOGLE_ADS_API_KEY

// 응답에서 민감 정보 제외
const { password, ...safeUser } = user
return NextResponse.json(safeUser)

// 로그에 민감 정보 제외
console.log('User login:', { id: user.id, email: user.email })
// ❌ console.log('User:', user)  // password 포함될 수 있음
```

---

## 보안 체크리스트

### API 엔드포인트
- [ ] 세션 검증 (`getServerSession`)
- [ ] 역할 검증 (`role === 'superadmin'`)
- [ ] 입력 검증 (Zod 스키마)
- [ ] clinic_id 격리
- [ ] 에러 메시지에 내부 정보 미포함

### 데이터 처리
- [ ] 파라미터 바인딩 (SQL Injection 방지)
- [ ] HTML 이스케이프 (XSS 방지)
- [ ] 민감 정보 로깅 제외

### 인증/인가
- [ ] 비밀번호 bcrypt 해싱
- [ ] JWT 시크릿 환경변수
- [ ] 세션 만료 설정
- [ ] HTTPS 강제 (프로덕션)

---

## DO ✅

```typescript
// ✅ 입력 검증 후 사용
const schema = z.object({ id: z.number().positive() })
const { id } = schema.parse(await req.json())

// ✅ 파라미터 바인딩
await supabase.from('users').select().eq('id', id)

// ✅ 에러 메시지 일반화
return NextResponse.json({ error: 'Not found' }, { status: 404 })

// ✅ 환경변수 사용
const secret = process.env.NEXTAUTH_SECRET
```

## DON'T ❌

```typescript
// ❌ 검증 없이 사용
const { id } = await req.json()
await supabase.from('users').delete().eq('id', id)

// ❌ 문자열 연결로 쿼리
const query = `DELETE FROM users WHERE id = ${id}`

// ❌ 상세한 에러 메시지
return NextResponse.json({
  error: `User with ID ${id} not found in table users`
})

// ❌ 시크릿 하드코딩
const secret = 'my-super-secret-key'

// ❌ 민감 정보 로깅
console.log('User data:', user)  // password, tokens 등 포함
```

---

## 의료 데이터 특별 요구사항

### 개인정보보호법/HIPAA 준수
- 환자 정보는 암호화 전송 (HTTPS)
- 접근 로그 기록 (audit trail)
- 최소 권한 원칙 적용
- 데이터 보존 기간 준수

### 접근 로깅
```typescript
// 민감 데이터 접근 시 로깅
async function logAccess(userId: string, resource: string, action: string) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    resource,
    action,
    timestamp: new Date().toISOString(),
    ip_address: req.headers.get('x-forwarded-for')
  })
}
```

---

## 위반 시 결과
- **데이터 유출**: 환자 개인정보 노출
- **법적 책임**: 개인정보보호법 위반 과태료
- **서비스 중단**: 보안 사고로 인한 신뢰 상실

**이 가이드라인은 반드시 준수해야 합니다.**
