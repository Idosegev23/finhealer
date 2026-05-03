/**
 * NextStepCard — answers the single question "מה לעשות עכשיו?".
 *
 * The dashboard exposes ~20 features across the sidebar; new users
 * report it as overwhelming. This card sits at the top of the home
 * page and shows ONE contextual call-to-action based on the user's
 * current state, with optional sub-steps. As the user progresses
 * (phase advances, goals/budget land), the card updates automatically.
 *
 * Server component — receives the same data the dashboard already
 * fetched, no extra round-trips.
 */

import Link from 'next/link';
import {
  Upload,
  ListChecks,
  Target,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

interface NextStepCardProps {
  phase: string;
  hasTransactions: boolean;
  txCount: number;
  pendingTxCount: number;
  hasGoals: boolean;
  hasBudget: boolean;
  hasIncome: boolean;
  hasMissingDocs: boolean;
}

interface Step {
  icon: LucideIcon;
  badge: string; // e.g. "שלב 1"
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  // Optional secondary action (skip / postpone / WhatsApp)
  secondaryLabel?: string;
  secondaryHref?: string;
  // Visual emphasis
  tone: 'gold' | 'mint' | 'coral' | 'dark';
}

function decideStep(p: NextStepCardProps): Step {
  // 1) No transactions yet — must start with a bank statement.
  if (!p.hasTransactions || p.txCount < 5) {
    return {
      icon: Upload,
      badge: 'שלב 1 מ-5',
      title: 'מתחילים מדוח בנק',
      body: 'העלה דוח תנועות עדכני. בלי הוא אני בונה את כל השאר על ניחושים. דוח אחד = תמונה אמיתית.',
      ctaLabel: 'העלה דוח',
      ctaHref: '/dashboard/scan-center',
      secondaryLabel: 'דבר איתי בוואטסאפ',
      secondaryHref: '/dashboard/assistant',
      tone: 'gold',
    };
  }

  // 2) Lots of transactions but many still need confirmation.
  if (p.pendingTxCount >= 5) {
    return {
      icon: ListChecks,
      badge: 'שלב 2 מ-5',
      title: `${p.pendingTxCount} תנועות מחכות לאישור`,
      body: 'עברתי על הדוחות וסיווגתי. עכשיו תראה רגע — אם הקטגוריות נכונות, אישור אחד וזה.',
      ctaLabel: 'סווג עכשיו',
      ctaHref: '/dashboard/transactions',
      tone: 'coral',
    };
  }

  // 3) Has data but no income source — needs to confirm the income side.
  if (p.txCount >= 30 && !p.hasIncome) {
    return {
      icon: TrendingUp,
      badge: 'שלב 2 מ-5',
      title: 'מה ההכנסה החודשית שלך?',
      body: 'יש לי תמונה של ההוצאות, אבל בלי הכנסה אי אפשר לבנות תקציב. הוסף משכורת או הכנסה עצמאית.',
      ctaLabel: 'הוסף הכנסה',
      ctaHref: '/dashboard/income',
      tone: 'mint',
    };
  }

  // 4) Data + income but no goal yet.
  if (p.txCount >= 30 && p.hasIncome && !p.hasGoals) {
    return {
      icon: Target,
      badge: 'שלב 3 מ-5',
      title: 'הגדר יעד ראשון',
      body: 'בלי יעד, התקציב הוא רק מספרים. עם יעד הוא תוכנית. נופש, רכב, חיסכון לחירום — כל אחד עובד.',
      ctaLabel: 'הגדר יעד',
      ctaHref: '/dashboard/goals',
      tone: 'gold',
    };
  }

  // 5) Has goal but no active budget.
  if (p.hasGoals && !p.hasBudget) {
    return {
      icon: Wallet,
      badge: 'שלב 4 מ-5',
      title: 'בואו נבנה תקציב',
      body: 'עכשיו יש לי הכל — דוחות, הכנסה, יעד. אני יכול להציע לך חלוקה לפי הקטגוריות שלך. אתה תאשר.',
      ctaLabel: 'צור תקציב חכם',
      ctaHref: '/dashboard/budget',
      tone: 'mint',
    };
  }

  // 6) Everything is set up — monitoring mode.
  if (p.hasMissingDocs) {
    return {
      icon: Upload,
      badge: 'שלב 5 מ-5',
      title: 'יש מסמכים חסרים',
      body: 'בשביל תמונה מדויקת, יש כמה דוחות שעוד צריך. בעיקר אשראי וביטוחים.',
      ctaLabel: 'הצג רשימה',
      ctaHref: '/dashboard/missing-documents',
      tone: 'coral',
    };
  }

  return {
    icon: Sparkles,
    badge: 'שלב 5 מ-5',
    title: 'הכל מוגדר. בואו נבדוק את החודש',
    body: 'יש לך תקציב, יעדים, ודאטה. עכשיו אפשר לראות איך אתה עומד החודש מול התוכנית.',
    ctaLabel: 'פתח סקירה',
    ctaHref: '/dashboard/overview',
    tone: 'dark',
  };
}

const TONE_CLASSES: Record<Step['tone'], { bg: string; border: string; iconBg: string; iconText: string; ctaBg: string; ctaHover: string; badge: string }> = {
  gold: {
    bg: 'bg-amber-50',
    border: 'border-phi-gold/40',
    iconBg: 'bg-phi-gold/20',
    iconText: 'text-phi-gold',
    ctaBg: 'bg-phi-gold',
    ctaHover: 'hover:bg-phi-gold/90',
    badge: 'bg-phi-gold/20 text-phi-coral',
  },
  mint: {
    bg: 'bg-emerald-50',
    border: 'border-phi-mint/40',
    iconBg: 'bg-phi-mint/20',
    iconText: 'text-phi-mint',
    ctaBg: 'bg-phi-mint',
    ctaHover: 'hover:bg-phi-mint/90',
    badge: 'bg-phi-mint/20 text-phi-mint',
  },
  coral: {
    bg: 'bg-red-50',
    border: 'border-phi-coral/40',
    iconBg: 'bg-phi-coral/20',
    iconText: 'text-phi-coral',
    ctaBg: 'bg-phi-coral',
    ctaHover: 'hover:bg-phi-coral/90',
    badge: 'bg-phi-coral/20 text-phi-coral',
  },
  dark: {
    bg: 'bg-sky-50',
    border: 'border-phi-dark/30',
    iconBg: 'bg-phi-dark/15',
    iconText: 'text-phi-dark',
    ctaBg: 'bg-phi-dark',
    ctaHover: 'hover:bg-phi-slate',
    badge: 'bg-phi-dark/10 text-phi-dark',
  },
};

export function NextStepCard(props: NextStepCardProps) {
  const step = decideStep(props);
  const t = TONE_CLASSES[step.tone];
  const Icon = step.icon;

  return (
    <div
      data-tour="next-step"
      className={`rounded-2xl border-2 ${t.border} ${t.bg} p-5 md:p-6 shadow-sm`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${t.iconText}`} />
        </div>

        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${t.badge}`}>
            {step.badge}
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-1.5 leading-tight">
            {step.title}
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {step.body}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={step.ctaHref}
              className={`inline-flex items-center gap-2 ${t.ctaBg} ${t.ctaHover} text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition`}
            >
              {step.ctaLabel}
              <ArrowLeft className="w-4 h-4" />
            </Link>
            {step.secondaryLabel && step.secondaryHref && (
              <Link
                href={step.secondaryHref}
                className="text-sm text-phi-slate hover:text-phi-dark hover:underline"
              >
                {step.secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
