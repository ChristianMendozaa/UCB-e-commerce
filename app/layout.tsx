import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
