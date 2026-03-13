// SQL to create press_coverage table in Supabase:
// CREATE TABLE press_coverage (
//   id bigserial primary key,
//   clinic_id int references clinics(id),
//   title text not null,
//   source text,
//   url text,
//   published_at timestamptz,
//   collected_at timestamptz default now(),
//   unique(clinic_id, url)
// );

import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'

export const GET = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const supabase = serverSupabase()

  let query = supabase
    .from('press_coverage')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200)

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
})
