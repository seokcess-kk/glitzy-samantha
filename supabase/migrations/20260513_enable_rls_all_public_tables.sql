-- 모든 public 스키마 테이블에 RLS(Row Level Security) 활성화
--
-- 배경: Supabase Linter `rls_disabled_in_public` 경고 일괄 해소.
-- 현재 Samantha 아키텍처:
--   - 모든 DB 접근은 lib/supabase.ts:serverSupabase() (service_role 키) 사용
--   - service_role은 RLS를 자동으로 우회 → Samantha 자체 동작에는 영향 0
--   - 클라이언트(브라우저)에서 anon 키로 Supabase를 직접 호출하는 코드 없음
--   - lib/supabase.ts:18의 `export const supabase`(anon 클라이언트)는 미사용
--
-- 효과: anon 키(NEXT_PUBLIC_SUPABASE_ANON_KEY는 브라우저에 노출됨)로
-- PostgREST에 직접 요청해 모든 데이터를 읽어가는 외부 공격 표면 차단.
--
-- 정책(POLICY)은 의도적으로 추가하지 않음:
--   - RLS 활성화 + 정책 없음 = anon/authenticated 모두 접근 0행
--   - service_role은 BYPASSRLS 속성으로 무조건 통과
--   - 향후 클라이언트 직접 접근이 필요하면 그때 명시적 정책 추가

-- 핵심 도메인 (멀티테넌트 데이터)
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_raw_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 권한/배정
ALTER TABLE public.user_clinic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- 광고 통계/소재/설정
ALTER TABLE public.ad_campaign_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- 시술/메뉴
ALTER TABLE public.clinic_treatments ENABLE ROW LEVEL SECURITY;

-- 콘텐츠/언론보도
ALTER TABLE public.content_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_keywords ENABLE ROW LEVEL SECURITY;

-- 순위 모니터링
ALTER TABLE public.monitoring_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_rankings ENABLE ROW LEVEL SECURITY;

-- UTM
ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_templates ENABLE ROW LEVEL SECURITY;

-- 로그/감사
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;

-- 통합/외부 연동
ALTER TABLE public.capi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- 시스템 설정
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- MediChecker (공용 데이터 + 테넌트 로그)
ALTER TABLE public.mc_law_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_verification_logs ENABLE ROW LEVEL SECURITY;

-- 누락 안전망: 위 명시 목록에 없는 public 테이블이 있다면 동적으로 활성화
-- (마이그레이션 누락/스키마 변경 대비)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
