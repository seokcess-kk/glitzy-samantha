import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      role: 'superadmin' | 'clinic_admin'
      clinic_id: number | null
    } & DefaultSession['user']
  }

  interface User {
    role: 'superadmin' | 'clinic_admin'
    clinic_id: number | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'superadmin' | 'clinic_admin'
    clinic_id: number | null
    username: string
  }
}
