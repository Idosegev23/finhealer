'use client'

import { motion } from 'framer-motion'

interface PhiAnimationProps {
  className?: string
}

export default function PhiAnimation({ className = '' }: PhiAnimationProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Main Phi Symbol */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
        }}
        transition={{ 
          duration: 1,
          ease: "easeOut"
        }}
      >
        <motion.div
          className="text-[120px] md:text-[180px] font-bold text-phi-gold"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          animate={{
            textShadow: [
              '0 0 20px rgba(169, 107, 72, 0.3)',
              '0 0 40px rgba(169, 107, 72, 0.6)',
              '0 0 20px rgba(169, 107, 72, 0.3)',
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          φ
        </motion.div>
      </motion.div>

      {/* Golden Ratio Spiral Background */}
      <motion.svg
        className="absolute inset-0 w-full h-full opacity-10"
        viewBox="0 0 500 500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1, rotate: 360 }}
        transition={{ 
          opacity: { duration: 2 },
          rotate: { duration: 60, repeat: Infinity, ease: "linear" }
        }}
      >
        {/* Golden Ratio Fibonacci Spiral */}
        <path
          d="M 250 250 Q 250 150, 350 150 Q 450 150, 450 250 Q 450 400, 300 400 Q 100 400, 100 200 Q 100 50, 250 50"
          stroke="rgba(169, 107, 72, 0.5)"
          strokeWidth="2"
          fill="none"
        />
      </motion.svg>

      {/* Orbiting Dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full bg-phi-mint"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [0, 60, 0, -60, 0],
            y: [0, -60, 0, 60, 0],
            opacity: [0.3, 0.8, 0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 1.3,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Background Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-phi-gold/20 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

