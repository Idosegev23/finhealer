import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FinHealer - תוכנית ההבראה הפיננסית הדיגיטלית',
  description: 'מערכת מתקדמת לניהול ושיפור המצב הפיננסי האישי, עם בוט WhatsApp חכם, בינה מלאכותית ומעקב בזמן אמת.',
  keywords: ['ניהול תקציב', 'בריאות פיננסית', 'חיסכון', 'מעקב הוצאות', 'יעדים פיננסיים'],
  authors: [{ name: 'FinHealer' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: '#3A7BD5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className={`${heebo.className} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

