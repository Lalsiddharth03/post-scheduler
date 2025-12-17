"use client"

import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster position="top-right" />
    </AuthProvider>
  )
}
