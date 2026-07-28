import type { Metadata, Viewport } from 'next'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import './globals.css'

export const metadata: Metadata = {
  title: 'Amado — Content Pipeline para o Brasil',
  description: 'Ferramenta B2B para digital marketing managers adaptarem conteúdo ao mercado brasileiro.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Amado',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Amado',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-v2.svg?v=2', type: 'image/svg+xml' },
      { url: '/pwa-icon.svg?v=2', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/pwa-icon.svg?v=2', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#1E3A8A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
