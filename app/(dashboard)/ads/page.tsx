'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useClinic } from '@/components/ClinicContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common'
import AttributionView from '@/components/attribution/AttributionView'
import AdsOverviewTab from '@/components/ads/ads-overview-tab'
import AdsCampaignTab from '@/components/ads/ads-campaign-tab'

const TABS = [
  { key: 'overview', label: '성과 개요' },
  { key: 'campaigns', label: '캠페인 분석' },
  { key: 'attribution', label: '매출 귀속' },
]

export default function AdsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  // Role guard — clinic_staff cannot access ads
  useEffect(() => {
    if (user?.role === 'clinic_staff') router.replace('/patients')
  }, [user, router])

  const { selectedClinicId } = useClinic()
  const [activeTab, setActiveTab] = useState('overview')
  const [days, setDays] = useState('30')
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Restore tab from URL on mount (avoids hydration mismatch)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'campaigns' || tab === 'attribution') setActiveTab(tab)
  }, [])

  // Sync tab selection to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'overview') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' })
      const data = await res.json()
      toast.success(
        `데이터 수집 완료 (Meta: ${data.results?.meta ?? 0}, Google: ${data.results?.google ?? 0}, TikTok: ${data.results?.tiktok ?? 0})`
      )
      handleRefresh()
    } catch {
      toast.error('동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  const showActions = activeTab === 'overview' || activeTab === 'campaigns'

  return (
    <>
      <PageHeader
        title="광고 성과"
        description={
          activeTab === 'attribution'
            ? '채널/캠페인별 실제 결제 매출 귀속 분석'
            : 'Meta / Google / TikTok 광고 지출 및 성과 데이터.'
        }
        actions={
          showActions ? (
            <>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-[130px] glass-card border-0 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[7, 14, 30, 90].map(d => (
                    <SelectItem key={d} value={String(d)}>
                      최근 {d}일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw size={16} />
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-brand-600 hover:bg-brand-700"
              >
                <Play size={14} /> {syncing ? '수집 중...' : '지금 데이터 수집'}
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border dark:border-white/5 pb-px">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <AdsOverviewTab key={`overview-${days}-${refreshKey}`} days={days} />
      )}
      {activeTab === 'campaigns' && (
        <AdsCampaignTab key={`campaigns-${days}-${refreshKey}`} days={days} />
      )}
      {activeTab === 'attribution' && <AttributionView />}
    </>
  )
}
