// ProgressPills.tsx (Clickable, animated with percentage display)
'use client';
import { motion } from 'framer-motion';

export function ProgressPills({ total, current, onClick }: { total: number; current: number; onClick: (i: number) => void }) {
  const percentage = Math.round(((current + 1) / total) * 100);
  
  return (
    <div className="flex flex-col items-center mb-6">
      {/* Percentage Display */}
      <motion.div 
        key={percentage}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="text-2xl font-bold mb-3"
        style={{
          background: 'linear-gradient(135deg, #00b7c2 0%, #4da3ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 0 20px rgba(77, 163, 255, 0.3)'
        }}
      >
        {percentage}%
      </motion.div>
      
      {/* Progress Pills */}
      <div className="flex space-x-3 items-center">
        {Array.from({ length: total }).map((_, i) => {
          const isCompleted = i < current;
          const isCurrent = i === current;
          const isPending = i > current;
          
          return (
            <motion.div
              key={i}
              onClick={() => onClick(i)}
              whileHover={{ scale: 1.3, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
              className={`
                relative cursor-pointer transition-all duration-300
                ${isCurrent ? 'w-6 h-6' : 'w-4 h-4'}
                rounded-full border-2
                ${isCompleted 
                  ? 'bg-green-500 border-green-400 shadow-lg' 
                  : isCurrent 
                    ? 'bg-blue-500 border-blue-400 shadow-xl' 
                    : 'bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500'
                }
              `}
              style={{
                boxShadow: isCurrent 
                  ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)' 
                  : isCompleted 
                    ? '0 0 15px rgba(34, 197, 94, 0.4)' 
                    : 'none'
              }}
            >
              {/* Pulsing ring for current step */}
              {isCurrent && (
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-2 border-blue-400"
                />
              )}
              
              {/* Checkmark for completed steps */}
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                >
                  ✓
                </motion.div>
              )}
              
              {/* Step number for current step */}
              {isCurrent && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold"
                >
                  {i + 1}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Progress Bar */}
      <div className="w-full max-w-md mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #00b7c2 0%, #4da3ff 100%)',
            boxShadow: '0 0 10px rgba(77, 163, 255, 0.5)'
          }}
        />
      </div>
    </div>
  );
}