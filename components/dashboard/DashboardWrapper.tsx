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
    notifications.forEach((notification) => {
      if (notification.type === 'document_processed') {
        addToast({
          type: 'success',
          title: 'העיבוד הושלם! 🎉',
          description: `נמצאו ${notification.transactionsCount} הוצאות חדשות`,
          action: {
            label: 'לחץ לאישור',
            onClick: () => {
              router.push('/dashboard/expenses/pending')
              clearNotification(notification.statementId)
            },
          },
          duration: 10000, // 10 seconds
        })
        
        // Clear after showing
        setTimeout(() => {
          clearNotification(notification.statementId)
        }, 10000)
      }
    })
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

