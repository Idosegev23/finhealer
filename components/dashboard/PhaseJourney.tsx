'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, ChevronLeft } from 'lucide-react'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

interface PhaseJourneyProps {
  currentPhase: string
  className?: string
}

// Each phase points to the page where the user actually does the work for
// it. Clicking a step jumps there — even pending phases are reachable so
// users can preview / start early when they want, instead of being locked
// out until thresholds are met.
const phases: { id: string; label: string; description: string; href: string }[] = [
  { id: 'data_collection', label: 'מסמכים',  description: 'העלאת דוחות',     href: '/dashboard/scan-center' },
  { id: 'classification',  label: 'סיווג',    description: 'סיווג תנועות',    href: '/dashboard/transactions' },
  { id: 'behavior',        label: 'דפוסים',   description: 'ניתוח התנהגות',   href: '/dashboard/overview' },
  { id: 'goals',           label: 'יעדים',    description: 'הגדרת מטרות',     href: '/dashboard/goals' },
  { id: 'budget',          label: 'תקציב',    description: 'בניית תקציב',     href: '/dashboard/budget' },
  { id: 'monitoring',      label: 'מעקב',     description: 'ליווי שוטף',       href: '/dashboard/overview' },
]

function getPhaseIndex(state: string): number {
  const stateMap: Record<string, number> = {
    'start': 0,
    'waiting_for_document': 0,
    'data_collection': 0,
    'reflection': 0, // legacy
    'classification': 1,
    'classification_income': 1,
    'classification_expense': 1,
    'behavior': 2,
    'goals': 3,
    'budget': 4,
    'monitoring': 5,
  }
  return stateMap[state] ?? 0
}

export function PhaseJourney({ currentPhase, className = '' }: PhaseJourneyProps) {
  const currentIndex = getPhaseIndex(currentPhase)

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-phi-frost ${className}`}>
      <h3 className="text-lg font-bold text-phi-dark mb-1 flex items-center gap-2">
        <span className="text-phi-gold font-serif">{PHI}</span>
        מסלול {PHI}
      </h3>
      <p className="text-xs text-phi-slate mb-5">לחץ על שלב כדי לקפוץ ישירות</p>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute right-[11px] top-0 bottom-0 w-0.5 bg-phi-frost" />

        {/* Phases */}
        <div className="space-y-2">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex
            const isCurrent = index === currentIndex
            const isPending = index > currentIndex

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={phase.href}
                  className={`group relative flex items-center gap-4 py-2 px-2 -mr-2 rounded-lg transition-colors hover:bg-phi-frost/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-phi-gold ${
                    isCurrent ? 'bg-amber-50/60' : ''
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {/* Status icon */}
                  <div className="relative z-10">
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-phi-mint flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 rounded-full bg-phi-gold flex items-center justify-center animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-phi-frost bg-white flex items-center justify-center">
                        <Circle className="w-3 h-3 text-phi-frost" />
                      </div>
                    )}
                  </div>

                  {/* Phase info */}
                  <div className={`flex-1 ${isPending ? 'opacity-60 group-hover:opacity-100' : ''}`}>
                    <p className={`font-medium text-sm ${
                      isCurrent ? 'text-phi-gold' :
                      isCompleted ? 'text-phi-dark' : 'text-phi-slate'
                    }`}>
                      {phase.label}
                      {isCurrent && (
                        <span className="text-xs text-phi-gold mr-2">← אתה פה</span>
                      )}
                    </p>
                    <p className="text-xs text-phi-slate">{phase.description}</p>
                  </div>

                  <ChevronLeft className="w-4 h-4 text-phi-slate/50 group-hover:text-phi-dark transition-colors" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

