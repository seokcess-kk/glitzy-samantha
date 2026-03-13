import { NextResponse } from 'next/server'
import { withClinicFilter, ClinicContext } from '@/lib/api-middleware'
import { syncPressForClinic } from '@/lib/services/pressSync'

export const POST = withClinicFilter(async (req: Request, { clinicId }: ClinicContext) => {
  const inserted = await syncPressForClinic(clinicId)
  return NextResponse.json({ inserted })
})
