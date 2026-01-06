'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

// ϕ = U+03D5 (mathematical phi - the golden ratio symbol)
const PHI = 'ϕ'

interface PhiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
  showText?: boolean
  className?: string
  href?: string
}

export default function PhiLogo({ 
  size = 'md', 
  animated = true, 
  showText = true,
  className = '',
  href
}: PhiLogoProps) {
  const sizes = {
    sm: { phi: 'text-2xl', text: 'text-lg', gap: 'gap-1' },
    md: { phi: 'text-4xl', text: 'text-2xl', gap: 'gap-2' },
    lg: { phi: 'text-5xl', text: 'text-3xl', gap: 'gap-3' },
    xl: { phi: 'text-7xl', text: 'text-5xl', gap: 'gap-4' },
  }

  const { phi, text, gap } = sizes[size]

  const content = (
    <>
      {animated ? (
        <motion.span 
          className={`${phi} font-serif text-phi-gold`}
          animate={{
            textShadow: [
              '0 0 8px rgba(242, 193, 102, 0.3)',
              '0 0 16px rgba(242, 193, 102, 0.5)',
              '0 0 8px rgba(242, 193, 102, 0.3)',
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {PHI}
        </motion.span>
      ) : (
        <span className={`${phi} font-serif text-phi-gold`}>
          {PHI}
        </span>
      )}
      {showText && (
        <span className={`${text} font-bold text-phi-dark`}>
          Phi
        </span>
      )}
    </>
  )

  const containerClass = `flex items-center ${gap} ${className}`

  if (href) {
    return (
      <Link href={href} className={containerClass}>
        {content}
      </Link>
    )
  }

  return (
    <div className={containerClass}>
      {content}
    </div>
  )
}
