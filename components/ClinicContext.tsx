'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface ClinicContextType {
  selectedClinicId: number | null
  setSelectedClinicId: (id: number | null) => void
  clinics: { id: number; name: string; slug: string }[]
  isSuperAdmin: boolean
  isAgencyStaff: boolean
}

const ClinicContext = createContext<ClinicContextType>({
  selectedClinicId: null,
  setSelectedClinicId: () => {},
  clinics: [],
  isSuperAdmin: false,
  isAgencyStaff: false,
})

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'superadmin'
  const isAgencyStaff = user?.role === 'agency_staff'

  const [selectedClinicId, setSelectedClinicIdState] = useState<number | null>(null)
  const [clinics, setClinics] = useState<any[]>([])

  useEffect(() => {
    if (isSuperAdmin) {
      fetch('/api/admin/clinics')
        .then(r => r.json())
        .then(d => setClinics(Array.isArray(d) ? d : []))
        .catch(() => {})
      const saved = localStorage.getItem('mmi_selected_clinic')
      if (saved) setSelectedClinicIdState(Number(saved))
    } else if (isAgencyStaff) {
      fetch('/api/my/clinics')
        .then(r => r.json())
        .then(d => {
          const list = Array.isArray(d) ? d : []
          setClinics(list)
          // 배정된 병원이 1개면 자동 선택
          if (list.length === 1) setSelectedClinicIdState(list[0].id)
          else {
            const saved = localStorage.getItem('mmi_selected_clinic')
            if (saved) {
              const savedId = Number(saved)
              if (list.some((c: any) => c.id === savedId)) setSelectedClinicIdState(savedId)
            }
          }
        })
        .catch(() => {})
    } else if (user?.clinic_id) {
      setSelectedClinicIdState(user.clinic_id)
    }
  }, [isSuperAdmin, isAgencyStaff, user?.clinic_id])

  const setSelectedClinicId = (id: number | null) => {
    setSelectedClinicIdState(id)
    if (id) localStorage.setItem('mmi_selected_clinic', String(id))
    else localStorage.removeItem('mmi_selected_clinic')
  }

  return (
    <ClinicContext.Provider value={{ selectedClinicId, setSelectedClinicId, clinics, isSuperAdmin, isAgencyStaff }}>
      {children}
    </ClinicContext.Provider>
  )
}

export const useClinic = () => useContext(ClinicContext)
