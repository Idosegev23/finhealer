'use client'

import { motion } from 'framer-motion'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

interface PhiScoreWidgetProps {
  score: number | null
  className?: string
}

const getScoreMessage = (score: number): { message: string; color: string } => {
  if (score >= 86) return { message: 'יחס זהב!', color: 'text-phi-mint' }
  if (score >= 71) return { message: 'מעולה!', color: 'text-phi-mint' }
  if (score >= 51) return { message: 'מצב טוב', color: 'text-phi-gold' }
  if (score >= 31) return { message: 'בכיוון הנכון', color: 'text-phi-coral' }
  return { message: 'בוא נתחיל!', color: 'text-phi-coral' }
}

const getScoreGradient = (score: number): string => {
  if (score >= 70) return 'from-phi-mint to-phi-mint/70'
  if (score >= 50) return 'from-phi-gold to-phi-coral'
  return 'from-phi-coral to-phi-coral/70'
}

export function PhiScoreWidget({ score, className = '' }: PhiScoreWidgetProps) {
  const displayScore = score ?? 0
  const { message, color } = getScoreMessage(displayScore)
  const gradient = getScoreGradient(displayScore)
  
  // Calculate percentage for the circular progress
  const circumference = 2 * Math.PI * 45 // radius = 45
  const strokeDashoffset = circumference - (displayScore / 100) * circumference

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-phi-frost ${className}`}>
      <div className="flex flex-col items-center">
        {/* Circular Score */}
        <div className="relative w-36 h-36">
          {/* Background circle */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F2C166" />
                <stop offset="100%" stopColor="#1C8C63" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Score number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span 
              className="text-4xl font-bold text-phi-dark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {displayScore}
            </motion.span>
            <span className="text-xs text-phi-slate">ציון {PHI}</span>
          </div>
        </div>

        {/* Message */}
        <motion.p 
          className={`mt-4 font-medium ${color}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {message}
        </motion.p>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-phi-slate">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-phi-coral" />
            <span>0-50</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-phi-gold" />
            <span>51-70</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-phi-mint" />
            <span>71-100</span>
          </div>
        </div>
      </div>
    </div>
  )
}

