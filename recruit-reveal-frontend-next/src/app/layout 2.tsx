// File: src/app/layout.tsx
'use client'

import React, { useEffect } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { DarkModeProvider, useDarkMode } from '@recruit/components/DarkModeContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

function ThemedContainer({ children }: { children: React.ReactNode }) {
  const { darkMode } = useDarkMode()

  useEffect(() => {
    document.body.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DarkModeProvider>
          <ThemedContainer>{children}</ThemedContainer>
        </DarkModeProvider>
      </body>
    </html>
  )
}
