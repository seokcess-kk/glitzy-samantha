'use client'
import { useState, useEffect, useMemo } from 'react'
import { Search, User, Phone, Calendar, TrendingUp, Users, Star, Tag, Filter, CalendarCheck, CreditCard } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { getUtmSourceLabel, getUtmMediumLabel } from '@/lib/utm'
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
import { PageHeader, StatsCard, ChannelBadge, StatusBadge } from '@/components/common'

// 퍼널 단계 정의
type FunnelStage = 'lead' | 'booked' | 'visited' | 'consulted' | 'paid'
const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; icon: string }> = {
  lead:      { label: '리드', color: 'bg-slate-500/20 text-slate-400', icon: '' },
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
  실버:  { color: 'bg-slate-400/20 text-slate-300 border border-slate-400/30',    icon: '' },
  일반:  { color: 'bg-slate-700/20 text-slate-500 border border-slate-700/30',    icon: '' },
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

function CustomerDetail({ lead }: { lead: any }) {
  const c = lead.customer
  const payments: any[] = c?.payments || []
  const consultations: any[] = c?.consultations || []
  const bookings: any[] = c?.bookings || []
  const allLeads: any[] = lead.leads || [lead]
  const totalPayment = payments.reduce((s: number, p: any) => s + Number(p.payment_amount), 0)
  const grade = getGrade(totalPayment, payments.length)
  const gradeStyle = GRADE_CONFIG[grade]
  const customerType = getCustomerType(c)
  const funnelStage = getFunnelStage(c)
  const stageConfig = FUNNEL_STAGES[funnelStage]
  const leadCount = allLeads.length

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
            <h3 className="font-semibold text-white">{c?.name || '이름 없음'}</h3>
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
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Phone size={11} />{c?.phone_number}</span>
            <span className="flex items-center gap-1"><Calendar size={11} />{new Date(lead.created_at).toLocaleDateString('ko')}</span>
          </div>
        </div>
        {totalPayment > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500 mb-0.5">누적 결제액</p>
            <p className="text-lg font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* 시술 이력 */}
      {Object.keys(treatmentMap).length > 0 && (
        <div className="mb-5 p-4 bg-white/[0.03] rounded-xl border border-white/5">
          <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> 시술 이력
          </p>
          <div className="space-y-2">
            {Object.entries(treatmentMap).map(([name, { count, total }]) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{name}</span>
                  <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{count}회</span>
                </div>
                <span className="text-sm font-semibold text-emerald-400">₩{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <span className="text-xs text-slate-500">총 {payments.length}회 시술</span>
            <span className="text-sm font-bold text-emerald-400">₩{totalPayment.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* 유입 이력 */}
      {leadCount > 1 && (
        <div className="mb-5 p-4 bg-brand-500/10 rounded-xl border border-brand-500/20">
          <p className="text-xs font-semibold text-brand-400 mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> 유입 이력 ({leadCount}회)
          </p>
          <div className="space-y-2">
            {allLeads.map((l: any, idx: number) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <ChannelBadge channel={l.utm_source || 'Unknown'} className="text-[10px] px-1.5 py-0.5" />
                  {l.utm_campaign && (
                    <span className="text-slate-400">{l.utm_campaign}</span>
                  )}
                </div>
                <span className="text-slate-500">{new Date(l.created_at).toLocaleDateString('ko')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 여정 타임라인 */}
      <div className="space-y-3">
        {allLeads.map((l: any, idx: number) => (
          <div key={`lead-${l.id}`}>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300">
                  광고 인입 {leadCount > 1 && <span className="text-slate-500">#{idx + 1}</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {getUtmSourceLabel(l.utm_source || c?.first_source)}
                  {l.utm_medium && <span className="text-slate-600"> / {getUtmMediumLabel(l.utm_medium)}</span>}
                  {l.utm_campaign && (
                    <span className="text-brand-400"> · {l.utm_campaign}</span>
                  )}
                </p>
                {l.utm_content && (
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <Tag size={10} /> {l.utm_content}
                  </p>
                )}
              </div>
              <span className="ml-auto text-xs text-slate-600 shrink-0">{new Date(l.created_at).toLocaleDateString('ko')}</span>
            </div>

            <div className="flex items-start gap-3 mt-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${l.chatbot_sent ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <div>
                <p className="text-xs font-semibold text-slate-300">챗봇 발송</p>
                <p className="text-xs text-slate-500">
                  {l.chatbot_sent
                    ? `발송 완료 ${l.chatbot_sent_at ? `(${new Date(l.chatbot_sent_at).toLocaleTimeString('ko')})` : ''}`
                    : '발송 대기 중'}
                </p>
              </div>
            </div>

            {idx < allLeads.length - 1 && (
              <div className="border-t border-dashed border-white/10 my-3" />
            )}
          </div>
        ))}

        {bookings.map((booking: any) => {
          const statusLabels: Record<string, { text: string; color: string }> = {
            confirmed: { text: '예약 확정', color: 'text-blue-400' },
            visited: { text: '방문 완료', color: 'text-purple-400' },
            noshow: { text: '노쇼', color: 'text-red-400' },
            cancelled: { text: '취소됨', color: 'text-slate-500' },
            treatment_confirmed: { text: '시술 확정', color: 'text-emerald-400' },
          }
          const statusInfo = statusLabels[booking.status] || { text: booking.status, color: 'text-slate-400' }
          const isCancelled = booking.status === 'cancelled'
          return (
            <div key={booking.id} className={`flex items-start gap-3 ${isCancelled ? 'opacity-50' : ''}`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isCancelled ? 'bg-slate-600' : 'bg-blue-500'}`} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <CalendarCheck size={11} />
                  예약
                </p>
                <p className={`text-xs ${statusInfo.color}`}>
                  {statusInfo.text}
                  {booking.booking_datetime && (
                    <span className="text-slate-500"> · {new Date(booking.booking_datetime).toLocaleDateString('ko')} {new Date(booking.booking_datetime).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </p>
                {booking.notes && (
                  <p className="text-xs text-slate-600 mt-0.5">{booking.notes}</p>
                )}
              </div>
              <span className="text-xs text-slate-600 shrink-0">{new Date(booking.created_at).toLocaleDateString('ko')}</span>
            </div>
          )
        })}

        {consultations.map((consult: any) => (
          <div key={consult.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-300">상담</p>
              <p className="text-xs text-slate-500">{consult.status} — {consult.notes || '메모 없음'}</p>
            </div>
            {consult.consultation_date && (
              <span className="ml-auto text-xs text-slate-600">{new Date(consult.consultation_date).toLocaleDateString('ko')}</span>
            )}
          </div>
        ))}

        {payments.map((p: any) => (
          <div key={p.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-300">결제</p>
              <p className="text-xs text-slate-500">{p.treatment_name} — ₩{Number(p.payment_amount).toLocaleString()}</p>
            </div>
            <span className="ml-auto text-xs text-slate-600">{new Date(p.payment_date).toLocaleDateString('ko')}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function LeadsPage() {
  const { selectedClinicId } = useClinic()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'all' | 'new' | 'revisit'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')

  useEffect(() => {
    setLoading(true)
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/leads${qs}`)
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedClinicId])

  const channels = useMemo(() => {
    const set = new Set<string>()
    leads.forEach(l => {
      const ch = l.utm_source || l.customer?.first_source
      if (ch) set.add(ch)
    })
    return Array.from(set).sort()
  }, [leads])

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
            <Search size={14} className="text-slate-500 mr-2" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 또는 전화번호 검색"
              className="bg-transparent border-0 text-sm text-white placeholder-slate-600 focus-visible:ring-0 w-52 p-0 h-auto"
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
            className={`p-3 text-center transition-all rounded-2xl ${stageFilter === key ? 'ring-1 ring-brand-500' : 'hover:bg-white/[0.03]'}`}
            style={{ background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            aria-pressed={stageFilter === key}
            aria-label={`${stage.label} 필터 ${stageFilter === key ? '해제' : '적용'}`}
          >
            {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold text-white">{stageCounts[key]}</p>}
            <p className="text-xs text-slate-500">{stage.label}</p>
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
              <span className={`text-xs px-1.5 py-0 rounded-full ml-1 ${tab === t.key ? 'bg-white/20' : 'bg-white/5 text-slate-500'}`}>
                {t.count}
              </span>
            </Button>
          ))}
        </div>

        {channels.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Filter size={14} className="text-slate-500" />
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px] glass-card border-0 text-white">
                <SelectValue placeholder="전체 채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                {channels.map(ch => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 모바일 Sheet - 모바일에서만 렌더링 */}
      <div className="md:hidden">
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-white">고객 상세</SheetTitle>
            </SheetHeader>
            {selected && <CustomerDetail lead={selected} />}
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
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all rounded-2xl ${isSelected ? 'ring-1 ring-brand-500' : 'hover:bg-white/[0.03]'}`}
                  style={{ background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
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
                      <p className="text-sm font-medium text-white truncate">{c?.name || '이름 없음'}</p>
                      {grade !== '일반' && (
                        <span className={`text-[10px] font-bold px-1.5 rounded-full shrink-0 ${gradeStyle.color}`}>
                          {grade}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 rounded-full shrink-0 ${stageConfig.color}`}>
                        {stageConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{c?.phone_number}</span>
                      {lead.utm_campaign && (
                        <span className="text-slate-600 truncate">· {lead.utm_campaign}</span>
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
            <Card variant="glass" className="p-8 text-center text-slate-500 text-sm">
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
            <CustomerDetail lead={selected} />
          ) : (
            <Card variant="glass" className="p-12 text-center">
              <Star size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">좌측 목록에서 고객을 선택하면<br />전체 여정 및 시술 이력을 확인할 수 있습니다.</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: '전체 고객', value: filtered.length },
                  { label: '신규 고객', value: newLeads.length },
                  { label: '재방문 고객', value: revisitLeads.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold text-white">{value}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
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
