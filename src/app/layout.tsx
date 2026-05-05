import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ProfCheck - Gestion de présence',
  description: 'Système de pointage intelligent pour centres de langues. Suivi des heures de travail des professeurs avec QR code et GPS.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/cambridge_campus_rabat_logo.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
