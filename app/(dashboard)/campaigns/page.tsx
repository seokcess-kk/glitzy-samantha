'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Megaphone, ArrowLeft, Phone, Clock, ChevronRight, RefreshCw, MessageCircle, FileText, User, ShieldCheck, StickyNote } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { PageHeader, ChannelBadge } from '@/components/common'
import { formatDateTime } from '@/lib/date'

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:        { label: '신규',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  no_answer:  { label: '부재',     color: 'bg-muted text-muted-foreground border-border dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30' },
  consulted:  { label: '상담완료', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  booked:     { label: '예약완료', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  hold:       { label: '보류',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  rejected:   { label: '거절',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

interface CampaignSummary {
  campaign: string
  channel: string
  lead_count: number
  chatbot_sent_count: number
  landing_pages: string[]
  latest_at: string
  today_count: number
}

interface CampaignLead {
  id: number
  customer_id: number
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  chatbot_sent: boolean
  chatbot_sent_at: string | null
  created_at: string
  landing_page_id: number | null
  lead_status: string
  notes: string | null
  custom_data: { survey?: Record<string, string>; marketing_consent?: boolean; name?: string } | null
  customer: { id: number; name: string; phone_number: string; first_source: string } | null
  landing_page: { id: number; name: string } | null
}

function timeAgo(dateStr: string): string {
  // timezone 정보 없는 Supabase timestamp → UTC로 취급
  const ts = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

// ─── 캠페인 목록 ───

function CampaignList({ campaigns, loading, onSelect, onRefresh }: {
  campaigns: CampaignSummary[]
  loading: boolean
  onSelect: (campaign: string) => void
  onRefresh: () => void
}) {
  const totalLeads = campaigns.reduce((s, c) => s + c.lead_count, 0)
  const todayLeads = campaigns.reduce((s, c) => s + c.today_count, 0)

  return (
    <>
      <PageHeader
        title="캠페인 리드"
        description="캠페인별 유입 리드를 확인합니다."
        actions={
          <Button variant="glass" size="sm" onClick={onRefresh}>
            <RefreshCw size={14} /> 새로고침
          </Button>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '활성 캠페인', value: campaigns.length, color: 'text-foreground' },
          { label: '전체 리드', value: totalLeads, color: 'text-brand-400' },
          { label: '오늘 유입', value: todayLeads, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} variant="glass" className="p-4 text-center">
            {loading ? <Skeleton className="h-7 w-12 mx-auto mb-1" /> : (
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* 캠페인 카드 목록 */}
      <div className="space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : campaigns.length === 0
            ? (
              <Card variant="glass" className="p-12 text-center">
                <Megaphone size={32} className="text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">진행 중인 캠페인이 없습니다.</p>
              </Card>
            )
            : campaigns.map(c => (
              <button
                key={c.campaign}
                onClick={() => onSelect(c.campaign)}
                className="w-full p-4 text-left transition-all rounded-2xl hover:ring-1 hover:ring-brand-500/50 bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-[10px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center shrink-0">
                    <Megaphone size={18} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{c.campaign}</p>
                      <ChannelBadge channel={c.channel} />
                      {c.today_count > 0 && (
                        <Badge variant="success" className="text-[10px]">오늘 +{c.today_count}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-brand-400 font-semibold">{c.lead_count}건</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={10} />
                        {c.chatbot_sent_count}/{c.lead_count}
                      </span>
                      {c.landing_pages.length > 0 && (
                        <span className="flex items-center gap-1 truncate">
                          <FileText size={10} />
                          {c.landing_pages[0]}
                          {c.landing_pages.length > 1 && ` 외 ${c.landing_pages.length - 1}개`}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        <Clock size={10} />
                        {timeAgo(c.latest_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" />
                </div>
              </button>
            ))
        }
      </div>
    </>
  )
}

// ─── 캠페인 상세 리드 목록 ───

function LeadCard({ lead, onStatusChange, onNotesChange }: {
  lead: CampaignLead
  onStatusChange: (id: number, status: string) => void
  onNotesChange: (id: number, notes: string) => void
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(lead.notes || '')
  const survey = lead.custom_data?.survey
  const surveyEntries = survey ? Object.values(survey) : []
  const marketingConsent = lead.custom_data?.marketing_consent
  const leadName = lead.custom_data?.name || lead.customer?.name || '이름 없음'
  const status = lead.lead_status || 'new'
  const statusConfig = LEAD_STATUS_CONFIG[status] || LEAD_STATUS_CONFIG.new

  const handleNotesSave = () => {
    onNotesChange(lead.id, notesValue)
    setEditingNotes(false)
  }

  return (
    <div
      className="px-4 py-3 rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border dark:border-white/[0.08] backdrop-blur-[10px]"
    >
      {/* 1행: 기본 정보 + 상태 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
          {leadName[0] || <User size={14} />}
        </div>
        <p className="text-sm font-semibold text-foreground shrink-0">{leadName}</p>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Phone size={10} />
          {lead.customer?.phone_number || '-'}
        </span>
        <ChannelBadge channel={lead.utm_source || '-'} />
        {marketingConsent !== undefined && (
          <span className={`flex items-center gap-1 text-[10px] shrink-0 ${marketingConsent ? 'text-emerald-500' : 'text-muted-foreground/60'}`}>
            <ShieldCheck size={10} />
            {marketingConsent ? '수신동의' : '미동의'}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-auto">
          {formatDateTime(lead.created_at)}
        </span>
        <Select value={status} onValueChange={v => onStatusChange(lead.id, v)}>
          <SelectTrigger className={`w-[100px] h-7 text-[11px] font-semibold border rounded-full px-2.5 ${statusConfig.color}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2행: 설문 응답 + 랜딩페이지 + 소재 */}
      <div className="flex items-center gap-1.5 pl-11 flex-wrap">
        {lead.landing_page && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
            {lead.landing_page.name}
          </span>
        )}
        {lead.utm_content && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted dark:bg-white/5 text-muted-foreground border border-border dark:border-white/10 shrink-0">
            {lead.utm_content}
          </span>
        )}
        {surveyEntries.length > 0 && (
          <>
            <span className="text-border text-[10px] mx-0.5">│</span>
            {surveyEntries.map((value, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-muted dark:bg-white/5 text-muted-foreground border border-border dark:border-white/10">
                {String(value)}
              </span>
            ))}
          </>
        )}
      </div>

      {/* 3행: 메모 */}
      <div className="pl-11 mt-2">
        {editingNotes ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNotesSave()}
              placeholder="메모 입력..."
              className="flex-1 text-xs bg-muted dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-3 py-1.5 text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-brand-500"
              autoFocus
            />
            <button onClick={handleNotesSave} className="text-[10px] text-brand-400 hover:text-brand-300 shrink-0">저장</button>
            <button onClick={() => { setEditingNotes(false); setNotesValue(lead.notes || '') }} className="text-[10px] text-muted-foreground hover:text-muted-foreground shrink-0">취소</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground/80 transition-colors"
          >
            <StickyNote size={10} />
            {lead.notes || '메모 추가...'}
          </button>
        )}
      </div>
    </div>
  )
}

function CampaignDetail({ campaign, onBack }: { campaign: string; onBack: () => void }) {
  const { selectedClinicId } = useClinic()
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeads = () => {
    setLoading(true)
    const params = new URLSearchParams({ campaign })
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    fetch(`/api/campaigns?${params}`)
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLeads() }, [campaign, selectedClinicId])

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    const res = await fetch(`/api/leads/${leadId}?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_status: newStatus }),
    })
    if (res.ok) {
      const statusLabel = LEAD_STATUS_CONFIG[newStatus]?.label || newStatus
      if (newStatus === 'booked') {
        toast.success(`상태가 '${statusLabel}'(으)로 변경되었습니다. 예약/결제 관리 페이지에 자동 등록되었습니다.`)
      } else {
        toast.success(`상태가 '${statusLabel}'(으)로 변경되었습니다.`)
      }
      // 로컬 상태 즉시 반영
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lead_status: newStatus } : l))
    } else {
      toast.error('상태 변경 실패')
    }
  }

  const handleNotesChange = async (leadId: number, notes: string) => {
    const params = new URLSearchParams()
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    const res = await fetch(`/api/leads/${leadId}?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      toast.success('메모가 저장되었습니다.')
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes } : l))
    } else {
      toast.error('메모 저장 실패')
    }
  }

  const sentCount = leads.filter(l => l.chatbot_sent).length
  const consentCount = leads.filter(l => l.custom_data?.marketing_consent).length

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={14} /> 캠페인 목록
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <Megaphone size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{campaign}</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? '로딩 중...' : `${leads.length}건의 리드`}
            </p>
          </div>
        </div>
      </div>

      {/* 요약 */}
      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => {
            const count = leads.filter(l => (l.lead_status || 'new') === key).length
            return (
              <Card key={key} variant="glass" className="p-2.5 text-center">
                <p className={`text-lg font-bold ${cfg.color.split(' ')[1]}`}>{count}</p>
                <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
              </Card>
            )
          })}
        </div>
      )}

      {/* 리드 목록 */}
      <div className="space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : leads.length === 0
            ? (
              <Card variant="glass" className="p-8 text-center text-muted-foreground text-sm">
                이 캠페인에서 유입된 리드가 없습니다.
              </Card>
            )
            : leads.map(lead => <LeadCard key={lead.id} lead={lead} onStatusChange={handleStatusChange} onNotesChange={handleNotesChange} />)
        }
      </div>
    </>
  )
}

// ─── 메인 ───

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-center py-12">로딩 중...</div>}>
      <CampaignsContent />
    </Suspense>
  )
}

function CampaignsContent() {
  const { selectedClinicId } = useClinic()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(
    searchParams.get('campaign')
  )

  const fetchCampaigns = () => {
    setLoading(true)
    const qs = selectedClinicId ? `?clinic_id=${selectedClinicId}` : ''
    fetch(`/api/campaigns${qs}`)
      .then(r => r.json())
      .then(d => setCampaigns(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCampaigns() }, [selectedClinicId])

  const handleSelect = (campaign: string) => {
    setSelectedCampaign(campaign)
    router.replace(`/campaigns?campaign=${encodeURIComponent(campaign)}`, { scroll: false })
  }

  const handleBack = () => {
    setSelectedCampaign(null)
    router.replace('/campaigns', { scroll: false })
  }

  if (selectedCampaign) {
    return <CampaignDetail campaign={selectedCampaign} onBack={handleBack} />
  }

  return (
    <CampaignList
      campaigns={campaigns}
      loading={loading}
      onSelect={handleSelect}
      onRefresh={fetchCampaigns}
    />
  )
}
