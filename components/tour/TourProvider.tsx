'use client'

// ============================================================================
// φ Guided Tour — Provider + Popover engine
// ----------------------------------------------------------------------------
// Lightweight tour system. No 3rd-party deps beyond framer-motion (already in
// the project). Renders a spotlight overlay + a positioned popover next to the
// `[data-tour="..."]` element. Persists "seen" state in localStorage so we
// auto-launch a tour at most once per user, and offer "don't show again".
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, HelpCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { TOURS, TourId, TourStep, tourSeenKey } from './tours'

type TourState = {
  activeTour: TourId | null
  stepIndex: number
}

type TourContextValue = {
  start: (tourId: TourId, opts?: { force?: boolean }) => void
  stop: () => void
  next: () => void
  prev: () => void
  isActive: boolean
  hasSeen: (tourId: TourId) => boolean
  resetSeen: (tourId: TourId) => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}

const PHI = 'ϕ'

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TourState>({ activeTour: null, stepIndex: 0 })
  const [mounted, setMounted] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMounted(true), [])

  // -- public API ------------------------------------------------------------
  const hasSeen = useCallback((tourId: TourId) => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(tourSeenKey(tourId)) === '1'
  }, [])

  const start = useCallback(
    (tourId: TourId, opts?: { force?: boolean }) => {
      if (!opts?.force && hasSeen(tourId)) return
      setState({ activeTour: tourId, stepIndex: 0 })
    },
    [hasSeen],
  )

  const stop = useCallback(() => {
    if (state.activeTour) {
      try {
        window.localStorage.setItem(tourSeenKey(state.activeTour), '1')
      } catch {
        /* ignore quota errors */
      }
    }
    setState({ activeTour: null, stepIndex: 0 })
  }, [state.activeTour])

  const resetSeen = useCallback((tourId: TourId) => {
    try {
      window.localStorage.removeItem(tourSeenKey(tourId))
    } catch {
      /* ignore */
    }
  }, [])

  const totalSteps = state.activeTour ? TOURS[state.activeTour].steps.length : 0

  const next = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTour) return prev
      const total = TOURS[prev.activeTour].steps.length
      if (prev.stepIndex >= total - 1) {
        try {
          window.localStorage.setItem(tourSeenKey(prev.activeTour), '1')
        } catch {
          /* ignore */
        }
        return { activeTour: null, stepIndex: 0 }
      }
      return { activeTour: prev.activeTour, stepIndex: prev.stepIndex + 1 }
    })
  }, [])

  const prev = useCallback(() => {
    setState((p) => ({ ...p, stepIndex: Math.max(0, p.stepIndex - 1) }))
  }, [])

  // -- target element tracking ----------------------------------------------
  const currentStep = useMemo(() => {
    if (!state.activeTour) return null
    const tour = TOURS[state.activeTour]
    return tour.steps[state.stepIndex] ?? null
  }, [state])

  useEffect(() => {
    if (!currentStep || !currentStep.selector) {
      setTargetRect(null)
      return
    }
    const update = () => {
      const el = document.querySelector(currentStep.selector!) as HTMLElement | null
      if (!el) {
        setTargetRect(null)
        return
      }
      // Scroll target into view first (centered)
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      // Re-measure after a short delay so the smooth scroll settles
      window.setTimeout(() => {
        if (el && document.body.contains(el)) {
          setTargetRect(el.getBoundingClientRect())
        }
      }, 350)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [currentStep])

  // -- keyboard nav ----------------------------------------------------------
  useEffect(() => {
    if (!state.activeTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
      // RTL: ArrowRight = previous, ArrowLeft = next
      if (e.key === 'ArrowLeft') next()
      if (e.key === 'ArrowRight') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.activeTour, next, prev, stop])

  const value = useMemo<TourContextValue>(
    () => ({
      start,
      stop,
      next,
      prev,
      isActive: !!state.activeTour,
      hasSeen,
      resetSeen,
    }),
    [start, stop, next, prev, state.activeTour, hasSeen, resetSeen],
  )

  // -- render ----------------------------------------------------------------
  const overlay =
    mounted && state.activeTour && currentStep
      ? createPortal(
          <AnimatePresence>
            <TourOverlay
              key={`${state.activeTour}-${state.stepIndex}`}
              step={currentStep}
              stepIndex={state.stepIndex}
              total={totalSteps}
              targetRect={targetRect}
              onNext={next}
              onPrev={prev}
              onClose={stop}
              popoverRef={popoverRef}
            />
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <TourContext.Provider value={value}>
      {children}
      {overlay}
    </TourContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Overlay — spotlight + popover
// -----------------------------------------------------------------------------
function TourOverlay({
  step,
  stepIndex,
  total,
  targetRect,
  onNext,
  onPrev,
  onClose,
  popoverRef,
}: {
  step: TourStep
  stepIndex: number
  total: number
  targetRect: DOMRect | null
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  popoverRef: React.RefObject<HTMLDivElement>
}) {
  const isCenter = step.placement === 'center' || !step.selector || !targetRect
  const popoverPos = computePopoverPosition(targetRect, step.placement, isCenter)
  const isLast = stepIndex === total - 1

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phi-tour-title"
    >
      {/* Backdrop with cut-out spotlight */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
      >
        <Spotlight rect={isCenter ? null : targetRect} />
      </motion.div>

      {/* Popover */}
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={popoverPos}
        className="absolute pointer-events-auto w-[min(92vw,360px)] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 bg-gradient-to-l from-phi-dark to-[#0a5876] text-white">
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl text-phi-gold leading-none">{PHI}</span>
            <span className="text-xs font-medium tracking-wide opacity-90">
              שלב {stepIndex + 1} מתוך {total}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור סיור"
            className="p-1 rounded-md hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <h3 id="phi-tour-title" className="text-lg font-bold text-phi-dark mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-phi-slate leading-relaxed">{step.body}</p>
          {step.tip && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-phi-gold/10 px-3 py-2">
              <Sparkles className="w-4 h-4 text-phi-gold flex-shrink-0 mt-0.5" />
              <p className="text-xs text-phi-dark leading-relaxed">{step.tip}</p>
            </div>
          )}
          {step.cta && (
            <Link
              href={step.cta.href}
              onClick={onClose}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-phi-dark hover:text-phi-coral transition"
            >
              {step.cta.label}
              <ChevronLeft className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Progress + nav */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-1.5 mb-3">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i === stepIndex
                    ? 'bg-phi-gold'
                    : i < stepIndex
                    ? 'bg-phi-mint'
                    : 'bg-phi-frost'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onClose}
              className="text-xs text-phi-slate hover:text-phi-dark transition px-2 py-1"
            >
              דלג ואל תציג שוב
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={onPrev}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-phi-dark border border-phi-frost rounded-lg hover:bg-phi-bg transition"
                >
                  <ChevronRight className="w-4 h-4" />
                  הקודם
                </button>
              )}
              <button
                onClick={onNext}
                className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-phi-dark rounded-lg hover:bg-[#053448] transition"
              >
                {isLast ? 'סיום' : 'הבא'}
                {!isLast && <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Spotlight — SVG mask cuts a hole around the target rect
// -----------------------------------------------------------------------------
function Spotlight({ rect }: { rect: DOMRect | null }) {
  // Full backdrop when there's no target (centered intro/outro steps)
  if (!rect) {
    return <div className="absolute inset-0 bg-phi-dark/60 backdrop-blur-[2px]" />
  }
  const padding = 10
  const x = Math.max(0, rect.left - padding)
  const y = Math.max(0, rect.top - padding)
  const w = rect.width + padding * 2
  const h = rect.height + padding * 2
  return (
    <svg className="absolute inset-0 w-full h-full">
      <defs>
        <mask id="phi-tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={14}
            ry={14}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(7, 66, 89, 0.58)"
        mask="url(#phi-tour-mask)"
      />
      {/* Soft glow ring around the target */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={14}
        ry={14}
        fill="none"
        stroke="rgba(242, 193, 102, 0.9)"
        strokeWidth={2}
      />
    </svg>
  )
}

// -----------------------------------------------------------------------------
// Position math
// -----------------------------------------------------------------------------
function computePopoverPosition(
  rect: DOMRect | null,
  placement: TourStep['placement'],
  forceCenter: boolean,
): React.CSSProperties {
  const POPOVER_W = 360
  const POPOVER_H_EST = 220
  const GAP = 14

  if (forceCenter || !rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  // Try preferred placement; fall back to whatever side has room.
  const space = {
    top: rect.top,
    bottom: vh - rect.bottom,
    left: rect.left,
    right: vw - rect.right,
  }
  const order: Array<NonNullable<typeof placement>> =
    placement && placement !== 'center'
      ? [placement, 'bottom', 'top', 'right', 'left']
      : ['bottom', 'top', 'right', 'left']
  const chosen = order.find((p) => {
    if (p === 'top') return space.top > POPOVER_H_EST + GAP
    if (p === 'bottom') return space.bottom > POPOVER_H_EST + GAP
    if (p === 'left') return space.left > POPOVER_W + GAP
    if (p === 'right') return space.right > POPOVER_W + GAP
    return false
  }) || 'bottom'

  let top = 0
  let left = 0
  if (chosen === 'top') {
    top = rect.top - POPOVER_H_EST - GAP
    left = rect.left + rect.width / 2 - POPOVER_W / 2
  } else if (chosen === 'bottom') {
    top = rect.bottom + GAP
    left = rect.left + rect.width / 2 - POPOVER_W / 2
  } else if (chosen === 'left') {
    top = rect.top + rect.height / 2 - POPOVER_H_EST / 2
    left = rect.left - POPOVER_W - GAP
  } else if (chosen === 'right') {
    top = rect.top + rect.height / 2 - POPOVER_H_EST / 2
    left = rect.right + GAP
  }
  // Clamp to viewport
  top = Math.max(12, Math.min(top, vh - POPOVER_H_EST - 12))
  left = Math.max(12, Math.min(left, vw - POPOVER_W - 12))
  return { top, left }
}

// -----------------------------------------------------------------------------
// TourLauncher — small "Help" button to re-open the tour
// -----------------------------------------------------------------------------
export function TourLauncher({
  tourId,
  label = 'סיור מודרך',
  className = '',
}: {
  tourId: TourId
  label?: string
  className?: string
}) {
  const { start, resetSeen } = useTour()
  return (
    <button
      onClick={() => {
        resetSeen(tourId)
        start(tourId, { force: true })
      }}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-phi-dark hover:text-phi-coral transition ${className}`}
    >
      <HelpCircle className="w-4 h-4" />
      {label}
    </button>
  )
}

// -----------------------------------------------------------------------------
// AutoStartTour — drop into a page to auto-launch a tour on first visit
// -----------------------------------------------------------------------------
export function AutoStartTour({ tourId, delay = 500 }: { tourId: TourId; delay?: number }) {
  const { start } = useTour()
  useEffect(() => {
    const t = window.setTimeout(() => start(tourId), delay)
    return () => window.clearTimeout(t)
  }, [tourId, delay, start])
  return null
}
