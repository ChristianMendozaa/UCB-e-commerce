import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { CartProvider } from "@/contexts/cart-context"
import { Toaster } from "@/components/ui/toaster"
import { AssistantPanel } from "@/components/assistant-panel"
import { ChatWidget } from "@/components/chat-widget"
import { AssistantProvider } from "@/contexts/assistant-context"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthWatcher } from "@/components/auth-watcher"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "UCB Store - Universidad Católica Boliviana",
  description: "Plataforma de e-commerce oficial de la Universidad Católica Boliviana San Pablo",
  keywords: ["UCB", "Universidad Católica Boliviana", "e-commerce", "tienda universitaria", "productos académicos"],
  authors: [{ name: "Universidad Católica Boliviana" }],
  creator: "UCB",
  publisher: "Universidad Católica Boliviana",
  icons: {
    icon: "/ucb-logo.png",
    shortcut: "/ucb-logo.png",
    apple: "/ucb-logo.png",
  },
  openGraph: {
    title: "UCB Store - Universidad Católica Boliviana",
    description: "Plataforma de e-commerce oficial de la Universidad Católica Boliviana San Pablo",
    url: "https://ucb-store.vercel.app",
    siteName: "UCB Store",
    locale: "es_BO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UCB Store - Universidad Católica Boliviana",
    description: "Plataforma de e-commerce oficial de la Universidad Católica Boliviana San Pablo",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const assistantV2Enabled = process.env.NEXT_PUBLIC_ASSISTANT_V2_ENABLED !== "false"
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CartProvider>
            <AssistantProvider>
              <Suspense fallback={null}>{children}</Suspense>
              <AuthWatcher />
              <Toaster />
              {assistantV2Enabled ? <AssistantPanel /> : <ChatWidget />}
            </AssistantProvider>
          </CartProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
