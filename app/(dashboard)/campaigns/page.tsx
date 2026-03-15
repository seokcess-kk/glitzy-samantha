'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Megaphone, ArrowLeft, Phone, Clock, ChevronRight, RefreshCw, MessageCircle, FileText, User } from 'lucide-react'
import { useClinic } from '@/components/ClinicContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, ChannelBadge } from '@/components/common'

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
  customer: { id: number; name: string; phone_number: string; first_source: string } | null
  landing_page: { id: number; name: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
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
          { label: '활성 캠페인', value: campaigns.length, color: 'text-white' },
          { label: '전체 리드', value: totalLeads, color: 'text-brand-400' },
          { label: '오늘 유입', value: todayLeads, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} variant="glass" className="p-4 text-center">
            {loading ? <Skeleton className="h-7 w-12 mx-auto mb-1" /> : (
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">{label}</p>
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
                <Megaphone size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">진행 중인 캠페인이 없습니다.</p>
              </Card>
            )
            : campaigns.map(c => (
              <button
                key={c.campaign}
                onClick={() => onSelect(c.campaign)}
                className="w-full p-4 text-left transition-all rounded-2xl hover:ring-1 hover:ring-brand-500/50"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center shrink-0">
                    <Megaphone size={18} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white truncate">{c.campaign}</p>
                      <ChannelBadge channel={c.channel} />
                      {c.today_count > 0 && (
                        <Badge variant="success" className="text-[10px]">+{c.today_count} today</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
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
                  <ChevronRight size={16} className="text-slate-600 shrink-0" />
                </div>
              </button>
            ))
        }
      </div>
    </>
  )
}

// ─── 캠페인 상세 리드 목록 ───

function CampaignDetail({ campaign, onBack }: { campaign: string; onBack: () => void }) {
  const { selectedClinicId } = useClinic()
  const [leads, setLeads] = useState<CampaignLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ campaign })
    if (selectedClinicId) params.set('clinic_id', String(selectedClinicId))
    fetch(`/api/campaigns?${params}`)
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [campaign, selectedClinicId])

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white mb-3">
          <ArrowLeft size={14} /> 캠페인 목록
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <Megaphone size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{campaign}</h1>
            <p className="text-xs text-slate-500">
              {loading ? '로딩 중...' : `${leads.length}건의 리드`}
            </p>
          </div>
        </div>
      </div>

      {/* 리드 목록 */}
      <div className="space-y-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : leads.length === 0
            ? (
              <Card variant="glass" className="p-8 text-center text-slate-500 text-sm">
                이 캠페인에서 유입된 리드가 없습니다.
              </Card>
            )
            : leads.map(lead => (
              <div
                key={lead.id}
                className="px-4 py-3 flex items-center gap-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="w-9 h-9 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                  {lead.customer?.name?.[0] || <User size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white truncate">
                      {lead.customer?.name || '이름 없음'}
                    </p>
                    <ChannelBadge channel={lead.utm_source || '-'} />
                    {lead.chatbot_sent ? (
                      <Badge variant="success" className="text-[10px]">발송완료</Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px]">대기</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Phone size={10} />
                      {lead.customer?.phone_number || '-'}
                    </span>
                    {lead.landing_page && (
                      <span className="flex items-center gap-1 truncate">
                        <FileText size={10} />
                        {lead.landing_page.name}
                      </span>
                    )}
                    {lead.utm_content && (
                      <span className="text-slate-600 truncate">· {lead.utm_content}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">{timeAgo(lead.created_at)}</p>
                  <p className="text-[10px] text-slate-600">
                    {new Date(lead.created_at).toLocaleString('ko', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
        }
      </div>
    </>
  )
}

// ─── 메인 ───

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 text-center py-12">로딩 중...</div>}>
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
