import Sidebar from '@/components/Sidebar'
import { ClinicProvider } from '@/components/ClinicContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </ClinicProvider>
  )
}
