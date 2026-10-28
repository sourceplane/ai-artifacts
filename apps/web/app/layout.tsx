import './globals.css'
import { ThemeProvider } from './providers'
import { Toaster } from '@/components/ui/toaster'
import { SITE_NAME } from '@/lib/site'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Open-source version of Anthropic's Artifacts",
}

// Upstream's Vercel Analytics, Google Tag Manager and PostHog are left out:
// no analytics ship with the product.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
