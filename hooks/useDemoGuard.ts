'use client'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

/**
 * 데모(demo_viewer) 모드에서 write 액션을 사전 차단하는 훅
 *
 * 사용:
 *   const { isDemoViewer, blockDemoWrite } = useDemoGuard()
 *   const handleSave = async () => {
 *     if (blockDemoWrite()) return
 *     // ...
 *   }
 *
 * 백엔드도 405로 차단하지만 클라이언트에서 미리 막아 다이얼로그/네트워크 노이즈 없이
 * 사용자에게 명확한 피드백 제공.
 */
export function useDemoGuard() {
  const { data: session } = useSession()
  const isDemoViewer = session?.user?.role === 'demo_viewer'

  const blockDemoWrite = (): boolean => {
    if (isDemoViewer) {
      toast.info('데모 모드입니다 — 변경 기능은 비활성화되어 있습니다.')
      return true
    }
    return false
  }

  return { isDemoViewer, blockDemoWrite }
}
