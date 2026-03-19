# Implementation Plan: 병원별 광고 API 키 관리 시스템

**Status**: ⏳ Pending
**Started**: -
**Last Updated**: 2026-03-19

---

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 `npm run build && npm run lint` 실행
3. ⚠️ Quality Gate 전체 통과 확인
4. 📝 Notes 섹션에 이슈/학습 기록
5. ➡️ 모든 검증 통과 후 다음 Phase 진행

⛔ **빌드/린트 에러가 남은 상태로 다음 Phase 진행 금지**

---

## 📋 Overview

### 현재 문제
- 광고 동기화가 환경변수 1개 = 전체 병원 공통 1개 계정 구조
- 병원마다 다른 Meta/Google/TikTok 광고 계정 사용 → 현재 구조로는 불가
- `ad_campaign_stats`에 `clinic_id`는 있지만, 동기화 서비스가 `clinic_id`를 사용하지 않음

### 목표
병원별 × 매체별 API 키를 `clinic_api_configs` 테이블에서 관리하고, 슈퍼어드민이 관리 UI에서 설정/테스트/활성화할 수 있는 시스템

### 데이터 흐름 (변경 후)

```
슈퍼어드민 관리 UI
  └─ 병원 선택 → 매체별 API 키 입력 → [연결 테스트] 버튼
       ↓
clinic_api_configs 테이블
  ├─ clinic_id=1, platform=meta_ads    → { account_id, access_token }
  ├─ clinic_id=1, platform=google_ads  → { client_id, secret, token, customer_id, refresh }
  ├─ clinic_id=1, platform=tiktok_ads  → { advertiser_id, access_token }
  ├─ clinic_id=2, platform=meta_ads    → { account_id, access_token }
  └─ ...
       ↓
Cron (매일 03:00) → 활성 병원 순회 → 병원별 설정된 매체만 동기화
  └─ ad_campaign_stats (clinic_id 포함)
```

### Success Criteria
- [ ] 슈퍼어드민이 병원별로 Meta/Google/TikTok API 키를 입력할 수 있다
- [ ] 연결 테스트 버튼으로 API 키가 유효한지 즉시 확인할 수 있다
- [ ] Cron 동기화가 병원별 API 키로 각각 실행된다
- [ ] 환경변수 폴백: clinic_api_configs에 없으면 기존 환경변수 사용 (하위 호환)
- [ ] 수동 동기화("지금 데이터 수집") 버튼이 선택된 병원의 API 키로 동작한다
- [ ] API 키는 암호화되어 DB에 저장된다 (평문 저장 금지)

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| `clinic_api_configs` 테이블 재활용 | 이미 meta_capi, youtube/instagram_content에서 사용 중 | platform 키 네이밍 통일 필요 |
| API 키 암호화 (AES-256-GCM) | DB 유출 시 평문 노출 방지 | 암호화 키 관리 필요 (`API_ENCRYPTION_KEY` 환경변수) |
| 환경변수 폴백 유지 | clinic_api_configs 미설정 시 기존 환경변수로 동작 → 하위 호환 | 폴백 로직 추가 |
| 연결 테스트는 최소 API 호출 | 전체 캠페인 조회 대신 계정 정보만 확인 → 빠르고 안전 | 실제 데이터 수집과 다른 경로 |
| 동기화 시 병원별 순차 실행 | 병원 간 API rate limit 분리, 에러 격리 | 전체 동기화 시간 증가 |

---

## 🚀 Phase 1: DB + 암호화 유틸 (1h)

**Goal**: clinic_api_configs 마이그레이션 + API 키 암호화/복호화 유틸리티
**Status**: ⏳ Pending

### Tasks
- [ ] **1.1** `supabase/migrations/20260319_clinic_api_configs_ads.sql` 생성
  ```sql
  -- clinic_api_configs 테이블 (없으면 생성)
  CREATE TABLE IF NOT EXISTS clinic_api_configs (
    id SERIAL PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    last_test_result VARCHAR(20), -- 'success' | 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, platform)
  );
  CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_clinic ON clinic_api_configs(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_active ON clinic_api_configs(clinic_id, is_active);
  ```
  - platform 키: `meta_ads`, `google_ads`, `tiktok_ads` (기존 `meta_capi`, `youtube_content` 등과 공존)

- [ ] **1.2** `lib/crypto.ts` 생성 — API 키 암호화/복호화
  - `encryptApiConfig(config: object): string` — AES-256-GCM 암호화
  - `decryptApiConfig(encrypted: string): object` — 복호화
  - 환경변수: `API_ENCRYPTION_KEY` (32바이트 base64)
  - 키 없으면 경고 로그 + 평문 JSON 폴백 (개발환경 편의)

- [ ] **1.3** 빌드 검증

### Quality Gate ✋
- [ ] `npm run build && npm run lint` 통과
- [ ] 마이그레이션 SQL 문법 검증
- [ ] 암호화 → 복호화 라운드트립 정상

---

## 🚀 Phase 2: 관리 API (2h)

**Goal**: 병원별 API 키 CRUD + 연결 테스트 API
**Status**: ⏳ Pending
**의존성**: Phase 1

### Tasks
- [ ] **2.1** `app/api/admin/clinics/[id]/api-configs/route.ts` 생성
  - `withSuperAdmin` 래퍼
  - **GET**: 해당 병원의 전체 매체 설정 조회 (복호화 후 반환, access_token은 마스킹)
  - **POST**: 매체별 API 키 저장 (암호화 후 DB 저장)
    - body: `{ platform: 'meta_ads', config: { account_id, access_token } }`
    - `sanitizeString` 적용
    - upsert (clinic_id + platform UNIQUE)
  - **DELETE**: 매체 설정 삭제

- [ ] **2.2** `app/api/admin/clinics/[id]/api-configs/test/route.ts` 생성
  - `withSuperAdmin` 래퍼
  - **POST**: 연결 테스트
    - body: `{ platform: 'meta_ads' }`
    - 저장된 API 키를 복호화하여 실제 API 호출
    - 매체별 테스트 로직:
      - **Meta**: `GET /v19.0/{account_id}?fields=name,account_status` → 계정명 + 상태 반환
      - **Google**: `customer.query('SELECT customer.descriptive_name ...')` → 계정명 반환
      - **TikTok**: `GET /advertiser/info?advertiser_ids=[id]` → 광고주명 반환
    - 성공/실패 결과를 `clinic_api_configs.last_tested_at`, `last_test_result`에 업데이트
    - 응답: `{ success: true, accountName: '세레아의원 광고계정', platform: 'meta_ads' }`

- [ ] **2.3** 빌드 검증

### Quality Gate ✋
- [ ] `npm run build && npm run lint` 통과
- [ ] superadmin 외 접근 차단 확인
- [ ] API 키 암호화 저장 확인 (DB에 평문 없음)
- [ ] 마스킹 확인 (GET 응답에 access_token 전체 노출 안 됨)

---

## 🚀 Phase 3: 관리 UI (2.5h)

**Goal**: 슈퍼어드민 병원 관리에 매체별 API 키 설정 화면 추가
**Status**: ⏳ Pending
**의존성**: Phase 2

### Tasks
- [ ] **3.1** `components/admin/ClinicApiConfigDialog.tsx` 생성
  - Dialog (모달) 형태
  - 매체 탭: Meta / Google / TikTok
  - 각 매체별 입력 필드:
    - **Meta**: 광고 계정 ID (`act_xxx`), 액세스 토큰
    - **Google**: Client ID, Client Secret, Developer Token, Customer ID, Refresh Token
    - **TikTok**: Advertiser ID, Access Token
  - 각 매체별 [연결 테스트] 버튼 → 성공 시 계정명 표시 + 초록 뱃지, 실패 시 에러 메시지 + 빨간 뱃지
  - [저장] 버튼 → API 호출
  - 토큰 필드는 `type="password"` + 눈 아이콘 토글
  - 마지막 테스트 일시/결과 표시

- [ ] **3.2** `app/(dashboard)/admin/clinics/page.tsx` 수정
  - 병원 목록 테이블에 "API 설정" 컬럼 추가
  - 매체별 연결 상태 아이콘 (초록 체크/회색 미설정/빨간 실패)
  - 클릭 시 `ClinicApiConfigDialog` 열림

- [ ] **3.3** 빌드 검증 + 반복 수정 루프

### Quality Gate ✋
- [ ] `npm run build && npm run lint` 통과
- [ ] 연결 테스트 성공/실패 UI 피드백 확인
- [ ] 토큰 필드 마스킹 확인 (password 타입)
- [ ] 기존 병원 관리 기능 회귀 없음
- [ ] 모바일 반응형 확인

---

## 🚀 Phase 4: 동기화 서비스 리팩토링 (2h)

**Goal**: 광고 동기화를 병원별 API 키 기반으로 변경
**Status**: ⏳ Pending
**의존성**: Phase 2

### Tasks
- [ ] **4.1** `lib/services/adSyncManager.ts` 생성 — 병원별 동기화 오케스트레이터
  - `syncAllClinics(date?)`: 활성 병원 순회 → 병원별 설정된 매체만 동기화
  - `syncClinic(clinicId, date?)`: 특정 병원의 모든 매체 동기화
  - 로직:
    1. `clinic_api_configs`에서 `is_active=true` 설정 조회
    2. 설정 없는 병원은 환경변수 폴백 (하위 호환)
    3. 병원별 순차 실행 (rate limit 분리)
    4. 결과 집계: `{ clinicId, platform, count, error? }[]`

- [ ] **4.2** `lib/services/metaAds.ts` 수정
  - `fetchMetaAds(date, options?)` → `options: { clinicId, accountId, accessToken }`
  - 기존 환경변수 기본값 유지 (options 없으면 환경변수 사용)
  - `clinic_id`를 `ad_campaign_stats` upsert에 포함

- [ ] **4.3** `lib/services/googleAds.ts` 수정 — 동일 패턴

- [ ] **4.4** `lib/services/tiktokAds.ts` 수정 — 동일 패턴

- [ ] **4.5** `app/api/cron/sync-ads/route.ts` 수정
  - 기존: `fetchMetaAds()`, `fetchGoogleAds()`, `fetchTikTokAds()` 직접 호출
  - 변경: `syncAllClinics(yesterday)` 호출
  - 에러 알림: 병원별 실패 건 집계

- [ ] **4.6** `app/api/ads/sync/route.ts` 수정 (수동 동기화)
  - 선택된 `clinic_id`의 API 키로 동기화 실행
  - `syncClinic(clinicId)` 호출

- [ ] **4.7** `app/api/ads/stats/route.ts` 수정
  - `clinic_id` 필터 추가 (현재 누락 — 멀티테넌트 격리 위반)

- [ ] **4.8** 빌드 검증 + 반복 수정 루프

### Quality Gate ✋
- [ ] `npm run build && npm run lint` 통과
- [ ] clinic_api_configs에 설정된 병원: 해당 API 키로 동기화
- [ ] clinic_api_configs에 미설정 병원: 환경변수 폴백 동작
- [ ] ad_campaign_stats에 clinic_id 포함하여 저장
- [ ] 수동 동기화가 선택된 병원의 API 키로 동작
- [ ] 기존 Cron Job 정상 동작

---

## ⚠️ Risk Assessment

| Risk | 확률 | 영향 | 대응 |
|------|------|------|------|
| API 키 DB 유출 시 보안 | 낮 | 높 | AES-256-GCM 암호화, 환경변수로 암호화 키 관리 |
| 병원 수 증가 시 Cron 타임아웃 | 중 | 중 | 병원별 순차 실행, maxDuration=300 확장, 필요 시 QStash 분산 |
| Meta/Google 토큰 만료 | 중 | 중 | 시스템 사용자 토큰(Meta), Refresh Token(Google) 사용. 실패 시 last_test_result 업데이트 + 알림 |
| 환경변수 폴백과 clinic_api_configs 충돌 | 낮 | 중 | clinic_api_configs 우선, 명확한 우선순위 문서화 |
| ad_campaign_stats clinic_id 마이그레이션 | 낮 | 낮 | 이미 clinic_id 컬럼 존재 (시드 데이터에서 확인) |

---

## 🔄 Rollback Strategy

| Phase | 롤백 방법 |
|-------|----------|
| Phase 1 | 마이그레이션 revert (DROP TABLE IF EXISTS), crypto.ts 삭제 |
| Phase 2 | API 파일 삭제 |
| Phase 3 | 컴포넌트 삭제, clinics/page.tsx revert |
| Phase 4 | 서비스 파일 revert (git), adSyncManager.ts 삭제 |

---

## 📁 파일 변경 전체 목록

| Phase | 작업 | 파일 |
|-------|------|------|
| 1 | CREATE | `supabase/migrations/20260319_clinic_api_configs_ads.sql` |
| 1 | CREATE | `lib/crypto.ts` |
| 2 | CREATE | `app/api/admin/clinics/[id]/api-configs/route.ts` |
| 2 | CREATE | `app/api/admin/clinics/[id]/api-configs/test/route.ts` |
| 3 | CREATE | `components/admin/ClinicApiConfigDialog.tsx` |
| 3 | MODIFY | `app/(dashboard)/admin/clinics/page.tsx` |
| 4 | CREATE | `lib/services/adSyncManager.ts` |
| 4 | MODIFY | `lib/services/metaAds.ts` |
| 4 | MODIFY | `lib/services/googleAds.ts` |
| 4 | MODIFY | `lib/services/tiktokAds.ts` |
| 4 | MODIFY | `app/api/cron/sync-ads/route.ts` |
| 4 | MODIFY | `app/api/ads/sync/route.ts` |
| 4 | MODIFY | `app/api/ads/stats/route.ts` |

---

## 📊 Progress Tracking

| Phase | 작업 | 예상 시간 | 상태 |
|-------|------|----------|------|
| 1 | DB + 암호화 유틸 | 1h | ⏳ |
| 2 | 관리 API + 연결 테스트 | 2h | ⏳ |
| 3 | 관리 UI | 2.5h | ⏳ |
| 4 | 동기화 리팩토링 | 2h | ⏳ |
| | **합계** | **7.5h** | |

Phase 2~3은 병렬 가능 (API와 UI 독립 개발), Phase 4는 Phase 2 완료 후 시작.

---

## 📝 Notes & Learnings

- `clinic_api_configs` 테이블은 이미 meta_capi, youtube_content, instagram_content에서 사용 중 (metaCapi.ts, content/sync/route.ts)
- `ad_campaign_stats`에 `clinic_id` 컬럼 이미 존재 (시드 데이터에서 확인)
- 현재 동기화 서비스(metaAds/googleAds/tiktokAds)는 환경변수만 사용하고 clinic_id를 upsert에 포함하지 않음 → Phase 4에서 수정

---

## 📚 매체별 API 키 필드 정의

### Meta Ads
```json
{
  "account_id": "act_XXXXXXXXXX",
  "access_token": "EAAG..."
}
```
- 연결 테스트: `GET /v19.0/{account_id}?fields=name,account_status`

### Google Ads
```json
{
  "client_id": "xxx.apps.googleusercontent.com",
  "client_secret": "xxx",
  "developer_token": "xxx",
  "customer_id": "XXX-XXX-XXXX",
  "refresh_token": "xxx"
}
```
- 연결 테스트: `SELECT customer.descriptive_name FROM customer LIMIT 1`

### TikTok Ads
```json
{
  "advertiser_id": "XXXXXXXXX",
  "access_token": "xxx"
}
```
- 연결 테스트: `GET /advertiser/info?advertiser_ids=[id]`

### 환경변수 폴백 우선순위
```
1. clinic_api_configs 테이블 (is_active=true)  ← 최우선
2. 환경변수 (META_AD_ACCOUNT_ID 등)            ← 폴백
3. 없으면 해당 매체 스킵 (count=0)
```
