import { serverSupabase } from '@/lib/supabase'
import { withClinicFilter, ClinicContext, applyClinicFilter, apiError, apiSuccess } from '@/lib/api-middleware'
import { getKstDateString } from '@/lib/date'
import { fetchAdMarkups, markupTotal, MARKUP_HINT } from '@/lib/ad-markup'
import { createLogger } from '@/lib/logger'
import { normalizeChannel } from '@/lib/channel'
import { fetchAllRowsResult } from '@/lib/supabase-paginate'

const logger = createLogger('CreativesPerformance')

interface AdStatsRow {
  ad_id: string | null
  ad_name: string | null
  platform: string | null
  campaign_id: string | null
  utm_content: string | null
  spend_amount: number
  clicks: number
  impressions: number
  stat_date: string
}

// inflow_url에서 utm_id (Meta campaign_id) 추출
function extractUtmId(inflowUrl: string | null): string | null {
  if (!inflowUrl) return null
  const match = inflowUrl.match(/utm_id=(\d+)/)
  return match?.[1] || null
}

/**
 * 소재별 성과 분석 API
 * utm_content 기반으로 리드/결제/매출 + 광고 지표(spend/clicks/impressions) 통합
 *
 * 광고 지표 매칭 전략:
 * 1차: ad_stats.utm_content 직접 매칭 (url_tags/effective_link 설정된 경우)
 * 2차: leads.inflow_url의 utm_id → campaign_id → ad_stats 캠페인별 집계 → 리드 비율 배분
 */
export const GET = withClinicFilter(async (req: Request, { user, clinicId, assignedClinicIds }: ClinicContext) => {
  if (user.role === 'demo_viewer') {
    const { demoCreativesPerformance } = await import('@/lib/demo/fixtures/extras')
    const url = new URL(req.url)
    return apiSuccess(demoCreativesPerformance(clinicId, url.searchParams.get('startDate'), url.searchParams.get('endDate')))
  }

  const supabase = serverSupabase()
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  // DATE columns: KST date string
  const dateStart = startDate ? getKstDateString(new Date(startDate)) : null
  const dateEnd = endDate ? getKstDateString(new Date(endDate)) : null

  // Timestamp columns: KST midnight [start, end) pattern
  const tsStart = dateStart ? `${dateStart}T00:00:00+09:00` : null
  let tsEnd: string | null = null
  if (dateEnd) {
    const d = new Date(dateEnd + 'T00:00:00+09:00')
    d.setDate(d.getDate() + 1)
    tsEnd = d.toISOString()
  }

  if (assignedClinicIds !== null && assignedClinicIds.length === 0) {
    return apiSuccess({ creatives: [] })
  }

  try {
    // 1~4. leads·소재·결제·ad_stats — 합계/집합 집계이므로 1,000행 상한을 id 페이지네이션으로 우회.
    //       (payments는 기존과 동일하게 기간 필터 없음 — 매출 기간정합은 별도 과제 B24)
    const [leadsRes, creativesRes, paymentsRes, adStatsRes] = await Promise.all([
      fetchAllRowsResult<{ id: number; customer_id: number; utm_content: string | null; inflow_url: string | null; created_at: string }>((from, to) => {
        let q = applyClinicFilter(supabase.from('leads').select('id, customer_id, utm_content, inflow_url, created_at').not('utm_content', 'is', null), { clinicId, assignedClinicIds })!
        if (tsStart) q = q.gte('created_at', tsStart)
        if (tsEnd) q = q.lt('created_at', tsEnd)
        return q.order('id').range(from, to)
      }),
      fetchAllRowsResult<{ id: number; name: string; utm_content: string; platform: string | null; landing_page_id: number | null; file_name: string | null; file_type: string | null }>((from, to) =>
        applyClinicFilter(supabase.from('ad_creatives').select('id, name, utm_content, platform, landing_page_id, file_name, file_type'), { clinicId, assignedClinicIds })!.order('id').range(from, to)),
      fetchAllRowsResult<{ id: number; payment_amount: number; customer_id: number }>((from, to) =>
        applyClinicFilter(supabase.from('payments').select('id, payment_amount, customer_id'), { clinicId, assignedClinicIds })!.order('id').range(from, to)),
      fetchAllRowsResult<AdStatsRow>((from, to) => {
        let q = applyClinicFilter(supabase.from('ad_stats').select('ad_id, ad_name, platform, campaign_id, utm_content, spend_amount, clicks, impressions, stat_date'), { clinicId, assignedClinicIds })!
        if (dateStart) q = q.gte('stat_date', dateStart)
        if (dateEnd) q = q.lte('stat_date', dateEnd)
        return q.order('id').range(from, to)
      }),
    ])

    if (leadsRes.error) {
      logger.error('리드 조회 실패', leadsRes.error, { clinicId })
      return apiError('리드 데이터 조회 실패', 500)
    }
    if (creativesRes.error) {
      logger.warn('소재 메타데이터 조회 실패', { clinicId, error: creativesRes.error })
    }
    if (paymentsRes.error) {
      logger.warn('결제 데이터 조회 실패', { clinicId, error: paymentsRes.error })
    }
    if (adStatsRes.error) {
      logger.warn('ad_stats 조회 실패', { clinicId, error: adStatsRes.error })
    }

    const leads = leadsRes.data || []
    const creatives = creativesRes.data || []
    const payments = paymentsRes.data || []
    const adStatsData: AdStatsRow[] = (adStatsRes.data || []) as AdStatsRow[]

    // utm_content → 소재 메타데이터 매핑
    const creativeMap = new Map<string, { name: string; platform: string | null; file_name: string | null; file_type: string | null }>()
    for (const c of creatives) {
      creativeMap.set(c.utm_content.toLowerCase(), {
        name: c.name,
        platform: c.platform,
        file_name: c.file_name || null,
        file_type: c.file_type || null,
      })
    }

    // utm_content별 리드 집계 + campaign_id 매핑 (inflow_url의 utm_id)
    const contentLeadMap = new Map<string, { leadIds: Set<number>; customerIds: Set<number> }>()
    const contentCampaignMap = new Map<string, Map<string, number>>() // utm_content → (campaign_id → count)

    for (const lead of leads) {
      const raw = lead.utm_content as string
      if (!raw) continue
      const content = raw.toLowerCase()
      if (!contentLeadMap.has(content)) {
        contentLeadMap.set(content, { leadIds: new Set(), customerIds: new Set() })
      }
      const entry = contentLeadMap.get(content)!
      entry.leadIds.add(lead.id)
      if (lead.customer_id) entry.customerIds.add(lead.customer_id)

      // campaign_id 매핑
      const campId = extractUtmId(lead.inflow_url as string)
      if (campId) {
        if (!contentCampaignMap.has(content)) contentCampaignMap.set(content, new Map())
        const campMap = contentCampaignMap.get(content)!
        campMap.set(campId, (campMap.get(campId) || 0) + 1)
      }
    }

    // customer_id → utm_content 매핑 (첫 리드 기준)
    const customerUtmContentMap = new Map<number, string>()
    for (const lead of leads) {
      if (lead.customer_id && lead.utm_content) {
        if (!customerUtmContentMap.has(lead.customer_id)) {
          customerUtmContentMap.set(lead.customer_id, (lead.utm_content as string).toLowerCase())
        }
      }
    }

    // utm_content별 결제 집계
    const contentPaymentMap = new Map<string, { payingCustomers: Set<number>; revenue: number }>()
    for (const payment of payments) {
      const customerId = payment.customer_id
      if (!customerId) continue
      const utmContent = customerUtmContentMap.get(customerId)
      if (!utmContent) continue
      if (!contentPaymentMap.has(utmContent)) {
        contentPaymentMap.set(utmContent, { payingCustomers: new Set(), revenue: 0 })
      }
      const entry = contentPaymentMap.get(utmContent)!
      entry.payingCustomers.add(customerId)
      entry.revenue += Number(payment.payment_amount) || 0
    }

    // ad_stats: (1) utm_content 직접, (2) ad_id 직접, (3) ad_name 부분문자열 매칭, (4) campaign 풀 fallback
    // 이중 집계 방지: 각 행은 가장 강한 매칭 단계에만 기여, campaign 풀은 어디에도 안 잡힌 행만
    const directUtmStats = new Map<string, { spend: number; clicks: number; impressions: number }>()
    const campaignStats = new Map<string, { spend: number; clicks: number; impressions: number }>()
    // ad_id별 집계 — Meta url_tags가 `utm_content={{ad.id}}` 매크로로 설정된 경우
    // lead.utm_content는 치환된 실제 ad_id가 되므로 ad_stats.ad_id와 직접 매칭 가능
    const adIdDirectStats = new Map<string, { spend: number; clicks: number; impressions: number; adName: string | null; platform: string | null; campaignId: string | null }>()
    // ad_name 부분문자열 매칭 — Meta ads_read 권한 부재 등으로 url_tags 추출 실패 시 대응
    // 사용자가 Meta 광고명에 소재명(utm_content/creative name)을 포함시킨 경우 ad 레벨 spend 귀속
    const adNameDirectStats = new Map<string, { spend: number; clicks: number; impressions: number }>()

    // 매칭 키 후보: 등록된 소재의 utm_content + name, 리드 유입된 utm_content (미등록 포함)
    // 4자 미만은 과매칭 방지를 위해 제외
    const creativeKeyLookup = new Map<string, string>() // 검색 키(lowercased) → 정규화 utm_content
    for (const c of creatives) {
      const utm = c.utm_content.toLowerCase()
      if (utm.length >= 4) creativeKeyLookup.set(utm, utm)
      if (c.name && c.name.length >= 4) creativeKeyLookup.set(c.name.toLowerCase(), utm)
    }
    for (const utm of contentLeadMap.keys()) {
      if (utm.length >= 4 && !creativeKeyLookup.has(utm)) creativeKeyLookup.set(utm, utm)
    }

    // 긴 키 우선 매칭 — `울쎄라피_79_c` 가 `울쎄라피_79` 보다 먼저 매칭되어야
    // 부분문자열 포함 관계(짧은 키가 긴 키에 includes됨)에서 더 구체적인 소재로 귀속
    const sortedCreativeKeys = Array.from(creativeKeyLookup.entries())
      .sort((a, b) => b[0].length - a[0].length)

    // ad_name 매칭 성공한 ad_id 추적 — 아래 별도 ad_id 표시 분기에서 중복 출력 방지
    const adIdMatchedByAdName = new Set<string>()

    for (const row of adStatsData) {
      const spend = Number(row.spend_amount) || 0
      const clicks = row.clicks || 0
      const impressions = row.impressions || 0

      // ad_id별 집계 (utm_content 유무 관계없이 — 2차 direct 경로용)
      if (row.ad_id) {
        const existing = adIdDirectStats.get(row.ad_id)
        if (existing) {
          existing.spend += spend; existing.clicks += clicks; existing.impressions += impressions
        } else {
          adIdDirectStats.set(row.ad_id, {
            spend, clicks, impressions,
            adName: row.ad_name || null,
            platform: row.platform || null,
            campaignId: row.campaign_id || null,
          })
        }
      }

      // 매칭 우선순위: utm_content → ad_name → campaign 풀
      if (row.utm_content) {
        const key = (row.utm_content as string).toLowerCase()
        const existing = directUtmStats.get(key) || { spend: 0, clicks: 0, impressions: 0 }
        existing.spend += spend; existing.clicks += clicks; existing.impressions += impressions
        directUtmStats.set(key, existing)
        continue
      }

      // ad_name 부분문자열 매칭 — 긴 검색키부터 시도 (sortedCreativeKeys)
      let matchedByAdName = false
      if (row.ad_name) {
        const adNameLower = row.ad_name.toLowerCase()
        for (const [searchKey, utmKey] of sortedCreativeKeys) {
          if (adNameLower.includes(searchKey)) {
            const existing = adNameDirectStats.get(utmKey) || { spend: 0, clicks: 0, impressions: 0 }
            existing.spend += spend; existing.clicks += clicks; existing.impressions += impressions
            adNameDirectStats.set(utmKey, existing)
            if (row.ad_id) adIdMatchedByAdName.add(row.ad_id)
            matchedByAdName = true
            break
          }
        }
      }
      if (matchedByAdName) continue

      // campaign 풀 fallback — 어디에도 매칭 안 된 경우
      if (row.campaign_id) {
        const existing = campaignStats.get(row.campaign_id) || { spend: 0, clicks: 0, impressions: 0 }
        existing.spend += spend; existing.clicks += clicks; existing.impressions += impressions
        campaignStats.set(row.campaign_id, existing)
      }
    }

    // lead.utm_content가 ad_id와 매칭되는지 사전 스캔 — 매칭되는 ad_id는 소재별 표시에서 중복 방지
    const adIdMatchedByUtm = new Set<string>()
    for (const utm of contentLeadMap.keys()) {
      if (adIdDirectStats.has(utm)) adIdMatchedByUtm.add(utm)
    }

    // campaign_id별 fallback 분모 — direct 매칭된 소재의 리드는 제외해야
    // fallback 풀이 non-direct 소재들 사이에 정확히 배분됨
    const campTotalLeadsMap = new Map<string, number>()
    for (const [utmContent, cMap] of contentCampaignMap) {
      if (directUtmStats.has(utmContent)) continue
      if (adIdDirectStats.has(utmContent)) continue
      if (adNameDirectStats.has(utmContent)) continue
      for (const [campId, count] of cMap) {
        campTotalLeadsMap.set(campId, (campTotalLeadsMap.get(campId) || 0) + count)
      }
    }

    // utm_content별 광고 지표 결정
    function getAdMetrics(utmContent: string): { spend: number; clicks: number; impressions: number } {
      // 1차: ad_stats.utm_content 직접 매칭 (spend=0도 직접 귀속)
      const direct = directUtmStats.get(utmContent)
      if (direct) return direct

      // 2차: lead.utm_content가 ad_id인 경우 (Meta url_tags `{{ad.id}}` 매크로 패턴)
      const adDirect = adIdDirectStats.get(utmContent)
      if (adDirect) return { spend: adDirect.spend, clicks: adDirect.clicks, impressions: adDirect.impressions }

      // 3차: Meta 광고명에 소재명이 포함된 경우 (url_tags 추출 실패 대응)
      const nameDirect = adNameDirectStats.get(utmContent)
      if (nameDirect) return nameDirect

      // 4차: campaign별 지표를 리드 비율로 배분
      const campLeads = contentCampaignMap.get(utmContent)
      if (!campLeads || campLeads.size === 0) return { spend: 0, clicks: 0, impressions: 0 }

      let totalSpend = 0, totalClicks = 0, totalImpressions = 0

      for (const [campId, leadCount] of campLeads) {
        const campStat = campaignStats.get(campId)
        if (!campStat) continue

        const campTotalLeads = campTotalLeadsMap.get(campId) || 0
        if (campTotalLeads > 0) {
          const ratio = leadCount / campTotalLeads
          totalSpend += campStat.spend * ratio
          totalClicks += campStat.clicks * ratio
          totalImpressions += campStat.impressions * ratio
        }
      }

      return {
        spend: Math.round(totalSpend),
        clicks: Math.round(totalClicks),
        impressions: Math.round(totalImpressions),
      }
    }

    // 최종 조립: leads + direct 매칭된 모든 utm_content 포함
    const allUtmContents = new Set([
      ...contentLeadMap.keys(),
      ...directUtmStats.keys(),
      ...adNameDirectStats.keys(),
    ])

    const allCreatives: {
      utm_content: string; name: string; platform: string | null
      spend: number; clicks: number; impressions: number
      cpc: number; ctr: number; cpl: number
      leads: number; customers: number; revenue: number; conversionRate: number
      registered: boolean; file_name: string | null; file_type: string | null
      campaign_ids: string[]
    }[] = []

    for (const utmContent of allUtmContents) {
      const creative = creativeMap.get(utmContent)
      const leadData = contentLeadMap.get(utmContent)
      const paymentData = contentPaymentMap.get(utmContent)
      const adMetrics = getAdMetrics(utmContent)
      // utm_content가 ad_id에 매칭된 경우 fallback용 ad_name/platform/campaign 정보 확보
      const adIdMatch = !directUtmStats.has(utmContent) ? adIdDirectStats.get(utmContent) : undefined

      const leadCount = leadData?.leadIds.size || 0
      const customerCount = paymentData?.payingCustomers.size || 0
      const revenue = paymentData?.revenue || 0
      const conversionRate = leadCount > 0 ? Math.round((customerCount / leadCount) * 1000) / 10 : 0

      const { spend, clicks, impressions } = adMetrics

      const campIds = contentCampaignMap.get(utmContent)
      const campaignNames: string[] = []
      if (campIds) {
        for (const campId of campIds.keys()) campaignNames.push(campId)
      }
      if (adIdMatch?.campaignId && !campaignNames.includes(adIdMatch.campaignId)) {
        campaignNames.push(adIdMatch.campaignId)
      }

      allCreatives.push({
        utm_content: utmContent,
        name: creative?.name || adIdMatch?.adName || utmContent,
        platform: creative
          ? normalizeChannel(creative.platform)
          : adIdMatch?.platform ? normalizeChannel(adIdMatch.platform) : null,
        spend,
        clicks,
        impressions,
        cpc: clicks > 0 ? Math.round(spend / clicks) : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpl: leadCount > 0 ? Math.round(spend / leadCount) : 0,
        leads: leadCount,
        customers: customerCount,
        revenue,
        conversionRate,
        registered: !!creative,
        file_name: creative?.file_name || null,
        file_type: creative?.file_type || null,
        campaign_ids: campaignNames,
      })
    }

    // utm_content 없는 ad_stats (TikTok/Google 등) → ad_id 기준으로 별도 표시
    // 단, lead.utm_content와 ad_id가 매칭된 경우는 위에서 이미 소재별로 처리됨 → 건너뛰기
    const adIdStats = new Map<string, { adName: string; platform: string; spend: number; clicks: number; impressions: number; campaignId: string | null }>()
    for (const row of adStatsData) {
      if (row.utm_content) continue // utm_content 있는 건 위에서 이미 처리
      if (!row.ad_id) continue
      if (adIdMatchedByUtm.has(row.ad_id)) continue // ad_id로 이미 소재에 귀속됨
      if (adIdMatchedByAdName.has(row.ad_id)) continue // ad_name 부분문자열로 이미 등록 소재에 귀속됨
      const existing = adIdStats.get(row.ad_id)
      if (existing) {
        existing.spend += Number(row.spend_amount) || 0
        existing.clicks += row.clicks || 0
        existing.impressions += row.impressions || 0
      } else {
        adIdStats.set(row.ad_id, {
          adName: row.ad_name || row.ad_id,
          platform: row.platform || 'Unknown',
          spend: Number(row.spend_amount) || 0,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          campaignId: row.campaign_id || null,
        })
      }
    }

    for (const [adId, stats] of adIdStats) {
      if (stats.spend === 0 && stats.clicks === 0 && stats.impressions === 0) continue
      allCreatives.push({
        utm_content: adId,
        name: stats.adName,
        platform: normalizeChannel(stats.platform),
        spend: stats.spend,
        clicks: stats.clicks,
        impressions: stats.impressions,
        cpc: stats.clicks > 0 ? Math.round(stats.spend / stats.clicks) : 0,
        ctr: stats.impressions > 0 ? Math.round((stats.clicks / stats.impressions) * 10000) / 100 : 0,
        cpl: 0,
        leads: 0,
        customers: 0,
        revenue: 0,
        conversionRate: 0,
        registered: false,
        file_name: null,
        file_type: null,
        campaign_ids: stats.campaignId ? [stats.campaignId] : [],
      })
    }

    // 광고비 마크업(관리 수수료 등) — 대상 캠페인 소재에 spend(비용소진) 비중으로 안분.
    // 총 가산액 M(=일일 정액 × 적용일수)을 소재 spend 비중으로 나눠 더하므로
    // 소재 합계 = 캠페인 가산액과 일치(랭킹/캠페인 레벨과 일관). 소재 귀속은 ad_stats.campaign_id 기준.
    // 비중은 "가산 적용 기간(effective_from~to)"의 소재 spend만으로 계산해 정밀화.
    const markups = await fetchAdMarkups(supabase, { clinicId, assignedClinicIds })
    const markupCreativeKeys: string[] = []
    for (const m of markups) {
      if (!m.campaign_id) continue
      const M = markupTotal([m], dateStart, dateEnd)
      if (M <= 0) continue

      // 가산 적용일의 소재별 비용소진 가중치 (ad_stats.campaign_id + stat_date 범위 기준)
      const weightByKey = new Map<string, number>()
      for (const row of adStatsData) {
        if (row.campaign_id !== m.campaign_id) continue
        const d = row.stat_date?.slice(0, 10)
        if (!d || d < m.effective_from) continue
        if (m.effective_to && d > m.effective_to) continue
        const key = (row.utm_content || row.ad_id || '').toLowerCase()
        if (!key) continue
        weightByKey.set(key, (weightByKey.get(key) || 0) + (Number(row.spend_amount) || 0))
      }
      const totalWeight = [...weightByKey.values()].reduce((a, b) => a + b, 0)
      if (totalWeight <= 0) continue // 적용 기간 소재 비용소진 0 → 안분 불가

      for (const c of allCreatives) {
        const w = weightByKey.get(c.utm_content.toLowerCase()) || 0
        if (w <= 0) continue
        const fee = M * (w / totalWeight)
        c.spend = Math.round(c.spend + fee)
        c.cpc = c.clicks > 0 ? Math.round(c.spend / c.clicks) : 0
        c.cpl = c.leads > 0 ? Math.round(c.spend / c.leads) : 0
        if (!c.campaign_ids.includes(m.campaign_id)) c.campaign_ids.push(m.campaign_id)
        markupCreativeKeys.push(c.utm_content)
      }
    }

    // 지출 높은순 정렬, 동률 시 리드수 높은순 (마크업 안분 반영 후)
    allCreatives.sort((a, b) => b.spend - a.spend || b.leads - a.leads)

    return apiSuccess({
      creatives: allCreatives,
      // 가산이 안분된 소재 — UI 고지(ⓘ "관리비 포함") 표시용
      markup: { creativeKeys: markupCreativeKeys, hint: MARKUP_HINT },
    })
  } catch (error) {
    logger.error('소재별 성과 조회 실패', error, { clinicId })
    return apiError('서버 오류가 발생했습니다.', 500)
  }
})
