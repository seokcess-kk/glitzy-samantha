import { withClinicFilter, apiSuccess } from '@/lib/api-middleware'
import { syncPressForClinic } from '@/lib/services/pressSync'

export const POST = withClinicFilter(async (req, { clinicId }) => {
  const inserted = await syncPressForClinic(clinicId)
  return apiSuccess({ inserted })
})
