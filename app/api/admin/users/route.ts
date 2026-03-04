import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { serverSupabase } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/session'

export async function GET() {
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = serverSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, clinic_id, is_active, created_at, clinic:clinics(name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, role, clinic_id } = await req.json()
  if (!username || !password) return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 })
  if (role === 'clinic_admin' && !clinic_id) return NextResponse.json({ error: '병원을 선택해주세요.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 10)
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash, role, clinic_id: role === 'superadmin' ? null : clinic_id })
    .select('id, username, role, clinic_id, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const isSuperAdmin = await requireSuperAdmin()
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, is_active } = await req.json()
  const supabase = serverSupabase()

  const { data, error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', id)
    .select('id, username, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
