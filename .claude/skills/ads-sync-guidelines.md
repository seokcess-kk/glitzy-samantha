# Ads Sync Guidelines

## Purpose
외부 광고 API(Google Ads, Meta, TikTok)와의 동기화 패턴을 일관되게 적용합니다.

## When to Use
- 광고 데이터 동기화 서비스 작성 시
- Cron Job 구현 시
- 새로운 광고 플랫폼 연동 시

---

## 아키텍처 개요

```
외부 API (Google/Meta/TikTok)
    ↓
lib/services/*Sync.ts (동기화 서비스)
    ↓
app/api/cron/sync-ads/route.ts (Cron 엔드포인트)
    ↓
Supabase: ad_campaign_stats, clinic_api_configs
    ↓
프론트엔드 대시보드
```

---

## Quick Reference

### 1. 광고 동기화 서비스 구조
```typescript
// lib/services/googleAdsSync.ts
import { createServiceClient } from '@/lib/supabase/server'

interface SyncResult {
  success: boolean
  clinicId: number
  recordsProcessed: number
  error?: string
}

export async function syncGoogleAds(clinicId: number): Promise<SyncResult> {
  const supabase = createServiceClient()

  try {
    // 1. API 설정 조회
    const { data: config } = await supabase
      .from('clinic_api_configs')
      .select('google_ads_customer_id, google_ads_refresh_token')
      .eq('clinic_id', clinicId)
      .single()

    if (!config?.google_ads_customer_id) {
      return { success: true, clinicId, recordsProcessed: 0 }
    }

    // 2. 외부 API 호출
    const campaigns = await fetchGoogleAdsCampaigns(config)

    // 3. 데이터 변환 및 저장
    const records = campaigns.map(c => ({
      clinic_id: clinicId,
      platform: 'google',
      campaign_id: c.id,
      campaign_name: c.name,
      impressions: c.metrics.impressions,
      clicks: c.metrics.clicks,
      cost: c.metrics.cost_micros / 1_000_000,
      conversions: c.metrics.conversions,
      date: new Date().toISOString().split('T')[0]
    }))

    // 4. Upsert (중복 방지)
    const { error } = await supabase
      .from('ad_campaign_stats')
      .upsert(records, {
        onConflict: 'clinic_id,platform,campaign_id,date'
      })

    if (error) throw error

    return { success: true, clinicId, recordsProcessed: records.length }
  } catch (error) {
    console.error(`Google Ads sync failed for clinic ${clinicId}:`, error)
    return {
      success: false,
      clinicId,
      recordsProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

### 2. Cron Job 엔드포인트
```typescript
// app/api/cron/sync-ads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleAds } from '@/lib/services/googleAdsSync'
import { syncMetaAds } from '@/lib/services/metaAdsSync'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Cron 인증 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 2. 활성 병원 목록 조회
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id')
    .eq('is_active', true)

  // 3. 병렬 동기화 (제한적)
  const results = []
  for (const clinic of clinics || []) {
    const [google, meta] = await Promise.all([
      syncGoogleAds(clinic.id),
      syncMetaAds(clinic.id)
    ])
    results.push({ clinicId: clinic.id, google, meta })
  }

  // 4. 결과 요약
  const summary = {
    totalClinics: results.length,
    successful: results.filter(r => r.google.success && r.meta.success).length,
    failed: results.filter(r => !r.google.success || !r.meta.success)
  }

  console.log('Sync completed:', summary)
  return NextResponse.json(summary)
}
```

### 3. API 설정 테이블
```typescript
// clinic_api_configs 스키마
interface ClinicApiConfig {
  clinic_id: number
  // Google Ads
  google_ads_customer_id: string | null
  google_ads_refresh_token: string | null  // 암호화 저장
  // Meta
  meta_ad_account_id: string | null
  meta_access_token: string | null  // 암호화 저장
  // TikTok
  tiktok_advertiser_id: string | null
  tiktok_access_token: string | null  // 암호화 저장
}
```

---

## DO ✅

- **Rate Limiting 준수**: 플랫폼별 API 제한 확인
- **토큰 갱신 처리**: OAuth refresh token 자동 갱신
- **Upsert 사용**: 중복 데이터 방지
- **에러 격리**: 한 병원 실패가 전체에 영향 주지 않도록
- **로깅**: 동기화 결과 상세 로깅

```typescript
// ✅ 에러 격리
for (const clinic of clinics) {
  try {
    await syncGoogleAds(clinic.id)
  } catch (error) {
    console.error(`Clinic ${clinic.id} sync failed:`, error)
    // 다음 병원 계속 처리
  }
}

// ✅ 토큰 갱신
async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })
  return response.json()
}
```

## DON'T ❌

- **토큰 하드코딩**: 환경변수 또는 암호화된 DB 저장
- **무제한 병렬 요청**: Rate limit 초과 위험
- **전체 실패 전파**: 한 병원 에러로 전체 중단
- **날짜 누락**: 집계 시 날짜 필터 필수

```typescript
// ❌ 잘못된 패턴 - 토큰 하드코딩
const accessToken = 'EAABsbCS...'

// ❌ 잘못된 패턴 - 무제한 병렬
await Promise.all(clinics.map(c => syncAll(c.id)))  // 수백 개 동시 요청

// ✅ 올바른 패턴 - 배치 처리
const batchSize = 5
for (let i = 0; i < clinics.length; i += batchSize) {
  const batch = clinics.slice(i, i + batchSize)
  await Promise.all(batch.map(c => syncAll(c.id)))
  await sleep(1000)  // Rate limit 방지
}
```

---

## vercel.json Cron 설정

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-ads",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/sync-press",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**주의**: Vercel Cron은 Production 환경에서만 실행됩니다.

---

## 테스트 방법

```bash
# 로컬에서 수동 테스트
curl -X POST http://localhost:3000/api/cron/sync-ads \
  -H "Authorization: Bearer $CRON_SECRET"

# 특정 병원만 테스트
curl -X POST http://localhost:3000/api/cron/sync-ads?clinicId=1 \
  -H "Authorization: Bearer $CRON_SECRET"
```
