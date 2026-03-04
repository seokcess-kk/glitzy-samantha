import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/session'

export async function GET() {
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: '병원명과 슬러그를 입력해주세요.' }, { status: 400 })

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('clinics')
    .insert({ name, slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
