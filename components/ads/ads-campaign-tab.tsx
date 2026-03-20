'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClinic } from '@/components/ClinicContext'
import { Button } from '@/components/ui/button'
import CampaignRankingTable from '@/components/ads/campaign-ranking-table'
import CreativePerformance from '@/components/ads/CreativePerformance'

interface Props {
  days: string
}

export default function AdsCampaignTab({ days }: Props) {
  const { selectedClinicId } = useClinic()
  const [platformFilter, setPlatformFilter] = useState('all')
  const [platforms, setPlatforms] = useState<string[]>(['all'])

  const fetchPlatforms = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ days })
      if (selectedClinicId) qs.set('clinic_id', String(selectedClinicId))
      const res = await fetch(`/api/ads/stats?${qs}`)
      if (!res.ok) return
      const json = await res.json()
      const data = Array.isArray(json) ? json : []
      const unique = [...new Set(data.map((s: { platform?: string }) => s.platform).filter(Boolean))] as string[]
      setPlatforms(['all', ...unique])
    } catch {
      // silently fail — keep default ['all']
    }
  }, [days, selectedClinicId])

  useEffect(() => {
    fetchPlatforms()
  }, [fetchPlatforms])

  // Reset filter if the current filter is no longer in the platform list
  useEffect(() => {
    if (platformFilter !== 'all' && !platforms.includes(platformFilter)) {
      setPlatformFilter('all')
    }
  }, [platforms, platformFilter])

  return (
    <>
      <div className="flex gap-2 mb-6 flex-wrap">
        {platforms.map(p => (
          <Button
            key={p}
            variant={platformFilter === p ? 'default' : 'ghost'}
            onClick={() => setPlatformFilter(p)}
            className={platformFilter === p ? 'bg-brand-600 border-brand-600' : ''}
          >
            {p === 'all' ? '전체 매체' : p}
          </Button>
        ))}
      </div>
      <CampaignRankingTable
        days={days}
        platformFilter={platformFilter === 'all' ? undefined : platformFilter}
      />
      <CreativePerformance parentDays={days} />
    </>
  )
}
