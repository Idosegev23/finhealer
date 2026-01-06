'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

// ϕ = U+03D5 (mathematical phi)
const PHI = 'ϕ'

type Phase = 'start' | 'reflection' | 'waiting_for_document' | 'data_collection' | 
  'classification' | 'classification_income' | 'classification_expense' | 
  'behavior' | 'goals' | 'budget' | 'monitoring'

interface PhaseJourneyProps {
  currentPhase: string
  className?: string
}

const phases: { id: string; label: string; description: string }[] = [
  { id: 'data_collection', label: 'מסמכים', description: 'העלאת דוחות' },
  { id: 'classification', label: 'סיווג', description: 'סיווג תנועות' },
  { id: 'behavior', label: 'דפוסים', description: 'ניתוח התנהגות' },
  { id: 'goals', label: 'יעדים', description: 'הגדרת מטרות' },
  { id: 'budget', label: 'תקציב', description: 'בניית תקציב' },
  { id: 'monitoring', label: 'מעקב', description: 'ליווי שוטף' },
]

// Map all states to phase index
function getPhaseIndex(state: string): number {
  const stateMap: Record<string, number> = {
    'start': 0,
    'reflection': 0,
    'waiting_for_document': 0,
    'data_collection': 0,
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
      <h3 className="text-lg font-bold text-phi-dark mb-6 flex items-center gap-2">
        <span className="text-phi-gold font-serif">{PHI}</span>
        מסלול {PHI}
      </h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute right-[11px] top-0 bottom-0 w-0.5 bg-phi-frost" />

        {/* Phases */}
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isCompleted = index < currentIndex
            const isCurrent = index === currentIndex
            const isPending = index > currentIndex

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex items-center gap-4"
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
                <div className={`flex-1 ${isPending ? 'opacity-50' : ''}`}>
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
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

