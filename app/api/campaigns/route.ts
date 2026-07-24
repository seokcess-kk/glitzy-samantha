import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString, getKstDayStartISO, getKstDayEndISO } from '@/lib/date'
import { normalizeChannel } from '@/lib/channel'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'

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
    // 캠페인 리드 전량 조회 — 기존 .limit(500)은 리드 500개 초과 캠페인에서 이후 리드(+메모)가
    // 통째로 누락되므로 .range() 1000건 단위 페이지네이션으로 전환. 동시각 tie-break용 id 보조 정렬.
    interface LeadDetailRow { id: number; [key: string]: unknown }
    const LEAD_PAGE = 1000
    const leads: LeadDetailRow[] = []
    for (let from = 0; ; from += LEAD_PAGE) {
      let base = supabase
        .from('leads')
        .select(`
          id, customer_id, utm_source, utm_medium, utm_campaign, utm_content,
          chatbot_sent, chatbot_sent_at, created_at, landing_page_id, custom_data, lead_status,
          customer:customers(id, name, phone_number, first_source),
          landing_page:landing_pages(id, name)
        `)
        .eq('utm_campaign', campaign)

      const filtered = applyClinicFilter(base, { clinicId, assignedClinicIds })
      if (filtered === null) return apiSuccess([])
      base = filtered
      if (tsStart) base = base.gte('created_at', tsStart)
      if (tsEnd) base = base.lt('created_at', tsEnd)

      const { data, error } = await base
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + LEAD_PAGE - 1)

      if (error) return apiError(error.message, 500)
      if (!data || data.length === 0) break
      leads.push(...(data as LeadDetailRow[]))
      if (data.length < LEAD_PAGE) break
    }

    // 노트 prefetch: 리드별 전체 노트 배열을 시간순(ASC)으로 함께 반환 — 펼치기 시 추가 네트워크 호출 방지
    const leadIds = (leads || []).map(l => l.id)
    type PrefetchedNote = {
      id: number
      content: string
      created_by: number | null
      created_at: string
      updated_at: string | null
      author: { id: number; username: string } | null
    }
    const notesByLead = new Map<number, PrefetchedNote[]>()

    if (leadIds.length > 0) {
      // 리드가 많으면 .in('lead_id', [...]) URL이 과도하게 길어지므로 leadId를 배치로 나누고,
      // 각 배치를 다시 .range() 1000건 단위로 페이지네이션해 노트를 전량 조회한다.
      // (created_at ASC + limit 없는 단일 쿼리는 응답 상한 초과 시 '최신' 메모가 잘려 사라짐)
      // 리드는 각각 하나의 배치에만 속하므로 리드별 노트 순서(created_at→id ASC)는 그대로 보존됨.
      const LEAD_CHUNK = 300
      const NOTE_PAGE = 1000
      for (let c = 0; c < leadIds.length; c += LEAD_CHUNK) {
        const chunkIds = leadIds.slice(c, c + LEAD_CHUNK)
        for (let from = 0; ; from += NOTE_PAGE) {
          const { data: notes, error: notesError } = await supabase
            .from('lead_notes')
            .select('id, lead_id, content, created_by, created_at, updated_at, author:users!lead_notes_created_by_fkey(id, username)')
            .in('lead_id', chunkIds)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + NOTE_PAGE - 1)

          if (notesError) return apiError(notesError.message, 500)
          if (!notes || notes.length === 0) break

          for (const n of notes) {
            const author = Array.isArray(n.author)
              ? (n.author[0] as { id: number; username: string } | undefined) ?? null
              : (n.author as { id: number; username: string } | null) ?? null
            const entry: PrefetchedNote = {
              id: n.id,
              content: n.content,
              created_by: n.created_by,
              created_at: n.created_at,
              updated_at: n.updated_at,
              author,
            }
            const arr = notesByLead.get(n.lead_id)
            if (arr) arr.push(entry)
            else notesByLead.set(n.lead_id, [entry])
          }

          if (notes.length < NOTE_PAGE) break
        }
      }
    }

    const leadsWithNotes = (leads || []).map(l => {
      const notes = notesByLead.get(l.id) || []
      const latest = notes.length > 0 ? notes[notes.length - 1] : null
      return {
        ...l,
        notes,
        notes_count: notes.length,
        latest_note: latest
          ? { content: latest.content, created_at: latest.created_at, author: latest.author?.username ?? null }
          : null,
      }
    })

    return apiSuccess({ campaign, leads: leadsWithNotes })
  }

  // 멀티테넌트 격리: superadmin=전체, clinic_admin=자기 병원, agency_staff=배정 병원만(assignedClinicIds)
  // agency_staff 배정 병원 0개 → 빈 결과
  if (assignedClinicIds !== null && assignedClinicIds.length === 0) return apiSuccess([])

  // 랜딩 페이지 이름 매핑용 (병원당 소량)
  const lpBase = supabase.from('landing_pages').select('id, name')
  const lpQuery = applyClinicFilter(lpBase, { clinicId, assignedClinicIds }) || lpBase

  // 캠페인 목록 집계 — 리드 전량 필요. 기존 .limit(2000) 상한을 id 페이지네이션으로 우회.
  const [leadsRes, lpRes] = await Promise.all([
    fetchAllRowsResult<{ id: number; customer_id: number; utm_source: string | null; utm_campaign: string | null; utm_content: string | null; landing_page_id: number | null; chatbot_sent: boolean; created_at: string }>((from, to) => {
      let q = applyClinicFilter(supabase.from('leads').select('id, customer_id, utm_source, utm_campaign, utm_content, landing_page_id, chatbot_sent, created_at').not('utm_campaign', 'is', null), { clinicId, assignedClinicIds })!
      if (tsStart) q = q.gte('created_at', tsStart)
      if (tsEnd) q = q.lt('created_at', tsEnd)
      return q.order('id').range(from, to)
    }),
    lpQuery,
  ])

  if (leadsRes.error) return apiError('캠페인 조회에 실패했습니다.', 500)

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
