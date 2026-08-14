import type { Metadata, Viewport } from 'next'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import AugustFeedbackProvider from '@/components/ui/AugustFeedback'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Amado — маркетинг для Бразилии',
    template: '%s · Amado',
  },
  description: 'AI-рабочее пространство маркетолога: рынок, бренд, конкуренты, контент и измеримые результаты.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Amado',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Amado',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/amado-icon.svg?v=4', type: 'image/svg+xml', sizes: 'any' },
      { url: '/amado-icon-192.png?v=4', type: 'image/png', sizes: '192x192' },
      { url: '/amado-icon-512.png?v=4', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=4', type: 'image/png', sizes: '180x180' }],
    shortcut: [{ url: '/amado-icon.svg?v=4', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#15172A',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AugustFeedbackProvider>
          {children}
          <PwaInstallPrompt />
        </AugustFeedbackProvider>
      </body>
    </html>
  )
}
