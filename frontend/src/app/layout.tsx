import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/components/providers/WalletProvider'
import { NotificationProvider } from '@/components/providers/NotificationProvider'
import { PWAProvider } from '@/components/providers/PWAProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PredictionPump',
  description: 'Decentralized prediction markets with viral mechanics',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PredictionPump',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'PredictionPump',
    title: 'PredictionPump - Decentralized Prediction Markets',
    description: 'Trade prediction markets with viral mechanics on Solana',
  },
  twitter: {
    card: 'summary',
    title: 'PredictionPump - Decentralized Prediction Markets',
    description: 'Trade prediction markets with viral mechanics on Solana',
  },
}

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PredictionPump" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <PWAProvider>
            <WalletProvider>
              <NotificationProvider>
                <OfflineIndicator />
                {children}
                <InstallPrompt />
              </NotificationProvider>
            </WalletProvider>
          </PWAProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}