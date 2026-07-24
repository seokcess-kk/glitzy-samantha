import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { ALL_LEAD_STATUSES } from '@/lib/lead-status'
import { createLogger } from '@/lib/logger'

const logger = createLogger('LeadsQueue')

// 작업 큐 표시 상한 — 오래된 순으로 이만큼만 노출(총 개수는 별도 count로 정확히 반환)
const DISPLAY_LIMIT = 500

/**
 * 리드 상태 통합 큐 API
 * GET /api/leads/queue?status=new,no_answer&staleHours=24
 * - status: 쉼표 구분 lead_status (미지정 시 전체)
 * - staleHours: 지정 시 created_at < now-Xh 인 리드만(미연락 aging)
 * 반환: 오래된 순(가장 오래 기다린 리드 우선) 최대 500건 + 전체 개수
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') return apiSuccess({ leads: [], total: 0, displayed: 0 })
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) return apiSuccess({ leads: [], total: 0, displayed: 0 })

  try {
    const supabase = serverSupabase()
    const url = new URL(req.url)
    const statuses = (url.searchParams.get('status') || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => (ALL_LEAD_STATUSES as readonly string[]).includes(s))
    const staleHoursRaw = url.searchParams.get('staleHours')
    const staleHours = staleHoursRaw ? Math.min(Math.max(Number(staleHoursRaw) || 0, 1), 720) : null
    const staleThreshold = staleHours ? new Date(Date.now() - staleHours * 3600000).toISOString() : null
    const callback = url.searchParams.get('callback') === 'due' ? 'due' : null
    const nowIso = new Date().toISOString()
    const ctx = { clinicId, assignedClinicIds }

    const BASE_COLS = 'id, customer_id, lead_status, created_at, custom_data, customer:customers(id, name, phone_number)'
    const CONTACT_COLS = 'next_contact_at, last_contacted_at, contact_attempt_count'
    const orderCol = callback === 'due' ? 'next_contact_at' : 'created_at'

    // 전체 개수 (동일 필터, 상한 없음)
    let countQ = supabase.from('leads').select('*', { count: 'exact', head: true })
    if (statuses.length) countQ = countQ.in('lead_status', statuses)
    if (staleThreshold) countQ = countQ.lt('created_at', staleThreshold)
    if (callback === 'due') countQ = countQ.lte('next_contact_at', nowIso).not('lead_status', 'in', '("booked","rejected")')
    const countP = applyClinicFilter(countQ, ctx)!

    // 목록 (연락 컬럼 포함 시도, 오래된/임박 순, 최대 500)
    let listQ = supabase.from('leads').select(`${BASE_COLS}, ${CONTACT_COLS}`)
    if (statuses.length) listQ = listQ.in('lead_status', statuses)
    if (staleThreshold) listQ = listQ.lt('created_at', staleThreshold)
    if (callback === 'due') listQ = listQ.lte('next_contact_at', nowIso).not('lead_status', 'in', '("booked","rejected")')
    const listP = applyClinicFilter(listQ, ctx)!.order(orderCol, { ascending: true }).limit(DISPLAY_LIMIT)

    const [countRes, listResFull] = await Promise.all([countP, listP])

    // 재연락 컬럼(마이그레이션 20260724) 미적용 + 재연락 필터 아님 → 기본 컬럼으로 폴백(B9 상태 큐 유지)
    type ListResult = { data: Record<string, unknown>[] | null; error: unknown }
    let listRes = listResFull as unknown as ListResult
    if (listRes.error && callback !== 'due') {
      let baseQ = supabase.from('leads').select(BASE_COLS)
      if (statuses.length) baseQ = baseQ.in('lead_status', statuses)
      if (staleThreshold) baseQ = baseQ.lt('created_at', staleThreshold)
      listRes = (await applyClinicFilter(baseQ, ctx)!.order('created_at', { ascending: true }).limit(DISPLAY_LIMIT)) as unknown as ListResult
    }

    if (countRes.error || listRes.error) {
      // 재연락(callback=due) 필터인데 컬럼 미적용(마이그레이션 20260724 전) → 빈 결과로 우아하게 처리
      // (인박스 dueCallbacks도 0이라 tile이 muted 상태이므로 사용자 영향 최소)
      if (callback === 'due') {
        logger.warn('재연락 큐 조회 건너뜀(마이그레이션 미적용 가능)', { clinicId })
        return apiSuccess({ leads: [], total: 0, displayed: 0 })
      }
      logger.error('리드 큐 조회 실패', countRes.error || listRes.error, { clinicId })
      return apiError('리드 큐 조회에 실패했습니다.', 500)
    }

    const leads = (listRes.data || []).map((l: Record<string, unknown>) => {
      const c = l.customer as { name?: string; phone_number?: string } | { name?: string; phone_number?: string }[] | null
      const customer = Array.isArray(c) ? c[0] : c
      const cd = (l.custom_data && typeof l.custom_data === 'object') ? (l.custom_data as Record<string, unknown>) : null
      return {
        id: l.id,
        name: (cd?.name as string) || customer?.name || '이름 없음',
        phone: customer?.phone_number || null,
        lead_status: l.lead_status,
        created_at: l.created_at,
        custom_data: l.custom_data,
        next_contact_at: (l.next_contact_at as string) ?? null,
        last_contacted_at: (l.last_contacted_at as string) ?? null,
        contact_attempt_count: (l.contact_attempt_count as number) ?? 0,
      }
    })

    return apiSuccess({ leads, total: countRes.count || 0, displayed: leads.length })
  } catch (err) {
    logger.error('리드 큐 조회 실패', err, { clinicId })
    return apiError('리드 큐 조회에 실패했습니다.', 500)
  }
})
