import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 서버 전용 (API routes) — RLS 우회, 서비스 롤 키 사용
export function serverSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// 클라이언트 전용 — RLS 적용, anon 키 사용
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
