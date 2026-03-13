import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'

const SERVICE_NAME = 'PressSync'
const logger = createLogger(SERVICE_NAME)

interface PressItem {
  title: string
  source: string
  url: string
  published_at: string
}

function parseGoogleNewsRSS(xml: string): PressItem[] {
  const items: PressItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const raw = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? ''
    const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()

    const title = clean(raw('title'))
    const link = clean(raw('link'))
    const pubDate = clean(raw('pubDate'))
    const source = clean(raw('source'))

    // Google News redirect URL contains ?url=... param
    const urlMatch = link.match(/[?&]url=([^&]+)/)
    const finalUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : link

    if (title && finalUrl) {
      items.push({
        title,
        url: finalUrl,
        source: source || 'Unknown',
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      })
    }
  }
  return items
}

export async function syncPressForClinic(clinicId: number | null): Promise<number> {
  const supabase = serverSupabase()
  const startTime = Date.now()

  let clinicsQuery = supabase.from('clinics').select('id, name')
  if (clinicId) clinicsQuery = clinicsQuery.eq('id', clinicId)
  const { data: clinics } = await clinicsQuery
  if (!clinics?.length) return 0

  let totalInserted = 0
  const errors: string[] = []

  for (const clinic of clinics) {
    try {
      const q = encodeURIComponent(clinic.name)
      const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`

      const { response: res } = await fetchWithRetry(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MMI-Bot/1.0)' },
        service: SERVICE_NAME,
        timeout: 15000,
        retries: 2,
      })

      if (!res.ok) {
        errors.push(`Clinic ${clinic.id}: HTTP ${res.status}`)
        continue
      }

      const xml = await res.text()
      const items = parseGoogleNewsRSS(xml)
      if (!items.length) continue

      const rows = items.map(item => ({
        clinic_id: clinic.id,
        title: item.title,
        source: item.source,
        url: item.url,
        published_at: item.published_at,
        collected_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('press_coverage')
        .upsert(rows, { onConflict: 'clinic_id,url', ignoreDuplicates: true })

      if (error) {
        errors.push(`Clinic ${clinic.id}: DB error - ${error.message}`)
      } else {
        totalInserted += rows.length
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Clinic ${clinic.id}: ${message}`)
    }
  }

  const duration = Date.now() - startTime

  if (errors.length > 0) {
    logger.warn('Sync completed with errors', {
      action: 'sync',
      clinicsProcessed: clinics.length,
      totalInserted,
      errorCount: errors.length,
      duration
    })
  } else {
    logger.info('Sync completed', {
      action: 'sync',
      clinicsProcessed: clinics.length,
      totalInserted,
      duration
    })
  }

  return totalInserted
}
