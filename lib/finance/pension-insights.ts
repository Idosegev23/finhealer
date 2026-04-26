/**
 * Pension Insights — surfaces issues / opportunities from a single plan.
 *
 * Pure rules, no AI. Cheap, deterministic, runs server-side. Each insight
 * has a severity ('critical' | 'warning' | 'info' | 'success') so the UI
 * can color them without parsing text.
 */

export interface PensionInsight {
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
}

export interface PensionPlan {
  fund_name: string;
  fund_type: string;
  provider: string;
  current_balance?: number | null;
  monthly_deposit?: number | null;
  management_fee_percentage?: number | null;
  deposit_fee_percentage?: number | null;
  annual_return?: number | null;
  active?: boolean | null;
  notes?: string | null;
}

// Industry rule-of-thumb thresholds for Israeli pension/study funds (2025).
const FEE_HIGH_BALANCE = 1.0;       // >1% from balance is on the high side
const FEE_VERY_HIGH_BALANCE = 1.3;  // >1.3% is excessive
const FEE_HIGH_DEPOSIT = 3.0;       // >3% from deposit is high
const FEE_VERY_HIGH_DEPOSIT = 5.0;
const RETURN_LOW = 3;               // <3% over 5y is underperforming
const RETURN_GOOD = 7;

export function analyzePensionPlan(plan: PensionPlan): PensionInsight[] {
  const insights: PensionInsight[] = [];

  const mgmtFromBalance = Number(plan.management_fee_percentage) || 0;
  const mgmtFromDeposit = Number(plan.deposit_fee_percentage) || 0;
  const annualReturn = Number(plan.annual_return) || 0;
  const balance = Number(plan.current_balance) || 0;

  // ── Management fees ──
  if (mgmtFromBalance >= FEE_VERY_HIGH_BALANCE) {
    const yearlyCost = Math.round(balance * mgmtFromBalance / 100);
    insights.push({
      severity: 'critical',
      title: `דמי ניהול גבוהים מאוד — ${mgmtFromBalance}% מהיתרה`,
      body: `על יתרה של ₪${balance.toLocaleString('he-IL')}, אתה משלם ₪${yearlyCost.toLocaleString('he-IL')} בשנה רק על דמי ניהול. הממוצע בשוק לקרנות פנסיה הוא 0.2%-0.5%. שווה לבדוק העברה.`,
    });
  } else if (mgmtFromBalance >= FEE_HIGH_BALANCE) {
    insights.push({
      severity: 'warning',
      title: `דמי ניהול מצבירה גבוהים — ${mgmtFromBalance}%`,
      body: `מעל הממוצע. בקרנות פנסיה חדשות אפשר להגיע ל-0.14%. כדאי להשוות.`,
    });
  } else if (mgmtFromBalance > 0 && mgmtFromBalance <= 0.3) {
    insights.push({
      severity: 'success',
      title: `דמי ניהול נמוכים — ${mgmtFromBalance}%`,
      body: `אחת הקרנות הזולות בשוק. שמור עליה.`,
    });
  }

  if (mgmtFromDeposit >= FEE_VERY_HIGH_DEPOSIT) {
    insights.push({
      severity: 'critical',
      title: `דמי ניהול מהפקדה — ${mgmtFromDeposit}%`,
      body: `כל הפקדה מקצצת ${mgmtFromDeposit}% לפני שהיא נכנסת לחיסכון. בקרנות פנסיה ברירת מחדל אפשר להגיע ל-1.4%-1.75%.`,
    });
  } else if (mgmtFromDeposit >= FEE_HIGH_DEPOSIT) {
    insights.push({
      severity: 'warning',
      title: `דמי ניהול מהפקדה — ${mgmtFromDeposit}%`,
      body: `מעל הסביר. בקרנות פנסיה חדשות מקבלים 1.4% או פחות.`,
    });
  }

  // ── Returns ──
  if (annualReturn !== 0) {
    if (annualReturn >= RETURN_GOOD) {
      insights.push({
        severity: 'success',
        title: `תשואה מצוינת — ${annualReturn}%`,
        body: `ביצועים טובים מהממוצע בשוק.`,
      });
    } else if (annualReturn < RETURN_LOW && annualReturn > 0) {
      insights.push({
        severity: 'warning',
        title: `תשואה נמוכה — ${annualReturn}%`,
        body: `מתחת לממוצע. בדוק האם המסלול תואם את גילך ופרופיל הסיכון.`,
      });
    } else if (annualReturn < 0) {
      insights.push({
        severity: 'warning',
        title: `תשואה שלילית — ${annualReturn}%`,
        body: `שנה אחת לא מעידה על מסלול. בדוק תשואות 5 שנים לפני קבלת החלטה.`,
      });
    }
  } else {
    insights.push({
      severity: 'info',
      title: `אין נתוני תשואה`,
      body: `הדוח לא כלל אחוזי תשואה לתוכנית הזו. אפשר לבדוק באתר החברה המנהלת.`,
    });
  }

  // ── Frozen plans / inactive ──
  if (plan.active === false) {
    insights.push({
      severity: 'info',
      title: `תוכנית לא פעילה / מוקפאת`,
      body: `אין הפקדות שוטפות. הכסף ממשיך לצבור תשואה אבל אין הפרשות חדשות. שווה לשקול ניוד או איחוד.`,
    });
  }

  // ── Small balance flag ──
  if (balance > 0 && balance < 5000) {
    insights.push({
      severity: 'info',
      title: `יתרה קטנה — שווה לאחד`,
      body: `יתרות קטנות מתחת ל-₪5,000 לא משתלמות לנהל בנפרד בגלל דמי ניהול קבועים. שקול לאחד עם תוכנית גדולה יותר.`,
    });
  }

  return insights;
}

// Aggregate insights across the whole portfolio
export function analyzePortfolio(plans: PensionPlan[]): PensionInsight[] {
  const insights: PensionInsight[] = [];

  if (!plans.length) return insights;

  const totalBalance = plans.reduce((s, p) => s + (Number(p.current_balance) || 0), 0);
  const activeCount = plans.filter((p) => p.active !== false).length;
  const frozenCount = plans.length - activeCount;

  // Multiple frozen plans at the same provider → consolidation opp
  const frozenByProvider = new Map<string, number>();
  plans.filter((p) => p.active === false).forEach((p) => {
    frozenByProvider.set(p.provider, (frozenByProvider.get(p.provider) || 0) + 1);
  });
  for (const [provider, count] of Array.from(frozenByProvider.entries())) {
    if (count >= 2) {
      insights.push({
        severity: 'info',
        title: `${count} תוכניות מוקפאות אצל ${provider}`,
        body: `שווה לאחד אותן לתוכנית אחת — תחסוך בדמי ניהול קבועים ויהיה לך פחות לעקוב אחרי.`,
      });
    }
  }

  if (frozenCount >= 3) {
    insights.push({
      severity: 'warning',
      title: `${frozenCount} תוכניות מוקפאות בתיק`,
      body: `יש לך הרבה תוכניות לא פעילות. כדאי לבחון איחוד — תקבל דמי ניהול טובים יותר ותוכל לעקוב יותר בקלות.`,
    });
  }

  // Average fee weighted by balance
  let weightedFeeNum = 0;
  let weightedFeeDen = 0;
  plans.forEach((p) => {
    const b = Number(p.current_balance) || 0;
    const f = Number(p.management_fee_percentage) || 0;
    if (b > 0 && f > 0) {
      weightedFeeNum += b * f;
      weightedFeeDen += b;
    }
  });
  const avgFee = weightedFeeDen > 0 ? weightedFeeNum / weightedFeeDen : 0;
  if (avgFee >= 1.2) {
    const yearlyCost = Math.round(totalBalance * avgFee / 100);
    insights.push({
      severity: 'critical',
      title: `ממוצע דמי ניהול בתיק — ${avgFee.toFixed(2)}%`,
      body: `על תיק של ₪${totalBalance.toLocaleString('he-IL')}, סך דמי הניהול השנתי הוא כ-₪${yearlyCost.toLocaleString('he-IL')}. אופטימיזציה תחסוך אלפי שקלים בשנה.`,
    });
  }

  return insights;
}
