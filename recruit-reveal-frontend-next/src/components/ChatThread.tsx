'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatThread({ messages, stagger = false }: { messages: { from: 'app' | 'user'; text: string }[]; stagger: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: stagger ? i * 0.2 : 0,
        type: "spring" as const,
        stiffness: 300,
        damping: 30
      }
    }),
  };

  return (
    <div className="flex flex-col space-y-6 overflow-auto h-full max-h-[70vh] px-4 py-2">
      <AnimatePresence>
        {messages.map((m, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={variants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className={`relative ${m.from === 'app' ? 'self-start' : 'self-end'}`}
          >
            <div
              className={`
                ${m.from === 'app'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'bg-blue-500 dark:bg-blue-600 text-white'
                }
                rounded-2xl px-6 py-4 max-w-[75%] shadow-lg hover:shadow-xl transition-all duration-300
                relative overflow-hidden backdrop-blur-sm
                ${m.from === 'app' ? 'rounded-bl-md' : 'rounded-br-md'}
              `}
              style={{
                boxShadow: m.from === 'app'
                  ? '0 0 20px rgba(0,183,194,0.2), 0 4px 15px rgba(0,0,0,0.1)'
                  : '0 0 20px rgba(64,169,255,0.3), 0 4px 15px rgba(0,0,0,0.1)'
              }}
            >
              <div className="relative z-10 text-sm leading-relaxed">
                {m.text}
              </div>
              {/* Neon glow effect */}
              <div
                className={`absolute inset-0 rounded-2xl opacity-20 ${m.from === 'app' ? 'rounded-bl-md' : 'rounded-br-md'}`}
                style={{
                  background: m.from === 'app'
                    ? 'linear-gradient(135deg, rgba(0,183,194,0.1) 0%, rgba(0,150,160,0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(64,169,255,0.2) 0%, rgba(30,144,255,0.1) 100%)'
                }}
              />
            </div>
            {/* Typing indicator for app messages */}
            {m.from === 'app' && i === messages.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <div className="flex space-x-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="w-1 h-1 bg-current rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1 h-1 bg-current rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1 h-1 bg-current rounded-full"
                  />
                </div>
                <span className="ml-2">Recruit Reveal AI</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}