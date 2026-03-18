'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, User, Phone, Calendar, TrendingUp, Users, Star, Filter, FileText, Info, X, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useClinic } from '@/components/ClinicContext'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PageHeader, ChannelBadge, CustomerJourney } from '@/components/common'
import { formatDate } from '@/lib/date'

// 퍼널 단계 정의
type FunnelStage = 'lead' | 'booked' | 'visited' | 'consulted' | 'paid'
const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; icon: string }> = {
  lead:      { label: '리드', color: 'bg-muted text-muted-foreground', icon: '' },
  booked:    { label: '예약', color: 'bg-blue-500/20 text-blue-400', icon: '' },
  visited:   { label: '방문', color: 'bg-purple-500/20 text-purple-400', icon: '' },
  consulted: { label: '상담', color: 'bg-amber-500/20 text-amber-400', icon: '' },
  paid:      { label: '결제', color: 'bg-emerald-500/20 text-emerald-400', icon: '' },
}

function getFunnelStage(customer: any): FunnelStage {
  if (customer?.payments?.length > 0) return 'paid'
  const hasConsultDone = customer?.consultations?.some((c: any) =>
    ['방문완료', '상담중', '시술확정'].includes(c.status)
  )
  if (hasConsultDone) return 'consulted'
  const hasVisited = customer?.bookings?.some((b: any) =>
    ['visited', 'treatment_confirmed'].includes(b.status)
  )
  if (hasVisited) return 'visited'
  const hasBooked = customer?.bookings?.some((b: any) =>
    b.status !== 'cancelled'
  )
  if (hasBooked) return 'booked'
  return 'lead'
}

const GRADE_CONFIG: Record<string, { color: string; icon: string }> = {
  VIP:  { color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: '' },
  골드:  { color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',    icon: '' },
  실버:  { color: 'bg-muted text-foreground/60 border border-border',             icon: '' },
  일반:  { color: 'bg-muted/50 text-muted-foreground border border-border',       icon: '' },
}

function getGrade(totalPayment: number, treatmentCount: number): keyof typeof GRADE_CONFIG {
  if (totalPayment >= 5_000_000 || treatmentCount >= 5) return 'VIP'
  if (totalPayment >= 2_000_000 || treatmentCount >= 3) return '골드'
  if (totalPayment >= 500_000   || treatmentCount >= 1) return '실버'
  return '일반'
}

function getCustomerType(customer: any): 'new' | 'revisit' {
  const total =
    (customer?.consultations?.length || 0) +
    (customer?.bookings?.length || 0) +
    (customer?.payments?.length || 0)
  return total >= 2 ? 'revisit' : 'new'
}

function CustomerDetail({ lead, onDelete }: { lead: any; onDelete?: (leadId: number) => void }) {
  const c = lead.customer
  const payments: any[] = c?.payments || []
  const consultations: any[] = c?.consultations || []
  const bookings: any[] = c?.bookings || []
  const allLeads: any[] = lead.leads?.length ? lead.leads : [lead]
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const grade = getGrade(totalPayment, payments.length)
  const gradeStyle = GRADE_CONFIG[grade]
  const customerType = getCustomerType(c)
  const funnelStage = getFunnelStage(c)
  const stageConfig = FUNNEL_STAGES[funnelStage]
  const leadCount = allLeads.length

  // 랜딩 페이지 및 설문 응답 정보
  const landingPage = lead.landing_page
  const customData = lead.custom_data

  const treatmentMap: Record<string, { count: number; total: number }> = {}
  payments.forEach((p: any) => {
    const name = p.treatment_name || '기타'
    if (!treatmentMap[name]) treatmentMap[name] = { count: 0, total: 0 }
    treatmentMap[name].count++
    treatmentMap[name].total += Number(p.payment_amount)
  })

  return (
    <Card variant="glass" className="p-6">
      {/* 고객 헤더 */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg shrink-0">
          {c?.name?.[0] || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground">{c?.name || '이름 없음'}</h3>
            <ChannelBadge channel={c?.first_source || 'Unknown'} />
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeStyle.color}`}>
              {grade}
            </span>
            <Badge variant={customerType === 'revisit' ? 'default' : 'secondary'} className={customerType === 'revisit' ? 'bg-brand-500/20 text-brand-400 border-0' : ''}>
              {customerType === 'revisit' ? '재방문' : '신규'}
            </Badge>
            <span className={`text-xs px-2 py-0.5 rounded-full ${stageConfig.color}`}>
              {stageConfig.label}
            </span>
            {leadCount > 1 && (
              <Badge variant="info">{leadCount}회 유입</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone size={11} />{c?.phone_number}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(lead.created_at)}</span>
          </div>
        </div>
        {totalPayment > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-0.5">누적 결제액</p>
            <p className="text-lg font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* 랜딩 페이지 및 설문 응답 */}
      {(landingPage || (customData && Object.keys(customData).length > 0)) && (
        <div className="mb-5 p-4 bg-muted/40 dark:bg-white/[0.03] rounded-xl border border-border dark:border-white/5">
          {landingPage && (
            <div className="flex items-center gap-2 mb-3">
              <FileText size={12} className="text-brand-400" />
              <span className="text-xs font-semibold text-muted-foreground">유입 랜딩 페이지:</span>
              <span className="text-sm text-brand-400">{landingPage.name}</span>
            </div>
          )}
          {customData?.survey && Object.keys(customData.survey).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Info size={12} /> 설문 응답
              </p>
              <div className="space-y-1.5">
                {Object.entries(customData.survey).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground/80">{String(value)}</span>
                  </div>
                ))}
              </div>
              {customData.marketing_consent !== undefined && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border dark:border-white/5">
                  마케팅 수신 동의: {customData.marketing_consent ? '동의' : '미동의'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 시술 이력 */}
      {Object.keys(treatmentMap).length > 0 && (
        <div className="mb-5 p-4 bg-muted/40 dark:bg-white/[0.03] rounded-xl border border-border dark:border-white/5">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> 시술 이력
          </p>
          <div className="space-y-2">
            {Object.entries(treatmentMap).map(([name, { count, total }]) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground/80">{name}</span>
                  <span className="text-xs text-muted-foreground bg-muted dark:bg-white/5 px-2 py-0.5 rounded-full">{count}회</span>
                </div>
                <span className="text-sm font-semibold text-emerald-400">₩{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border dark:border-white/5">
            <span className="text-xs text-muted-foreground">총 {payments.length}회 시술</span>
            <span className="text-sm font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 여정 타임라인 */}
      <CustomerJourney
        leads={allLeads}
        bookings={bookings}
        consultations={consultations}
        payments={payments}
      />

      {/* 삭제 버튼 (superadmin) */}
      {onDelete && (
        <div className="mt-5 pt-4 border-t border-border dark:border-white/5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(lead.latest_lead?.id || lead.leads?.[0]?.id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 size={14} /> 이 리드 삭제
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-center py-12">로딩 중...</div>}>
      <LeadsContent />
    </Suspense>
  )
}

function LeadsContent() {
  const { selectedClinicId } = useClinic()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'superadmin'
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'all' | 'new' | 'revisit'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [landingPageFilter, setLandingPageFilter] = useState<string>(searchParams.get('landing_page_id') || 'all')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [landingPages, setLandingPages] = useState<{ id: number; name: string }[]>([])

  // 랜딩 페이지 목록 로드
  useEffect(() => {
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/landing-pages${qs}`)
      .then(r => r.json())
      .then(d => setLandingPages(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [selectedClinicId])

  const fetchLeads = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    if (landingPageFilter !== 'all') params.set('landing_page_id', landingPageFilter)
    if (campaignFilter !== 'all') params.set('utm_campaign', campaignFilter)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/leads${qs}`)
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLeads() }, [selectedClinicId, landingPageFilter, campaignFilter])

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('이 리드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('리드가 삭제되었습니다.')
      setSelected(null)
      fetchLeads()
    } catch (e: any) {
      toast.error(e.message || '삭제에 실패했습니다.')
    }
  }

  const channels = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => {
      const ch = l.utm_source || l.customer?.first_source
      if (ch) set.add(ch)
    })
    return Array.from(set).sort()
  }, [leads])

  const campaigns = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => {
      if (l.utm_campaign) set.add(l.utm_campaign)
      l.leads?.forEach((lead: any) => { if (lead.utm_campaign) set.add(lead.utm_campaign) })
    })
    return Array.from(set).sort()
  }, [leads])

  const activeFilterCount = [channelFilter, landingPageFilter, campaignFilter].filter(f => f !== 'all').length

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search ||
        l.customer?.name?.includes(search) ||
        l.customer?.phone_number?.includes(search)
      if (!matchSearch) return false

      if (channelFilter !== 'all') {
        const ch = l.utm_source || l.customer?.first_source
        if (ch?.toLowerCase() !== channelFilter.toLowerCase()) return false
      }

      if (stageFilter !== 'all') {
        const stage = getFunnelStage(l.customer)
        if (stage !== stageFilter) return false
      }

      return true
    })
  }, [leads, search, channelFilter, stageFilter])

  const newLeads     = filtered.filter(l => getCustomerType(l.customer) === 'new')
  const revisitLeads = filtered.filter(l => getCustomerType(l.customer) === 'revisit')
  const displayed    = tab === 'all' ? filtered : tab === 'new' ? newLeads : revisitLeads

  const stageCounts = useMemo(() => {
    const counts: Record<FunnelStage, number> = { lead: 0, booked: 0, visited: 0, consulted: 0, paid: 0 }
    filtered.forEach(l => {
      const stage = getFunnelStage(l.customer)
      counts[stage]++
    })
    return counts
  }, [filtered])

  const TABS = [
    { key: 'all',     label: '전체',     count: filtered.length },
    { key: 'new',     label: '신규고객',  count: newLeads.length },
    { key: 'revisit', label: '재방문고객', count: revisitLeads.length },
  ]

  return (
    <>
      <PageHeader
        title="고객(CDP) 관리"
        description="광고 인입 → 챗봇 → 상담 → 결제 전체 여정을 추적합니다."
        actions={
          <Card variant="glass" className="flex items-center px-3 py-2">
            <Search size={14} className="text-muted-foreground mr-2" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 또는 전화번호 검색"
              className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 w-52 p-0 h-auto"
            />
          </Card>
        }
      />

      {/* 퍼널 단계 요약 */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
        {(Object.entries(FUNNEL_STAGES) as [FunnelStage, typeof FUNNEL_STAGES[FunnelStage]][]).map(([key, stage]) => (
          <button
            key={key}
            onClick={() => setStageFilter(stageFilter === key ? 'all' : key)}
            className={`p-3 text-center transition-all rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md ${stageFilter === key ? 'ring-1 ring-brand-500' : 'hover:bg-muted dark:hover:bg-white/[0.03]'}`}
            aria-pressed={stageFilter === key}
            aria-label={`${stage.label} 필터 ${stageFilter === key ? '해제' : '적용'}`}
          >
            {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold text-foreground">{stageCounts[key]}</p>}
            <p className="text-xs text-muted-foreground">{stage.label}</p>
          </button>
        ))}
      </div>

      {/* 필터 + 탭 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-2">
          {TABS.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'glass'}
              onClick={() => { setTab(t.key as any); setSelected(null) }}
              className={tab === t.key ? 'bg-brand-600 border-brand-600' : ''}
            >
              {t.key === 'new'     && <User  size={13} />}
              {t.key === 'revisit' && <Users size={13} />}
              {t.label}
              <span className={`text-xs px-1.5 py-0 rounded-full ml-1 ${tab === t.key ? 'bg-white/20' : 'bg-muted dark:bg-white/5 text-muted-foreground'}`}>
                {t.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Filter size={14} className="text-muted-foreground" />

          {channels.length > 0 && (
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[130px] glass-card border-0 text-foreground text-xs">
                <SelectValue placeholder="전체 채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {landingPages.length > 0 && (
            <Select value={landingPageFilter} onValueChange={v => { setLandingPageFilter(v); setSelected(null) }}>
              <SelectTrigger className="w-[150px] glass-card border-0 text-foreground text-xs">
                <SelectValue placeholder="전체 랜딩페이지" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 랜딩페이지</SelectItem>
                {landingPages.map(lp => (
                  <SelectItem key={lp.id} value={String(lp.id)}>{lp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {campaigns.length > 0 && (
            <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setSelected(null) }}>
              <SelectTrigger className="w-[150px] glass-card border-0 text-foreground text-xs">
                <SelectValue placeholder="전체 캠페인" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 캠페인</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLandingPageFilter('all'); setCampaignFilter('all'); setChannelFilter('all') }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> 필터 초기화
            </Button>
          )}
        </div>
      </div>

      {/* 모바일 Sheet - 모바일에서만 렌더링 */}
      <div className="md:hidden">
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-foreground">고객 상세</SheetTitle>
            </SheetHeader>
            {selected && <CustomerDetail lead={selected} onDelete={isSuperAdmin ? handleDeleteLead : undefined} />}
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 고객 목록 */}
        <div className="md:col-span-2 space-y-2">
          {loading
            ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
            : displayed.map(lead => {
              const c = lead.customer
              const payments: any[] = c?.payments || []
              const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
              const grade = getGrade(totalPayment, payments.length)
              const gradeStyle = GRADE_CONFIG[grade]
              const isSelected = selected?.id === lead.id
              const funnelStage = getFunnelStage(c)
              const stageConfig = FUNNEL_STAGES[funnelStage]
              const channelSource = lead.utm_source || c?.first_source
              const leadCount = lead.lead_count || 1
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelected(isSelected ? null : lead)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-md ${isSelected ? 'ring-1 ring-brand-500' : 'hover:bg-muted dark:hover:bg-white/[0.03]'}`}
                  aria-pressed={isSelected}
                  aria-label={`${c?.name || '이름 없음'} 고객 ${isSelected ? '선택 해제' : '선택'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0 relative">
                    {c?.name?.[0] || <User size={14} />}
                    {leadCount > 1 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {leadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{c?.name || '이름 없음'}</p>
                      {grade !== '일반' && (
                        <span className={`text-[10px] font-bold px-1.5 rounded-full shrink-0 ${gradeStyle.color}`}>
                          {grade}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 rounded-full shrink-0 ${stageConfig.color}`}>
                        {stageConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{c?.phone_number}</span>
                      {lead.utm_campaign && (
                        <span className="text-muted-foreground/60 truncate">· {lead.utm_campaign}</span>
                      )}
                      {leadCount > 1 && (
                        <span className="text-brand-400 shrink-0">({leadCount}회 유입)</span>
                      )}
                    </div>
                  </div>
                  <ChannelBadge channel={channelSource || '-'} />
                </button>
              )
            })
          }
          {!loading && displayed.length === 0 && (
            <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
              {search
                ? `'${search}' 검색 결과 없음`
                : tab === 'revisit' ? '재방문 고객이 없습니다.'
                : tab === 'new'     ? '신규 고객이 없습니다.'
                : '인입된 고객이 없습니다.'}
            </Card>
          )}
        </div>

        {/* 상세 패널 (데스크톱만) */}
        <div className="hidden md:block md:col-span-3">
          {selected ? (
            <CustomerDetail lead={selected} onDelete={isSuperAdmin ? handleDeleteLead : undefined} />
          ) : (
            <Card variant="glass" className="p-12 text-center">
              <Star size={32} className="text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">좌측 목록에서 고객을 선택하면<br />전체 여정 및 시술 이력을 확인할 수 있습니다.</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: '전체 고객', value: filtered.length },
                  { label: '신규 고객', value: newLeads.length },
                  { label: '재방문 고객', value: revisitLeads.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 dark:bg-white/[0.03] rounded-xl p-3">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold text-foreground">{value}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
