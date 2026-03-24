# lib/ 핵심 유틸리티 규칙

## 인증 흐름 (lib/auth.ts)

```
사용자 → NextAuth Credentials → authorize()
  ├─ Rate Limit: IP:username 키, 15분/5회 (lib/rate-limit.ts)
  ├─ DB 사용자 조회 + bcrypt 검증
  ├─ 로그인 로그 기록 (login_logs, non-blocking)
  └─ JWT 발급 (password_version 포함)
```

- 세션 무효화: 비밀번호 변경 → `password_version` 증가 → `getAuthUser()`에서 불일치 시 401
- IP/UA 전달: `route.ts`에서 `setRequestContext()` → `authorize()`에서 사용
- 미들웨어(`middleware.ts`): 인증 불필요 경로 = `api/`, `login`, `lp`

## 환경변수

### 필수
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `CRON_SECRET` (Cron Job 인증)

### 선택 (서비스별)
- 광고: `GOOGLE_ADS_*`, `META_*`, `TIKTOK_*`
- 콘텐츠: `YOUTUBE_API_KEY`, `KAKAO_REST_API_KEY`
- AI: `ANTHROPIC_API_KEY`
- SMS: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- 메시징: `QSTASH_*`, `KAKAO_*`
- 뉴스: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (네이버 뉴스 검색 API)
- 에러 알림: `ADMIN_ALERT_PHONES` (프로덕션 에러 SMS 수신 번호)

## DB 핵심 테이블

| 테이블 | 용도 | 비고 |
|--------|------|------|
| `clinics` | 병원 고객사 | `notify_phones TEXT[]` 최대 3개 |
| `users` | 로그인 계정 | role: superadmin/agency_staff/clinic_admin/clinic_staff |
| `customers` | 고객 (CDP) | `phone_number`로 식별 |
| `leads` | 리드/문의 | UTM, `landing_page_id`, `updated_by` |
| `bookings` | 예약 | `created_by`, `updated_by` |
| `consultations` | 상담 | `created_by`, `updated_by` |
| `payments` | 결제 | `created_by` |
| `ad_campaign_stats` | 광고 통계 | 일별 집계 |
| `clinic_api_configs` | 병원별 광고 API 키 | |
| `landing_pages` | 랜딩 페이지 | 8자리 랜덤 ID |
| `lead_raw_logs` | 리드 원본 로그 | 멱등성 키로 유실 방지 |
| `sms_send_logs` | SMS 발송 로그 | status: sent/retrying/failed |
| `activity_logs` | 활동 이력 | 누가 무엇을 변경했는지 |
| `user_clinic_assignments` | agency_staff 병원 배정 | |
| `user_menu_permissions` | agency_staff 메뉴 권한 | |
| `monitoring_keywords` | 순위 모니터링 키워드 | place/website/smartblock |
| `monitoring_rankings` | 일별 순위 데이터 | keyword_id + rank_date UNIQUE |
| `login_logs` | 로그인 시도 이력 | IP, success, failure_reason |
| `deleted_records` | 삭제 데이터 스냅샷 보관 | 감사/복구용 |
| `capi_events` | Meta CAPI 전송 로그 | status: pending/success/fail, event_id로 중복 제거 |
| `clinic_treatments` | 병원별 시술 메뉴 카탈로그 | POS형 결제 입력용, UNIQUE(clinic_id, name) |
| `press_coverage` | 언론보도 기사 | Google News RSS 수집, UNIQUE(clinic_id, url) |
| `press_keywords` | 언론보도 검색 키워드 | 병원당 최대 5개, UNIQUE(clinic_id, keyword) |
| `mc_law_articles` | 의료광고법 조문 (공용) | 15개 법조문, keywords 정규식 패턴 |
| `mc_procedures` | 의료 시술 정보 (공용) | 50개 시술, aliases/부작용/규제 |
| `mc_relations` | 법령-시술 온톨로지 관계 (공용) | 8종 관계 타입, 1홉 탐색 |
| `mc_chunks` | RAG 임베딩 청크 (공용) | pgvector 1536차원, pg_trgm 키워드 |
| `mc_verification_logs` | 광고 검증 이력 (테넌트) | clinic_id + user_id 추적, violations JSONB |

## SMS 발송 (lib/solapi.ts)

- `sendSmsWithLog()`: 발송 + DB 로그 기록. 실패 시 `logId` 반환
- 실패 시 `/api/qstash/sms-retry`로 자동 재시도 (최대 3회, 3분→5분 간격)
- 병원별 알림 연락처: `clinics.notify_phones TEXT[]` 최대 3개

## 유틸리티 모듈 요약

| 모듈 | 핵심 export | 용도 |
|------|------------|------|
| `api-middleware.ts` | `withAuth`, `withClinicFilter`, `apiSuccess`, `apiError` | API 인증/필터 래퍼 |
| `security.ts` | `parseId`, `sanitizeString`, `canModifyBooking` | 입력 검증/권한 체크 |
| `logger.ts` | `createLogger` | 환경별 로깅 (dev=readable, prod=JSON) |
| `api-client.ts` | `fetchJSON`, `fetchWithRetry` | 외부 API 호출 (재시도+타임아웃) |
| `utm.ts` | `parseUtmFromUrl`, `sanitizeUtmParams`, `mergeUtmParams` | UTM 파싱/검증 |
| `activity-log.ts` | `logActivity` | 활동 이력 기록 (non-blocking) |
| `solapi.ts` | `sendSmsWithLog` | SMS 발송 + 로그 |
| `rate-limit.ts` | Rate Limit | IP:username 기반 제한 |
| `error-alert.ts` | `sendErrorAlert` | 프로덕션 에러 → 관리자 SMS (쿨다운 5분, 일일 50건) |
| `archive.ts` | `archiveBeforeDelete`, `archiveBulkBeforeDelete` | 삭제 전 스냅샷 보관 |
| `channel.ts` | `normalizeChannel` | utm_source → canonical 채널명 (Meta, Google 등) |
| `channel-colors.ts` | `getChannelColor` | 채널별 Recharts 색상 코드 |
| `date.ts` | `formatDate`, `getKstDateString`, `getKstDayStartISO` | KST 기준 날짜 포맷/생성 |
| `services/metaCapi.ts` | Meta CAPI 전송 | 리드 유입 시 서버사이드 전환 이벤트 전송 |
| `services/pressSync.ts` | `syncPressForClinic` | 언론보도 수집 (다중 키워드 → Google News RSS → upsert) |
| `services/erpClient.ts` | `fetchQuotes`, `fetchInvoices` 등 | glitzy-web ERP 외부 API 프록시 (fetchJSON 기반) |
| `medichecker/types.ts` | 전체 타입 정의 | VerifyRequest, Violation, VerifyResult, Chunk, LawArticle 등 |
| `medichecker/verification.ts` | `verify` | 7단계 파이프라인 오케스트레이터 (SSE 진행 콜백) |
| `medichecker/rag.ts` | `hybridSearch` | pgvector 시맨틱 + pg_trgm 키워드 RRF 결합 |
| `medichecker/ontology.ts` | `enrichContext` | 1홉 관계 탐색, 시술 특화 정보 |
| `medichecker/analysis.ts` | `scanKeywords`, `classifyContent` | 키워드 스캔 + Claude Haiku 분류 |
| `medichecker/claude-client.ts` | `judgeViolation`, `verifySelf` | Claude Sonnet/Haiku API 래퍼 |
| `medichecker/embedding.ts` | `embeddingProvider` | OpenAI text-embedding-3-small |
| `medichecker/highlight.ts` | `findViolationRanges` | 위반 텍스트 위치 4단계 매칭 |
| `medichecker/risk-level.ts` | `getRiskLevel` | 위험도 점수 → 라벨/색상/배지 매핑 (공용) |
