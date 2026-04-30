'use client'

// ============================================================================
// φ Floating Help Button
// ----------------------------------------------------------------------------
// A small floating action button anchored to the bottom-right (LTR) /
// bottom-left (RTL = ours) of the screen. Re-launches the contextual tour
// for the current page. Hidden while a tour is active.
// ============================================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, X } from 'lucide-react'
import { useTour } from './TourProvider'
import { TourId } from './tours'

const PHI = 'ϕ'

export function TourHelpButton({
  tourId,
  label = 'איך זה עובד?',
}: {
  tourId: TourId
  label?: string
}) {
  const { start, resetSeen, isActive } = useTour()
  const [hovered, setHovered] = useState(false)

  if (isActive) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 print:hidden" dir="rtl">
      <motion.button
        onClick={() => {
          resetSeen(tourId)
          start(tourId, { force: true })
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.3 }}
        className="group relative flex items-center gap-2 rounded-full bg-phi-dark text-white shadow-lg shadow-phi-dark/30 hover:shadow-xl hover:shadow-phi-dark/40 transition-shadow ring-2 ring-phi-gold/40 hover:ring-phi-gold"
        aria-label={label}
      >
        <span className="flex items-center justify-center w-12 h-12">
          <HelpCircle className="w-5 h-5" />
        </span>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="overflow-hidden whitespace-nowrap pl-4 text-sm font-medium"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        <span
          aria-hidden
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-phi-gold flex items-center justify-center text-phi-dark text-[10px] font-serif shadow"
        >
          {PHI}
        </span>
      </motion.button>
    </div>
  )
}
