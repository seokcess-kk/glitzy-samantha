-- 리드 메모 히스토리 — 단일 leads.notes 컬럼을 다건 lead_notes 테이블로 분리
-- 기존 leads.notes 데이터는 1차 메모(가장 오래된 시점)로 이관 후 컬럼 제거

CREATE TABLE IF NOT EXISTS lead_notes (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  clinic_id   INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id_created_at
  ON lead_notes (lead_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_clinic_id
  ON lead_notes (clinic_id);

-- 기존 단일 메모를 1차 메모로 이관 (updated_by가 있으면 작성자, 없으면 NULL)
-- leads 테이블에는 updated_at이 없으므로 created_at만 사용
INSERT INTO lead_notes (lead_id, clinic_id, content, created_by, created_at, updated_at)
SELECT
  id,
  clinic_id,
  notes,
  updated_by,
  COALESCE(created_at, now()),
  NULL
FROM leads
WHERE notes IS NOT NULL AND trim(notes) <> '';

-- 단일 메모 컬럼 제거
ALTER TABLE leads DROP COLUMN IF EXISTS notes;
