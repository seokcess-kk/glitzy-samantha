import crypto from 'crypto'

/**
 * 솔라피 SMS 발송 헬퍼
 * @see https://docs.solapi.com/api-reference/messages/sendsimplemessage
 */

function getAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('SOLAPI_API_KEY / SOLAPI_API_SECRET 미설정')

  const date = new Date().toISOString()
  const salt = crypto.randomUUID()
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

interface SendSmsOptions {
  to: string
  text: string
  from?: string
}

export async function sendSms({ to, text, from }: SendSmsOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const senderNumber = from || process.env.SOLAPI_SENDER_NUMBER
  if (!senderNumber) return { success: false, error: 'SOLAPI_SENDER_NUMBER 미설정' }

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: senderNumber.replace(/-/g, ''),
          text,
          type: text.length > 45 ? 'LMS' : 'SMS',
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.errorMessage || data.errorCode || 'SMS 발송 실패' }
    }

    return { success: true, messageId: data.messageId }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'SMS 발송 오류' }
  }
}
