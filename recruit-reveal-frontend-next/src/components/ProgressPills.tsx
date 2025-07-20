// ProgressPills.tsx (Clickable, animated)
'use client';
import { motion } from 'framer-motion';

export function ProgressPills({ total, current, onClick }: { total: number; current: number; onClick: (i: number) => void }) {
  return (
    <div className="flex space-x-2 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          onClick={() => onClick(i)}
          whileHover={{ scale: 1.2 }}
          className={`w-3 h-3 rounded-full cursor-pointer ${i === current ? 'bg-blue-600' : 'bg-gray-300'}`}
        />
      ))}
    </div>
  );
}