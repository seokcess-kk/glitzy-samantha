'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface ClinicContextType {
  selectedClinicId: number | null
  setSelectedClinicId: (id: number | null) => void
  clinics: { id: number; name: string; slug: string }[]
  isSuperAdmin: boolean
}

const ClinicContext = createContext<ClinicContextType>({
  selectedClinicId: null,
  setSelectedClinicId: () => {},
  clinics: [],
  isSuperAdmin: false,
})

export function ClinicProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'superadmin'

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
    } else if (user?.clinic_id) {
      setSelectedClinicIdState(user.clinic_id)
    }
  }, [isSuperAdmin, user?.clinic_id])

  const setSelectedClinicId = (id: number | null) => {
    setSelectedClinicIdState(id)
    if (id) localStorage.setItem('mmi_selected_clinic', String(id))
    else localStorage.removeItem('mmi_selected_clinic')
  }

  return (
    <ClinicContext.Provider value={{ selectedClinicId, setSelectedClinicId, clinics, isSuperAdmin }}>
      {children}
    </ClinicContext.Provider>
  )
}

export const useClinic = () => useContext(ClinicContext)
