'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

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
    sm: { logo: 24, text: 'text-lg', gap: 'gap-1' },
    md: { logo: 40, text: 'text-2xl', gap: 'gap-2' },
    lg: { logo: 64, text: 'text-3xl', gap: 'gap-3' },
    xl: { logo: 96, text: 'text-5xl', gap: 'gap-4' },
  }

  const { logo, text, gap } = sizes[size]

  const LogoImage = animated ? motion.div : 'div'
  const Container = animated ? motion.div : 'div'

  const containerProps = animated ? {
    whileHover: { scale: 1.05 },
    transition: { type: "spring", stiffness: 400, damping: 10 }
  } : {}

  const logoProps = animated ? {
    animate: {
      filter: [
        'drop-shadow(0 0 8px rgba(242, 193, 102, 0.3))',
        'drop-shadow(0 0 16px rgba(242, 193, 102, 0.5))',
        'drop-shadow(0 0 8px rgba(242, 193, 102, 0.3))',
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
      <LogoImage 
        className="flex-shrink-0"
        {...logoProps}
      >
        <Image
          src="/logo.png"
          alt="Phi Logo"
          width={logo}
          height={logo}
          className="object-contain"
          priority
        />
      </LogoImage>
      {showText && (
        <span className={`${text} font-bold text-phi-dark font-inter`}>
          Phi
        </span>
      )}
    </Container>
  )
}

