'use client'

import { motion } from 'framer-motion'

interface PhiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
  showText?: boolean
  className?: string
}

export default function PhiLogo({ 
  size = 'md', 
  animated = true, 
  showText = true,
  className = '' 
}: PhiLogoProps) {
  const sizes = {
    sm: { symbol: 'text-2xl', text: 'text-lg', gap: 'gap-1' },
    md: { symbol: 'text-4xl', text: 'text-2xl', gap: 'gap-2' },
    lg: { symbol: 'text-6xl', text: 'text-3xl', gap: 'gap-3' },
    xl: { symbol: 'text-8xl', text: 'text-5xl', gap: 'gap-4' },
  }

  const { symbol, text, gap } = sizes[size]

  const PhiSymbol = animated ? motion.span : 'span'
  const Container = animated ? motion.div : 'div'

  const containerProps = animated ? {
    whileHover: { scale: 1.05 },
    transition: { type: "spring", stiffness: 400, damping: 10 }
  } : {}

  const symbolProps = animated ? {
    animate: {
      textShadow: [
        '0 0 8px rgba(169, 107, 72, 0.3)',
        '0 0 16px rgba(169, 107, 72, 0.5)',
        '0 0 8px rgba(169, 107, 72, 0.3)',
      ]
    },
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  } : {}

  return (
    <Container 
      className={`flex items-center ${gap} ${className}`}
      {...containerProps}
    >
      <PhiSymbol 
        className={`${symbol} font-bold text-phi-gold`}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        {...symbolProps}
      >
        φ
      </PhiSymbol>
      {showText && (
        <span className={`${text} font-bold text-phi-dark font-inter`}>
          Phi
        </span>
      )}
    </Container>
  )
}

