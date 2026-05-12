import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'
import { withSuperAdmin, apiError, apiSuccess } from '@/lib/api-middleware'
import { archiveBeforeDelete } from '@/lib/archive'
import {
  getSessionUser,
  canModifyBooking,
  isValidBookingStatus,
  isValidDate,
  parseId,
  sanitizeString,
} from '@/lib/security'
import { logActivity } from '@/lib/activity-log'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Bookings')

// demo_viewer는 bookings의 어떤 write도 수행 불가. GET은 fixture 반환.
// POST/PUT/PATCH/DELETE 상단에 동일한 차단 블록이 삽입됨.
async function blockDemoWrite(user: { role?: string }): Promise<Response | null> {
  if (user.role === 'demo_viewer') return new Response('demo mode: read-only', { status: 405 })
  return null
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError('Unauthorized', 401)

    if (user.role === 'demo_viewer') {
      const { demoBookings } = await import('@/lib/demo/fixtures/extras')
      const clinicId = await getClinicId(req.url)
      return apiSuccess(demoBookings(clinicId))
    }

    const supabase = serverSupabase()
    const clinicId = await getClinicId(req.url)

    let query = supabase
      .from('bookings')
      .select('*, customer:customers(id, name, phone_number, first_source, leads(id, utm_source, utm_campaign), consultations(*), payments(*))')
      .order('booking_datetime', { ascending: false })

    if (clinicId) query = query.eq('clinic_id', clinicId)

    const { data: bookings, error } = await query
    if (error) return apiError(error.message, 500)

    // lead_notes prefetch — booking별 customer_id → leads → lead_notes 조회 후 booking에 부착
    type AnyBooking = Record<string, unknown> & { customer?: { leads?: Array<{ id: number }> } | null }
    const bookingsList = (bookings || []) as AnyBooking[]

    const leadIdSet = new Set<number>()
    for (const b of bookingsList) {
      const leads = b.customer?.leads || []
      for (const l of leads) {
        if (typeof l?.id === 'number') leadIdSet.add(l.id)
      }
    }

    type LeadNoteRow = {
      id: number
      lead_id: number
      content: string
      created_by: number | null
      created_at: string
      updated_at: string | null
      author: { id: number; username: string } | { id: number; username: string }[] | null
    }
    const notesByLeadId = new Map<number, LeadNoteRow[]>()

    if (leadIdSet.size > 0) {
      const { data: notes } = await supabase
        .from('lead_notes')
        .select('id, lead_id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
        .in('lead_id', Array.from(leadIdSet))
        .order('created_at', { ascending: true })

      for (const n of (notes || []) as LeadNoteRow[]) {
        const arr = notesByLeadId.get(n.lead_id)
        if (arr) arr.push(n)
        else notesByLeadId.set(n.lead_id, [n])
      }
    }

    const bookingsWithNotes = bookingsList.map(b => {
      const leadIds = (b.customer?.leads || []).map(l => l.id)
      const lead_notes = leadIds
        .flatMap(id => notesByLeadId.get(id) || [])
        .sort((a, b2) => a.created_at.localeCompare(b2.created_at))
        .map(n => ({
          id: n.id,
          lead_id: n.lead_id,
          content: n.content,
          created_by: n.created_by,
          created_at: n.created_at,
          updated_at: n.updated_at,
          author: Array.isArray(n.author) ? (n.author[0] ?? null) : n.author,
        }))
      return { ...b, lead_notes }
    })

    return apiSuccess(bookingsWithNotes)
  } catch (err) {
    logger.error('예약 목록 조회 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// 예약 등록 (walk-in / 전화 예약)
export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError('Unauthorized', 401)
    const blocked = await blockDemoWrite(user)
    if (blocked) return blocked

    const supabase = serverSupabase()
    const clinicId = await getClinicId(req.url)
    const body = await req.json()
    const { name, phone_number, booking_datetime, source, notes } = body

    if (!phone_number) return apiError('전화번호는 필수입니다.', 400)

    const normalizedPhone = phone_number.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
    const targetClinicId = clinicId || user.clinic_id
    if (!targetClinicId) return apiError('병원 정보가 필요합니다.', 400)

    // 고객 조회 또는 생성
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone_number', normalizedPhone)
      .eq('clinic_id', targetClinicId)
      .maybeSingle()

    let customerId = existingCustomer?.id
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          phone_number: normalizedPhone,
          name: name ? sanitizeString(name, 50) : null,
          first_source: sanitizeString(source || 'walk-in', 50),
          clinic_id: targetClinicId,
        })
        .select('id')
        .single()
      if (customerError) return apiError(customerError.message, 500)
      customerId = newCustomer.id
    }

    // 예약 생성
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        clinic_id: targetClinicId,
        status: 'confirmed',
        booking_datetime: booking_datetime || new Date().toISOString(),
        notes: notes ? sanitizeString(notes, 1000) : null,
        created_by: Number(user.id),
      })
      .select('*, customer:customers(id, name, phone_number)')
      .single()

    if (bookingError) return apiError(bookingError.message, 500)

    await logActivity(supabase, {
      userId: user.id, clinicId: targetClinicId,
      action: 'booking_create', targetTable: 'bookings', targetId: booking.id,
      detail: { customer_id: customerId, status: 'confirmed' },
    })

    return apiSuccess(booking, 201)
  } catch (err) {
    logger.error('예약 등록 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// 예약 정보 수정 (상태, 일시, 메모)
export async function PUT(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError('Unauthorized', 401)
    const blocked = await blockDemoWrite(user)
    if (blocked) return blocked

    const body = await req.json()
    const { id, status, notes, booking_datetime } = body

    // ID 파싱 (문자열/숫자 모두 허용)
    const bookingId = parseId(id)
    if (!bookingId) {
      return apiError('유효한 예약 ID가 필요합니다.')
    }

    // 상태값 검증
    if (status !== undefined && !isValidBookingStatus(status)) {
      return apiError('유효하지 않은 예약 상태입니다.')
    }

    // 날짜 검증
    if (booking_datetime !== undefined && booking_datetime !== null && booking_datetime !== '') {
      if (!isValidDate(booking_datetime)) {
        return apiError('유효하지 않은 날짜 형식입니다.')
      }
    }

    // 권한 검증: 해당 booking의 clinic_id에 접근 가능한지 확인
    const accessCheck = await canModifyBooking(bookingId, user)
    if (!accessCheck.allowed) {
      return apiError(accessCheck.error || '권한이 없습니다.', 403)
    }

    const supabase = serverSupabase()
    const update: Record<string, unknown> = { updated_by: Number(user.id), updated_at: new Date().toISOString() }
    if (status !== undefined) update.status = status
    if (notes !== undefined) update.notes = sanitizeString(notes, 1000)
    if (booking_datetime !== undefined) update.booking_datetime = booking_datetime || null

    const { data, error } = await supabase
      .from('bookings')
      .update(update)
      .eq('id', bookingId)
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    await logActivity(supabase, {
      userId: user.id, clinicId: data.clinic_id,
      action: 'booking_update', targetTable: 'bookings', targetId: bookingId,
      detail: { status, notes: notes !== undefined, booking_datetime: booking_datetime !== undefined },
    })

    return apiSuccess(data)
  } catch (err) {
    logger.error('예약 수정 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// 예약 상태만 빠르게 변경
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return apiError('Unauthorized', 401)
    const blocked = await blockDemoWrite(user)
    if (blocked) return blocked

    const body = await req.json()
    const { id, status } = body

    // ID 파싱 (문자열/숫자 모두 허용)
    const bookingId = parseId(id)
    if (!bookingId) {
      return apiError('유효한 예약 ID가 필요합니다.')
    }

    if (!status || !isValidBookingStatus(status)) {
      return apiError('유효하지 않은 예약 상태입니다.')
    }

    // 권한 검증
    const accessCheck = await canModifyBooking(bookingId, user)
    if (!accessCheck.allowed) {
      return apiError(accessCheck.error || '권한이 없습니다.', 403)
    }

    const supabase = serverSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .update({ status, updated_by: Number(user.id), updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    await logActivity(supabase, {
      userId: user.id, clinicId: data.clinic_id,
      action: 'booking_status_change', targetTable: 'bookings', targetId: bookingId,
      detail: { status },
    })

    return apiSuccess(data)
  } catch (err) {
    logger.error('예약 상태 변경 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

// 예약 삭제 (superadmin 전용)
export const DELETE = withSuperAdmin(async (req: Request, { user }) => {
  try {
    const { searchParams } = new URL(req.url)
    const bookingId = parseId(searchParams.get('id'))
    if (!bookingId) return apiError('유효한 예약 ID가 필요합니다.', 400)

    const supabase = serverSupabase()

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, clinic_id, customer_id')
      .eq('id', bookingId)
      .single()
    if (!booking) return apiError('예약을 찾을 수 없습니다.', 404)

    await archiveBeforeDelete(supabase, 'bookings', bookingId, user.id, booking.clinic_id)
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId)
    if (error) return apiError(error.message, 500)

    await logActivity(supabase, {
      userId: user.id, clinicId: booking.clinic_id,
      action: 'booking_delete', targetTable: 'bookings', targetId: bookingId,
      detail: { customer_id: booking.customer_id },
    })

    return apiSuccess({ deleted: true })
  } catch (err) {
    logger.error('예약 삭제 실패', err)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
