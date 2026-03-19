'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/lib/date'

interface Props {
  clinicId: number
  clinicName: string
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

type Platform = 'meta_ads' | 'google_ads' | 'tiktok_ads'

interface PlatformConfig {
  config: Record<string, string> | null
  is_active: boolean
  last_tested_at: string | null
  last_test_result: string | null
}

interface TestResultState {
  loading: boolean
  success: boolean | null
  message: string
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta_ads: 'Meta',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
}

const PLATFORM_FIELDS: Record<Platform, { key: string; label: string; placeholder: string }[]> = {
  meta_ads: [
    { key: 'account_id', label: '광고 계정 ID', placeholder: 'act_xxxxxxxxxx' },
    { key: 'access_token', label: '액세스 토큰', placeholder: '액세스 토큰을 입력하세요' },
  ],
  google_ads: [
    { key: 'client_id', label: 'Client ID', placeholder: 'xxxxxx.apps.googleusercontent.com' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'Client Secret을 입력하세요' },
    { key: 'developer_token', label: 'Developer Token', placeholder: 'Developer Token을 입력하세요' },
    { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890' },
    { key: 'refresh_token', label: 'Refresh Token', placeholder: 'Refresh Token을 입력하세요' },
  ],
  tiktok_ads: [
    { key: 'advertiser_id', label: 'Advertiser ID', placeholder: 'Advertiser ID를 입력하세요' },
    { key: 'access_token', label: 'Access Token', placeholder: 'Access Token을 입력하세요' },
  ],
}

const EMPTY_CONFIG: PlatformConfig = {
  config: null,
  is_active: false,
  last_tested_at: null,
  last_test_result: null,
}

function isMaskedValue(value: string): boolean {
  return value.startsWith('****')
}

export default function ClinicApiConfigDialog({ clinicId, clinicName, open, onClose, onUpdated }: Props) {
  const [configs, setConfigs] = useState<Record<Platform, PlatformConfig>>({
    meta_ads: { ...EMPTY_CONFIG },
    google_ads: { ...EMPTY_CONFIG },
    tiktok_ads: { ...EMPTY_CONFIG },
  })
  const [formValues, setFormValues] = useState<Record<Platform, Record<string, string>>>({
    meta_ads: {},
    google_ads: {},
    tiktok_ads: {},
  })
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Platform | null>(null)
  const [deleting, setDeleting] = useState<Platform | null>(null)
  const [testResults, setTestResults] = useState<Record<Platform, TestResultState>>({
    meta_ads: { loading: false, success: null, message: '' },
    google_ads: { loading: false, success: null, message: '' },
    tiktok_ads: { loading: false, success: null, message: '' },
  })
  const [activeTab, setActiveTab] = useState<Platform>('meta_ads')

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/api-configs`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      const items: Array<{
        platform: Platform
        config: Record<string, string> | null
        is_active: boolean
        last_tested_at: string | null
        last_test_result: string | null
      }> = Array.isArray(data) ? data : (data.data || [])

      const newConfigs: Record<Platform, PlatformConfig> = {
        meta_ads: { ...EMPTY_CONFIG },
        google_ads: { ...EMPTY_CONFIG },
        tiktok_ads: { ...EMPTY_CONFIG },
      }
      const newFormValues: Record<Platform, Record<string, string>> = {
        meta_ads: {},
        google_ads: {},
        tiktok_ads: {},
      }

      for (const item of items) {
        if (item.platform in newConfigs) {
          newConfigs[item.platform] = {
            config: item.config,
            is_active: item.is_active,
            last_tested_at: item.last_tested_at,
            last_test_result: item.last_test_result,
          }
          if (item.config) {
            const values: Record<string, string> = {}
            for (const [k, v] of Object.entries(item.config)) {
              values[k] = typeof v === 'string' ? v : String(v ?? '')
            }
            newFormValues[item.platform] = values
          }
        }
      }

      setConfigs(newConfigs)
      setFormValues(newFormValues)
      setTestResults({
        meta_ads: { loading: false, success: null, message: '' },
        google_ads: { loading: false, success: null, message: '' },
        tiktok_ads: { loading: false, success: null, message: '' },
      })
    } catch {
      toast.error('API 설정 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    if (open) {
      fetchConfigs()
      setVisibleFields({})
    }
  }, [open, fetchConfigs])

  const updateField = (platform: Platform, key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value },
    }))
  }

  const toggleVisibility = (fieldKey: string) => {
    setVisibleFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))
  }

  const handleSave = async (platform: Platform) => {
    const values = formValues[platform]

    // 마스킹 값 제외, 실제 입력된 값만 전송
    const finalConfig: Record<string, string> = {}
    for (const field of PLATFORM_FIELDS[platform]) {
      const val = values[field.key] || ''
      if (val && !isMaskedValue(val)) {
        finalConfig[field.key] = val
      }
    }

    if (Object.keys(finalConfig).length === 0 && !configs[platform].config) {
      toast.error('최소 하나의 필드를 입력해주세요.')
      return
    }

    setSaving(platform)
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/api-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config: finalConfig, is_active: configs[platform].is_active }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      toast.success(`${PLATFORM_LABELS[platform]} API 설정이 저장되었습니다.`)
      await fetchConfigs()
      onUpdated?.()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장 실패'
      toast.error(message)
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (platform: Platform) => {
    setTestResults(prev => ({
      ...prev,
      [platform]: { loading: true, success: null, message: '' },
    }))

    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/api-configs/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      const result = data.data || data

      if (result.success) {
        setTestResults(prev => ({
          ...prev,
          [platform]: {
            loading: false,
            success: true,
            message: result.accountName || '연결됨',
          },
        }))
        // Refresh to get updated last_tested_at
        await fetchConfigs()
        onUpdated?.()
      } else {
        setTestResults(prev => ({
          ...prev,
          [platform]: {
            loading: false,
            success: false,
            message: result.error || '연결 실패',
          },
        }))
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [platform]: {
          loading: false,
          success: false,
          message: '연결 테스트 요청에 실패했습니다.',
        },
      }))
    }
  }

  const handleDelete = async (platform: Platform) => {
    if (!confirm(`${PLATFORM_LABELS[platform]} API 설정을 삭제하시겠습니까?`)) return

    setDeleting(platform)
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/api-configs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '삭제 실패')
      }
      toast.success(`${PLATFORM_LABELS[platform]} API 설정이 삭제되었습니다.`)
      await fetchConfigs()
      onUpdated?.()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '삭제 실패'
      toast.error(message)
    } finally {
      setDeleting(null)
    }
  }

  const renderPlatformTab = (platform: Platform) => {
    const fields = PLATFORM_FIELDS[platform]
    const config = configs[platform]
    const values = formValues[platform]
    const testResult = testResults[platform]
    const hasExistingConfig = !!config.config

    return (
      <div className="space-y-4 p-4 md:p-5">
        {fields.map(field => {
          const visKey = `${platform}_${field.key}`
          const isVisible = visibleFields[visKey] || false
          const value = values[field.key] || ''
          const isMasked = isMaskedValue(value)

          return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <div className="relative">
                <Input
                  type={isVisible ? 'text' : 'password'}
                  value={value}
                  onChange={e => updateField(platform, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="pr-10"
                  onFocus={() => {
                    // Clear masked value on focus so user can type fresh
                    if (isMasked) {
                      updateField(platform, field.key, '')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(visKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isVisible ? '숨기기' : '보기'}
                >
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )
        })}

        <div className="flex items-center justify-between pt-2">
          <Label className="text-xs text-muted-foreground">활성화</Label>
          <Switch
            checked={config.is_active}
            onCheckedChange={checked => {
              setConfigs(prev => ({
                ...prev,
                [platform]: { ...prev[platform], is_active: checked },
              }))
            }}
          />
        </div>

        {/* Test result area */}
        <div className="space-y-2 pt-2">
          {testResult.loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              연결 테스트 중...
            </div>
          )}
          {!testResult.loading && testResult.success === true && (
            <p className="text-sm text-emerald-500">
              &#10003; 연결됨 &mdash; {testResult.message}
            </p>
          )}
          {!testResult.loading && testResult.success === false && (
            <p className="text-sm text-red-500">
              &#10007; 연결 실패 &mdash; {testResult.message}
            </p>
          )}
          {config.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              마지막 테스트: {formatDateTime(config.last_tested_at)}
              {config.last_test_result === 'success' && (
                <span className="ml-2 text-emerald-500">성공</span>
              )}
              {config.last_test_result === 'failed' && (
                <span className="ml-2 text-red-500">실패</span>
              )}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => handleTest(platform)}
            variant="outline"
            size="sm"
            disabled={!hasExistingConfig || testResult.loading}
          >
            {testResult.loading ? (
              <><Loader2 size={14} className="animate-spin" /> 테스트 중</>
            ) : (
              '연결 테스트'
            )}
          </Button>
          <Button
            onClick={() => handleSave(platform)}
            size="sm"
            className="bg-brand-600 hover:bg-brand-700"
            disabled={saving === platform}
          >
            {saving === platform ? '저장 중...' : '저장'}
          </Button>
          {hasExistingConfig && (
            <Button
              onClick={() => handleDelete(platform)}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 ml-auto"
              disabled={deleting === platform}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{clinicName} &mdash; API 설정</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Platform)}>
            <TabsList className="w-full">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
                <TabsTrigger key={p} value={p} className="flex-1 text-xs">
                  {PLATFORM_LABELS[p]}
                  {configs[p].config && (
                    <span
                      className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                        configs[p].last_test_result === 'success'
                          ? 'bg-emerald-500'
                          : configs[p].last_test_result === 'failed'
                            ? 'bg-red-500'
                            : 'bg-muted-foreground/40'
                      }`}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
              <TabsContent key={p} value={p}>
                {renderPlatformTab(p)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
