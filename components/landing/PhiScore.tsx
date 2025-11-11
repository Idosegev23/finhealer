'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface PhiScoreProps {
  score?: number
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  showLabel?: boolean
}

export default function PhiScore({ 
  score = 73, 
  size = 'md',
  animated = true,
  showLabel = true
}: PhiScoreProps) {
  const [displayScore, setDisplayScore] = useState(0)
  
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      return
    }

    let current = 0
    const increment = score / 60
    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        setDisplayScore(score)
        clearInterval(timer)
      } else {
        setDisplayScore(Math.floor(current))
      }
    }, 16)

    return () => clearInterval(timer)
  }, [score, animated])

  const sizes = {
    sm: { circle: 100, stroke: 8, text: 'text-2xl', label: 'text-sm' },
    md: { circle: 150, stroke: 12, text: 'text-4xl', label: 'text-base' },
    lg: { circle: 200, stroke: 16, text: 'text-6xl', label: 'text-lg' },
  }

  const { circle, stroke, text, label } = sizes[size]
  const radius = (circle - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (displayScore / 100) * circumference

  // Color based on score
  const getColor = (s: number) => {
    if (s >= 80) return '#8FBCBB' // mint - excellent
    if (s >= 60) return '#A96B48' // gold - good
    if (s >= 40) return '#D08770' // coral - fair
    return '#BF616A' // red - needs work
  }

  const getLabel = (s: number) => {
    if (s >= 80) return 'מצוין'
    if (s >= 60) return 'טוב'
    if (s >= 40) return 'בסדר'
    return 'דרוש שיפור'
  }

  const color = getColor(displayScore)
  const scoreLabel = getLabel(displayScore)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: circle, height: circle }}>
        {/* Background Circle */}
        <svg width={circle} height={circle} className="transform -rotate-90">
          <circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke="#ECEFF4"
            strokeWidth={stroke}
            fill="none"
          />
          {/* Progress Circle */}
          <motion.circle
            cx={circle / 2}
            cy={circle / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? circumference : offset}
            animate={animated ? { strokeDashoffset: offset } : {}}
            transition={{ duration: 2, ease: "easeOut" }}
          />
        </svg>

        {/* Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div 
            className={`${text} font-bold`}
            style={{ color }}
            initial={animated ? { opacity: 0, scale: 0.5 } : {}}
            animate={animated ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {displayScore}
          </motion.div>
          <div className="text-sm text-phi-slate font-medium">ϕ Score</div>
        </div>
      </div>

      {showLabel && (
        <motion.div
          className={`${label} font-bold px-4 py-2 rounded-full`}
          style={{ 
            backgroundColor: `${color}20`,
            color 
          }}
          initial={animated ? { opacity: 0, y: 10 } : {}}
          animate={animated ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          {scoreLabel}
        </motion.div>
      )}
    </div>
  )
}

