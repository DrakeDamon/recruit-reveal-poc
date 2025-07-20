// src/components/ChatThread.tsx
'use client'
import { useEffect, useRef } from 'react'

export default function ChatThread({
  messages,
}: {
  messages: { from: 'app' | 'user'; text: string }[]
}) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [
    messages,
  ])
  return (
    <div className="space-y-4 overflow-auto">
      {messages.map((m, i) => (
        <div
          key={i}
          className={
            m.from === 'app' ? 'bubble-app max-w-3/4' : 'bubble-user max-w-3/4 ml-auto'
          }
        >
          {m.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
