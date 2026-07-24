-- 리드 재연락 관리 필드
-- next_contact_at:        실무자가 잡은 재연락 예정 시각. now 이하이면 "재연락 대상" 큐에 노출.
-- last_contacted_at:      리드 상태 변경(=처리) 시 best-effort 스탬프 — 마지막 연락/처리 시각.
-- contact_attempt_count:  향후 연락 시도 횟수 집계용(현재 스키마만 준비).
-- 주의: leads 테이블은 이미 RLS 활성(20260513) — 컬럼 추가는 테이블 정책을 그대로 상속.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_attempt_count INTEGER NOT NULL DEFAULT 0;

-- 오늘 재연락 대상(next_contact_at <= now) 조회용 — 예정일이 설정된 리드만
CREATE INDEX IF NOT EXISTS idx_leads_clinic_next_contact
  ON leads (clinic_id, next_contact_at)
  WHERE next_contact_at IS NOT NULL;
