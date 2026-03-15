import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase'
import { getClinicId } from '@/lib/session'
import { apiError, apiSuccess } from '@/lib/api-middleware'
import {
  getSessionUser,
  canModifyBooking,
  isValidBookingStatus,
  isValidDate,
  parseId,
  sanitizeString,
} from '@/lib/security'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)

  let query = supabase
    .from('bookings')
    .select('*, customer:customers(id, name, phone_number, first_source, consultations(*), payments(*))')
    .order('booking_datetime', { ascending: false })

  if (clinicId) query = query.eq('clinic_id', clinicId)

  const { data, error } = await query
  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

// 예약 등록 (walk-in / 전화 예약)
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)

  const supabase = serverSupabase()
  const clinicId = await getClinicId(req.url)
  const body = await req.json()
  const { name, phone_number, booking_datetime, source, notes } = body

  if (!phone_number) return apiError('전화번호는 필수입니다.', 400)

  const normalizedPhone = phone_number.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
  const targetClinicId = clinicId || (user as any).clinic_id
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
    })
    .select('*, customer:customers(id, name, phone_number)')
    .single()

  if (bookingError) return apiError(bookingError.message, 500)

  return apiSuccess(booking, 201)
}

// 예약 정보 수정 (상태, 일시, 메모)
export async function PUT(req: Request) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)

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
  const update: Record<string, unknown> = {}
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
  return apiSuccess(data)
}

// 예약 상태만 빠르게 변경
export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return apiError('Unauthorized', 401)

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
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
