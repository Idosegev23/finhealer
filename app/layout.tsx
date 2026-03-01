import type { Metadata } from 'next'
import { Heebo, Inter } from 'next/font/google'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heebo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Phi (ϕ) - היחס הזהב של הכסף שלך',
  description: 'פלטפורמה חכמה לבריאות פיננסית עם ליווי אישי. מעקב אוטומטי, תובנות מבוססות AI, ובוט WhatsApp חכם. גלה את ה-ϕ שלך - האיזון המושלם בין הכנסות להוצאות.',
  keywords: ['phi', 'בריאות פיננסית', 'ניהול תקציב', 'חיסכון', 'מעקב הוצאות', 'יעדים פיננסיים', 'ליווי פיננסי'],
  authors: [{ name: 'Phi - גדי' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: '#2E3440',
  openGraph: {
    title: 'Phi (ϕ) - היחס הזהב של הכסף שלך',
    description: 'פלטפורמה חכמה לבריאות פיננסית עם ליווי אישי, מעקב אוטומטי ובוט WhatsApp חכם.',
    url: 'https://finhealer.vercel.app',
    siteName: 'Phi - FinHealer',
    locale: 'he_IL',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Phi Logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Phi (ϕ) - היחס הזהב של הכסף שלך',
    description: 'פלטפורמה חכמה לבריאות פיננסית עם ליווי אישי',
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
      <body className={`${heebo.className} antialiased bg-white text-black`}>
          {children}
      </body>
    </html>
  )
}

