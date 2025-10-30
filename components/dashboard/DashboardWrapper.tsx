"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ToasterProvider, useToast } from "@/components/ui/toaster"
import { useNotifications } from "@/lib/hooks/useNotifications"

function NotificationsListener() {
  const router = useRouter()
  const { addToast } = useToast()
  const { notifications, clearNotification } = useNotifications()

  useEffect(() => {
    // הוסר Toast - במקום זה יש באנר בדשבורד
    // notifications.forEach((notification) => {
    //   if (notification.type === 'document_processed') {
    //     addToast({...})
    //   }
    // })
  }, [notifications, addToast, router, clearNotification])

  return null
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationsListener />
      {children}
    </>
  )
}

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToasterProvider>
      <DashboardContent>{children}</DashboardContent>
    </ToasterProvider>
  )
}

