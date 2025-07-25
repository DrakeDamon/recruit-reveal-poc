// src/components/ChatThread.tsx (Unchanged, but confirming for completeness)
'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatThread({ messages, stagger = false }: { messages: { from: 'app' | 'user'; text: string }[]; stagger: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: stagger ? i * 0.2 : 0 } }),
  };

  return (
    <div className="space-y-4 overflow-auto h-[70vh]">
      <AnimatePresence>
        {messages.map((m, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={variants}
            initial="hidden"
            animate="visible"
            className={m.from === 'app' ? 'bg-gray-200 p-3 rounded-lg max-w-[75%]' : 'bg-blue-500 text-white p-3 rounded-lg max-w-[75%] ml-auto'}
          >
            {m.text}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}