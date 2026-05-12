import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'
import { normalizeChannel } from '@/lib/channel'

/**
 * 캠페인별 리드 목록 API
 * - 캠페인 중심 뷰: 캠페인별 리드 수, 최신 리드 시각, 채널, 랜딩페이지
 * - clinic_admin: 자기 병원만 / superadmin: 전체 또는 clinic_id 필터
 * - ?campaign=xxx 시 해당 캠페인 리드 상세 목록 반환
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoCampaigns } = await import('@/lib/demo/fixtures/extras')
    return apiSuccess(demoCampaigns(clinicId))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const campaign = url.searchParams.get('campaign')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // Timestamp columns: KST midnight [start, end) pattern
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null
  const tsStart = dateStart ? `${dateStart}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateEnd) {
    const d = new Date(dateEnd + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  // 특정 캠페인의 리드 상세 목록
  if (campaign) {
    let query = supabase
      .from('leads')
      .select(`
        id, customer_id, utm_source, utm_medium, utm_campaign, utm_content,
        chatbot_sent, chatbot_sent_at, created_at, landing_page_id, custom_data, lead_status,
        customer:customers(id, name, phone_number, first_source),
        landing_page:landing_pages(id, name)
      `)
      .eq('utm_campaign', campaign)
      .order('created_at', { ascending: false })
      .limit(500)

    const filtered = applyClinicFilter(query, { clinicId, assignedClinicIds })
    if (filtered === null) return apiSuccess([])
    query = filtered
    if (tsStart) query = query.gte('created_at', tsStart)
    if (tsEnd) query = query.lt('created_at', tsEnd)

    const { data: leads, error } = await query
    if (error) return apiError(error.message, 500)

    // 노트 메타 집계: 리드별 개수 + 최신 노트(content/created_at/author)
    const leadIds = (leads || []).map(l => l.id)
    type NoteMeta = { notes_count: number; latest_note: { content: string; created_at: string; author: string | null } | null }
    const noteMetaMap = new Map<number, NoteMeta>()

    if (leadIds.length > 0) {
      const { data: notes } = await supabase
        .from('lead_notes')
        .select('lead_id, content, created_at, author:users!lead_notes_created_by_fkey(username)')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false })

      for (const n of notes || []) {
        const meta = noteMetaMap.get(n.lead_id)
        if (!meta) {
          // 최신순 정렬이므로 첫 번째 발견된 노트가 latest
          const author = Array.isArray(n.author)
            ? (n.author[0] as { username?: string } | undefined)?.username ?? null
            : (n.author as { username?: string } | null)?.username ?? null
          noteMetaMap.set(n.lead_id, {
            notes_count: 1,
            latest_note: { content: n.content, created_at: n.created_at, author },
          })
        } else {
          meta.notes_count += 1
        }
      }
    }

    const leadsWithNotes = (leads || []).map(l => {
      const meta = noteMetaMap.get(l.id)
      return {
        ...l,
        notes_count: meta?.notes_count ?? 0,
        latest_note: meta?.latest_note ?? null,
      }
    })

    return apiSuccess({ campaign, leads: leadsWithNotes })
  }

  // 캠페인 목록 (집계)
  let leadsQuery = supabase
    .from('leads')
    .select('id, customer_id, utm_source, utm_campaign, utm_content, landing_page_id, chatbot_sent, created_at')
    .not('utm_campaign', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (clinicId) leadsQuery = leadsQuery.eq('clinic_id', clinicId)
  if (tsStart) leadsQuery = leadsQuery.gte('created_at', tsStart)
  if (tsEnd) leadsQuery = leadsQuery.lt('created_at', tsEnd)

  // 랜딩 페이지 이름 매핑용
  let lpQuery = supabase.from('landing_pages').select('id, name')
  if (clinicId) lpQuery = lpQuery.eq('clinic_id', clinicId)

  const [leadsRes, lpRes] = await Promise.all([leadsQuery, lpQuery])
  if (leadsRes.error) return apiError(leadsRes.error.message, 500)

  const lpMap = new Map<number, string>()
  for (const lp of lpRes.data || []) lpMap.set(lp.id, lp.name)

  // 캠페인별 집계
  const campaignMap: Record<string, {
    campaign: string
    channels: Record<string, number>
    lead_count: number
    chatbot_sent_count: number
    landing_pages: Set<string>
    latest_at: string
    today_count: number
  }> = {}

  const todayStartISO = getKstDayStartISO()
  const todayEndISO = getKstDayEndISO()

  for (const lead of leadsRes.data || []) {
    const name = lead.utm_campaign!
    if (!campaignMap[name]) {
      campaignMap[name] = {
        campaign: name,
        channels: {},
        lead_count: 0,
        chatbot_sent_count: 0,
        landing_pages: new Set(),
        latest_at: lead.created_at,
        today_count: 0,
      }
    }
    const stat = campaignMap[name]
    const ch = normalizeChannel(lead.utm_source)
    stat.channels[ch] = (stat.channels[ch] || 0) + 1
    stat.lead_count++
    if (lead.chatbot_sent) stat.chatbot_sent_count++
    if (lead.landing_page_id && lpMap.has(lead.landing_page_id)) {
      stat.landing_pages.add(lpMap.get(lead.landing_page_id)!)
    }
    if (lead.created_at > stat.latest_at) stat.latest_at = lead.created_at
    // KST 기준 오늘 범위 체크 (UTC ISO 비교)
    const createdUtc = lead.created_at?.endsWith('Z') ? lead.created_at : (lead.created_at + 'Z')
    if (createdUtc >= todayStartISO && createdUtc <= todayEndISO) stat.today_count++
  }

  const campaigns = Object.values(campaignMap)
    .map(s => {
      // 가장 많은 채널을 대표 채널로 선택
      const topChannel = Object.entries(s.channels).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
      return {
      campaign: s.campaign,
      channel: topChannel,
      lead_count: s.lead_count,
      chatbot_sent_count: s.chatbot_sent_count,
      landing_pages: Array.from(s.landing_pages),
      latest_at: s.latest_at,
      today_count: s.today_count,
    }})
    .sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime())

  return apiSuccess(campaigns)
})
