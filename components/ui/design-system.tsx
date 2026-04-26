/**
 * φ Design System — Unified Components
 *
 * Single source of truth for:
 * - Card (with variants)
 * - Button (with variants)
 * - EmptyState
 * - StatCard
 * - Badge
 * - SectionTitle
 * - ProgressBar
 *
 * All pages import from here. No more inline styling chaos.
 */

import React from 'react';
import { LucideIcon, Loader2, AlertCircle } from 'lucide-react';

// ============================================================================
// CARD — unified card component
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const CARD_PADDING = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', padding = 'md', hover = false }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${CARD_PADDING[padding]} ${hover ? 'transition-all hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// STAT CARD — for KPIs and metrics
// ============================================================================

/**
 * Semantic stat tones — single source of truth for KPI coloring.
 * `income` = positive money in (mint), `expense` = money out (coral),
 * `balance` = net position (gold or red depending on sign — caller decides),
 * `neutral` = informational stat (slate). Don't mix red/blue/yellow ad-hoc.
 */
export type StatTone = 'income' | 'expense' | 'balance' | 'pending' | 'neutral';

const STAT_TONE_STYLES: Record<StatTone, { iconBg: string; iconColor: string; valueColor: string }> = {
  income:  { iconBg: 'bg-emerald-50', iconColor: 'text-phi-mint', valueColor: 'text-phi-mint' },
  expense: { iconBg: 'bg-amber-50',   iconColor: 'text-phi-coral', valueColor: 'text-phi-coral' },
  balance: { iconBg: 'bg-sky-50',     iconColor: 'text-phi-dark',  valueColor: 'text-phi-dark' },
  pending: { iconBg: 'bg-amber-50',   iconColor: 'text-phi-gold',  valueColor: 'text-phi-gold' },
  neutral: { iconBg: 'bg-gray-50',    iconColor: 'text-phi-slate', valueColor: 'text-phi-dark' },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Preferred — semantic tone ties color to meaning. */
  tone?: StatTone;
  /** Legacy escape hatches — use only when tone doesn't fit. */
  iconColor?: string;
  iconBg?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, tone, iconColor, iconBg, trend, subtitle, className = '' }: StatCardProps) {
  // Resolve colors: tone wins, then explicit iconColor/iconBg, then neutral default.
  const toneStyles = tone ? STAT_TONE_STYLES[tone] : STAT_TONE_STYLES.neutral;
  const resolvedIconBg = iconBg || toneStyles.iconBg;
  const resolvedIconColor = iconColor || toneStyles.iconColor;
  const resolvedValueColor = trend === 'up'
    ? 'text-phi-mint'
    : trend === 'down'
    ? 'text-phi-coral'
    : tone
    ? toneStyles.valueColor
    : 'text-phi-dark';

  return (
    <Card className={className}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg ${resolvedIconBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${resolvedIconColor}`} />
          </div>
        )}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${resolvedValueColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </Card>
  );
}

// ============================================================================
// KPI GRID — consistent 2-up on mobile, 4-up on desktop
// ============================================================================

interface KpiGridProps {
  children: React.ReactNode;
  /** Number of columns on large screens. 2 | 3 | 4 (default 4) */
  cols?: 2 | 3 | 4;
  className?: string;
}

export function KpiGrid({ children, cols = 4, className = '' }: KpiGridProps) {
  const lgCols = cols === 2 ? 'lg:grid-cols-2' : cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${lgCols} gap-3 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// SECTION — labeled section block (replaces inline bg-white rounded-xl ...)
// ============================================================================

interface SectionProps {
  /** Optional title row */
  title?: React.ReactNode;
  titleIcon?: LucideIcon;
  titleIconColor?: string;
  /** Right-side action element (link, button) */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Card padding */
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Section({ title, titleIcon: Icon, titleIconColor = 'text-phi-gold', action, children, padding = 'md', className = '' }: SectionProps) {
  return (
    <Card padding={padding} className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              {Icon && <Icon className={`w-4 h-4 ${titleIconColor}`} />}
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

// ============================================================================
// INSIGHT BANNER — for tips, warnings, and contextual notes
// ============================================================================

interface InsightBannerProps {
  variant: 'info' | 'success' | 'warning' | 'danger';
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const INSIGHT_BANNER_STYLES: Record<InsightBannerProps['variant'], { bg: string; border: string; iconColor: string; titleColor: string }> = {
  info:    { bg: 'bg-sky-50',     border: 'border-sky-200',     iconColor: 'text-phi-dark',  titleColor: 'text-phi-dark' },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-phi-mint',  titleColor: 'text-phi-mint' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   iconColor: 'text-phi-gold',  titleColor: 'text-amber-900' },
  danger:  { bg: 'bg-red-50',     border: 'border-red-200',     iconColor: 'text-red-600',   titleColor: 'text-red-800' },
};

export function InsightBanner({ variant, icon: Icon, title, children, action, className = '' }: InsightBannerProps) {
  const s = INSIGHT_BANNER_STYLES[variant];
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.iconColor}`} />}
        <div className="flex-1 min-w-0">
          {title && <p className={`text-sm font-semibold mb-1 ${s.titleColor}`}>{title}</p>}
          <div className="text-sm text-gray-700">{children}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION TITLE — consistent heading for every section
// ============================================================================

interface SectionTitleProps {
  icon?: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionTitle({ icon: Icon, iconColor = 'text-phi-gold', children, action, className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        {children}
      </h3>
      {action}
    </div>
  );
}

// ============================================================================
// PAGE LOADER — single loading look across the app
// ============================================================================

interface PageLoaderProps {
  /** Optional Hebrew label shown beneath the spinner. */
  label?: string;
  /** When true, fills the whole viewport. Default false (inline). */
  fullscreen?: boolean;
}

export function PageLoader({ label, fullscreen = false }: PageLoaderProps) {
  const wrapper = fullscreen
    ? 'min-h-screen flex flex-col items-center justify-center bg-phi-bg'
    : 'flex flex-col items-center justify-center py-12';
  return (
    <div className={wrapper} role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 text-phi-gold animate-spin" />
      {label && <p className="text-sm text-gray-500 mt-3">{label}</p>}
      <span className="sr-only">{label || 'טוען...'}</span>
    </div>
  );
}

// ============================================================================
// ERROR BANNER — single error look across the app
// ============================================================================

interface ErrorBannerProps {
  /** What broke (in Hebrew, user-friendly). */
  message: string;
  /** Optional retry callback. */
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, className = '' }: ErrorBannerProps) {
  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 ${className}`}
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-red-700 hover:text-red-900 hover:underline mt-1"
          >
            נסה שוב
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE — unified for all pages
// ============================================================================

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <Card className={`text-center py-8 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      {description && <p className="text-xs text-gray-400 mb-3">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="inline-block text-xs font-medium text-phi-gold hover:underline">
            {action.label}
          </a>
        ) : (
          <button onClick={action.onClick} className="text-xs font-medium text-phi-gold hover:underline">
            {action.label}
          </button>
        )
      )}
    </Card>
  );
}

// ============================================================================
// PROGRESS BAR — budget/goals tracking
// ============================================================================

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({ value, max = 100, size = 'sm', className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-phi-gold' : 'bg-phi-mint';
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={`${height} bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className={`${height} rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ============================================================================
// BADGE — status indicators
// ============================================================================

interface BadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

const BADGE_STYLES = {
  success: 'bg-green-50 text-phi-mint border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-600 border-red-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_STYLES[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ============================================================================
// BUTTON — unified styles
// ============================================================================

interface PhiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
}

const BUTTON_VARIANTS = {
  primary: 'bg-phi-dark text-white hover:bg-phi-slate',
  secondary: 'bg-phi-gold text-phi-dark hover:bg-phi-gold/90',
  outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:bg-gray-50',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function PhiButton({ variant = 'primary', size = 'md', icon: Icon, children, className = '', ...props }: PhiButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

// ============================================================================
// PAGE HEADER — consistent page header
// ============================================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
      <div className="min-w-0">
        {/* Canonical h1 size for the entire app — text-2xl (24px). All page
            titles flow through here so headings stay coherent across the dashboard. */}
        <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ============================================================================
// PAGE WRAPPER — consistent page layout
// ============================================================================

interface PageWrapperProps {
  children: React.ReactNode;
  /** Inner content max-width. Use 'wide' for data-heavy tables. Default 'default' = max-w-5xl. */
  maxWidth?: 'default' | 'wide' | 'narrow';
  className?: string;
}

const MAX_WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
};

export function PageWrapper({ children, maxWidth = 'default', className = '' }: PageWrapperProps) {
  return (
    <div className={`min-h-screen bg-gray-50 p-4 md:p-6 ${className}`} dir="rtl">
      <div className={`${MAX_WIDTHS[maxWidth]} mx-auto space-y-5`}>
        {children}
      </div>
    </div>
  );
}
