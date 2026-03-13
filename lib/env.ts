/**
 * 환경변수 검증 모듈
 * - 서비스별 필수 환경변수 그룹 정의
 * - 앱 시작 시 검증 수행
 */

type EnvGroup = {
  name: string
  required: string[]
  optional?: string[]
}

// 서비스별 환경변수 그룹 정의
const ENV_GROUPS: EnvGroup[] = [
  {
    name: 'Supabase',
    required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    name: 'NextAuth',
    required: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
  },
  {
    name: 'Cron',
    required: ['CRON_SECRET'],
  },
  {
    name: 'Google Ads',
    required: [],
    optional: [
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_REFRESH_TOKEN',
    ],
  },
  {
    name: 'Meta Ads',
    required: [],
    optional: ['META_APP_ID', 'META_APP_SECRET'],
  },
  {
    name: 'TikTok Ads',
    required: [],
    optional: ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET'],
  },
  {
    name: 'QStash',
    required: [],
    optional: [
      'QSTASH_TOKEN',
      'QSTASH_CURRENT_SIGNING_KEY',
      'QSTASH_NEXT_SIGNING_KEY',
    ],
  },
  {
    name: 'Kakao',
    required: [],
    optional: [
      'KAKAO_API_KEY',
      'KAKAO_SENDER_KEY',
      'KAKAO_USER_ID',
      'KAKAO_TEMPLATE_CODE',
      'KAKAO_SENDER_NUMBER',
    ],
  },
  {
    name: 'AI',
    required: [],
    optional: ['ANTHROPIC_API_KEY'],
  },
]

export interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 환경변수 검증
 * @param throwOnError true면 에러 시 예외 발생, false면 결과 객체 반환
 */
export function validateEnv(throwOnError: boolean = false): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const group of ENV_GROUPS) {
    // 필수 환경변수 검증
    const missingRequired = group.required.filter((key) => !process.env[key])
    if (missingRequired.length > 0) {
      errors.push(`[${group.name}] 필수 환경변수 누락: ${missingRequired.join(', ')}`)
    }

    // 선택 환경변수 중 일부만 설정된 경우 경고
    if (group.optional && group.optional.length > 0) {
      const setOptional = group.optional.filter((key) => process.env[key])
      const unsetOptional = group.optional.filter((key) => !process.env[key])

      // 일부만 설정된 경우 (전체 설정 또는 전체 미설정이 아닌 경우)
      if (setOptional.length > 0 && unsetOptional.length > 0) {
        warnings.push(
          `[${group.name}] 일부 환경변수만 설정됨. 누락: ${unsetOptional.join(', ')}`
        )
      }
    }
  }

  const result: EnvValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  }

  if (throwOnError && !result.valid) {
    throw new Error(`환경변수 검증 실패:\n${errors.join('\n')}`)
  }

  return result
}

/**
 * 특정 서비스의 환경변수가 설정되어 있는지 확인
 */
export function isServiceConfigured(serviceName: string): boolean {
  const group = ENV_GROUPS.find((g) => g.name === serviceName)
  if (!group) return false

  // 필수 환경변수가 모두 설정되어 있어야 함
  const hasAllRequired = group.required.every((key) => process.env[key])
  if (!hasAllRequired) return false

  // 선택 환경변수 중 하나라도 설정되어 있으면 true
  if (group.optional && group.optional.length > 0) {
    return group.optional.some((key) => process.env[key])
  }

  return true
}

/**
 * 환경변수 값 가져오기 (타입 안전)
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value !== undefined) return value
  if (defaultValue !== undefined) return defaultValue
  throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`)
}

/**
 * 환경변수 값 가져오기 (선택적)
 */
export function getEnvOptional(key: string): string | undefined {
  return process.env[key]
}

/**
 * 숫자 환경변수 값 가져오기
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key]
  if (value !== undefined) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) return parsed
  }
  if (defaultValue !== undefined) return defaultValue
  throw new Error(`환경변수 ${key}가 설정되지 않았거나 유효한 숫자가 아닙니다.`)
}

/**
 * 불리언 환경변수 값 가져오기
 * - "true", "1", "yes" → true
 * - "false", "0", "no", 미설정 → false
 */
export function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key]?.toLowerCase()
  if (value === undefined) return defaultValue
  return ['true', '1', 'yes'].includes(value)
}
