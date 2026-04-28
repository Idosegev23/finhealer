'use client';

/**
 * Standalone explainer that appears at the top of /dashboard/budget
 * when there's no active budget yet. Walks the user through what a Phi
 * budget is, what data it uses, and the two creation paths. Replaces
 * the mid-built feel where buttons appeared without context.
 */

import { Sparkles, ListPlus, Loader2, FileText, Target, Wallet, TrendingDown, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card as DSCard } from '@/components/ui/design-system';
import Link from 'next/link';

interface BudgetExplainerProps {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthsAnalyzed: number;
  transactionsCount: number;
  goalsCount: number;
  hasMissingCritical: boolean;
  onCreateSmart: () => void;
  onCreateManual: () => void;
  creating: boolean;
}

const formatILS = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;

export function BudgetExplainer({
  monthlyIncome,
  monthlyExpenses,
  monthsAnalyzed,
  transactionsCount,
  goalsCount,
  hasMissingCritical,
  onCreateSmart,
  onCreateManual,
  creating,
}: BudgetExplainerProps) {
  const available = Math.max(0, monthlyIncome - monthlyExpenses);
  const canCreateSmart = monthsAnalyzed >= 1 && transactionsCount >= 30 && monthlyIncome > 0 && !hasMissingCritical;
  const savingsRate = monthlyIncome > 0 ? Math.round((available / monthlyIncome) * 100) : 0;

  return (
    <DSCard padding="lg" className="mb-6 border-2 border-phi-gold/40 bg-gradient-to-br from-amber-50/40 via-white to-sky-50/30">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-12 h-12 rounded-lg bg-phi-gold/15 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-serif text-phi-gold">φ</span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">בואו נבנה לך תקציב</h2>
          <p className="text-sm text-phi-slate mt-1">
            התקציב הוא תוכנית פעולה — כמה מותר להוציא בכל קטגוריה כדי שתעמוד ביעדים שלך.
            Phi בונה אותו אוטומטית מהדאטה שלך, או מאפשר לך לבנות ידנית.
          </p>
        </div>
      </div>

      {/* Money flow snapshot — what we know about you */}
      {(monthlyIncome > 0 || monthlyExpenses > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5">
          <h3 className="text-xs font-semibold text-phi-slate mb-3 uppercase tracking-wider">
            המצב שלך כרגע (ממוצע {monthsAnalyzed > 0 ? `${monthsAnalyzed} ${monthsAnalyzed === 1 ? 'חודש' : 'חודשים'}` : 'לא ידוע'})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border-r-2 border-emerald-300 pr-3">
              <div className="flex items-center gap-1 text-xs text-phi-mint mb-0.5">
                <Wallet className="w-3 h-3" />
                הכנסות
              </div>
              <div className="text-lg font-bold text-phi-mint tabular-nums">
                {formatILS(monthlyIncome)}
              </div>
            </div>
            <div className="border-r-2 border-red-300 pr-3">
              <div className="flex items-center gap-1 text-xs text-phi-coral mb-0.5">
                <TrendingDown className="w-3 h-3" />
                הוצאות
              </div>
              <div className="text-lg font-bold text-phi-coral tabular-nums">
                {formatILS(monthlyExpenses)}
              </div>
            </div>
            <div className="border-r-2 border-amber-300 pr-3">
              <div className="flex items-center gap-1 text-xs text-phi-gold mb-0.5">
                <Target className="w-3 h-3" />
                יעדים פעילים
              </div>
              <div className="text-lg font-bold text-phi-gold tabular-nums">
                {goalsCount}
              </div>
            </div>
            <div className="border-r-2 border-sky-300 pr-3">
              <div className="flex items-center gap-1 text-xs text-phi-dark mb-0.5">
                <Sparkles className="w-3 h-3" />
                זמין
              </div>
              <div className="text-lg font-bold text-phi-dark tabular-nums">
                {formatILS(available)}
                <span className="text-xs text-phi-slate font-normal mr-1">
                  ({savingsRate}%)
                </span>
              </div>
            </div>
          </div>
          {available <= 0 && monthlyIncome > 0 && (
            <p className="text-xs text-phi-coral mt-3 flex items-center gap-1">
              ⚠ ההוצאות שלך עוברות את ההכנסות. תקציב יעזור לזהות איפה לחתוך.
            </p>
          )}
        </div>
      )}

      {/* The 4 steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        {[
          {
            n: 1,
            icon: FileText,
            title: 'נתונים',
            body: 'דוחות בנק/אשראי, הכנסות, הוצאות קבועות',
            done: transactionsCount >= 30,
          },
          {
            n: 2,
            icon: Target,
            title: 'יעדים',
            body: 'מה אתה רוצה לחסוך/להשיג ובאיזה זמן',
            done: goalsCount > 0,
          },
          {
            n: 3,
            icon: Zap,
            title: 'יצירה',
            body: 'Phi מציע חלוקה. אתה מאשר או עורך.',
            done: false,
          },
          {
            n: 4,
            icon: TrendingDown,
            title: 'מעקב',
            body: 'בכל הוצאה רואים אם בתחום או חורג.',
            done: false,
          },
        ].map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.n}
              className={`rounded-lg p-3 border ${
                step.done
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.done ? 'bg-phi-mint text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step.done ? '✓' : step.n}
                </div>
                <Icon className={`w-3.5 h-3.5 ${step.done ? 'text-phi-mint' : 'text-phi-slate'}`} />
                <span className="text-xs font-semibold text-gray-900">{step.title}</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{step.body}</p>
            </div>
          );
        })}
      </div>

      {/* CTA buttons + explanations */}
      <div className="space-y-3">
        {/* Smart */}
        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-phi-gold">
          <div className="w-10 h-10 rounded-lg bg-phi-gold/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-phi-gold" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 mb-1">תקציב חכם — מומלץ</div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              Phi מנתח את ההוצאות שלך ומציע סכום לכל קטגוריה. מבוסס על הממוצע החודשי שלך עד היום
              ומותאם להכנסה וליעדים שלך.
            </p>
            {!canCreateSmart && (
              <p className="text-[11px] text-phi-coral mb-2">
                {hasMissingCritical
                  ? 'יש למלא נתונים חסרים קריטיים למעלה לפני שאוכל לבנות תקציב חכם.'
                  : transactionsCount < 30
                    ? `דרושות לפחות 30 תנועות. כרגע יש ${transactionsCount}. העלה עוד דוחות בנק.`
                    : 'אין נתוני הכנסה. הוסף משכורת/הכנסה עצמאית.'}
              </p>
            )}
            <Button
              onClick={onCreateSmart}
              disabled={creating || !canCreateSmart}
              className="bg-phi-gold hover:bg-phi-gold/90 text-white"
            >
              {creating
                ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> יוצר…</>
                : <><Sparkles className="w-4 h-4 ml-2" /> צור תקציב חכם</>}
            </Button>
          </div>
        </div>

        {/* Manual */}
        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <ListPlus className="w-5 h-5 text-phi-slate" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 mb-1">תקציב ידני</div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              קבע בעצמך את הסכום לכל קטגוריה. שימושי כשאתה יודע בדיוק מה אתה רוצה ולא צריך הצעה.
            </p>
            <Button
              onClick={onCreateManual}
              variant="outline"
              className="border-gray-300 text-gray-700"
            >
              <ListPlus className="w-4 h-4 ml-2" />
              צור תקציב ידני
            </Button>
          </div>
        </div>
      </div>

      {/* Footer hint to data sources */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-phi-slate">
        <span>חסרים נתונים? התחל מהמקורות:</span>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/scan-center" className="text-phi-dark hover:underline flex items-center gap-1">
            העלה דוחות <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/dashboard/income" className="text-phi-dark hover:underline flex items-center gap-1">
            הוסף הכנסה <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/dashboard/goals" className="text-phi-dark hover:underline flex items-center gap-1">
            הגדר יעדים <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </DSCard>
  );
}
