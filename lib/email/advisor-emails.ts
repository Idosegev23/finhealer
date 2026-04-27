/**
 * Advisor email templates — user-initiated "send my details for consultation"
 * flows for loans/mortgage and pension portfolios. Mirrors the visual style
 * of lib/loans/lead-generator.ts so all advisor inboxes get a consistent
 * Phi-branded layout.
 */

import { Resend } from 'resend';

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-build');
}

function isResendConfigured() {
  const key = process.env.RESEND_API_KEY;
  return !!key && key !== 'dummy-key-for-build' && !key.startsWith('your-');
}

const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL || 'advisor@finhealer.com';
const FROM_ADDRESS = 'Phi System <phi@finhealer.com>';

// ─── Shared shell ──────────────────────────────────────────────────────────
const baseStyles = `
<style>
  body { font-family: 'Heebo', Arial, sans-serif; background:#ECEFF4; padding:20px; margin:0; }
  .container { max-width:720px; margin:0 auto; background:white; border-radius:12px; padding:30px; box-shadow:0 4px 6px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg,#074259 0%,#4C566A 100%); color:white; padding:24px; border-radius:8px; margin-bottom:24px; }
  .phi-symbol { font-family:Georgia,serif; font-size:42px; color:#F2C166; line-height:1; }
  .header h1 { margin:8px 0 4px; font-size:22px; }
  .header p { margin:0; opacity:0.85; font-size:14px; }
  .section { margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid #E5E9F0; }
  .section:last-child { border-bottom:none; }
  .section h2 { color:#074259; font-size:16px; margin:0 0 12px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .label { color:#4C566A; font-size:12px; font-weight:600; margin-bottom:2px; }
  .value { color:#074259; font-size:16px; font-weight:700; }
  .item-card { background:#F4F6FA; padding:14px; border-radius:8px; margin-bottom:10px; }
  .item-card .title { font-weight:700; color:#074259; margin-bottom:8px; }
  .highlight { background:#F2C166; color:#074259; padding:14px; border-radius:8px; text-align:center; font-weight:700; }
  .insight { padding:10px 14px; border-radius:8px; margin-bottom:8px; font-size:14px; }
  .insight.critical { background:#FEE2E2; color:#7F1D1D; border-right:3px solid #DC2626; }
  .insight.warning { background:#FEF3C7; color:#78350F; border-right:3px solid #D97706; }
  .insight.info { background:#DBEAFE; color:#1E3A8A; border-right:3px solid #2563EB; }
  .footer { margin-top:24px; padding-top:16px; border-top:1px solid #E5E9F0; color:#4C566A; font-size:12px; text-align:center; }
</style>
`;

interface UserLite {
  name: string;
  email: string;
  phone: string;
}

const formatILS = (n: number) =>
  `₪${Math.round(n).toLocaleString('he-IL')}`;

const userBlock = (user: UserLite) => `
  <div class="section">
    <h2>פרטי לקוח</h2>
    <div class="row">
      <div>
        <div class="label">שם</div>
        <div class="value">${user.name || 'לא צוין'}</div>
      </div>
      <div>
        <div class="label">טלפון</div>
        <div class="value">${user.phone || 'לא צוין'}</div>
      </div>
      <div>
        <div class="label">אימייל</div>
        <div class="value">${user.email || 'לא צוין'}</div>
      </div>
      <div>
        <div class="label">תאריך הפנייה</div>
        <div class="value">${new Date().toLocaleDateString('he-IL')}</div>
      </div>
    </div>
  </div>
`;

// ─── Loans ─────────────────────────────────────────────────────────────────
export interface LoanRow {
  lender_name: string;
  loan_type: string;
  loan_number: string | null;
  current_balance: number;
  original_amount: number | null;
  monthly_payment: number;
  interest_rate: number | null;
  remaining_payments: number | null;
  notes: string | null;
}

const LOAN_TYPE_LABEL: Record<string, string> = {
  mortgage: 'משכנתא',
  personal: 'הלוואה אישית',
  car: 'הלוואת רכב',
  student: 'הלוואת סטודנטים',
  credit: 'אשראי',
  business: 'הלוואה עסקית',
  other: 'אחר',
};

function renderLoansEmail(user: UserLite, loans: LoanRow[]): string {
  const totalBalance = loans.reduce((s, l) => s + (l.current_balance || 0), 0);
  const totalMonthly = loans.reduce((s, l) => s + (l.monthly_payment || 0), 0);
  const ratesWithBalance = loans.filter((l) => l.interest_rate && l.current_balance);
  const weightedRate = ratesWithBalance.length
    ? ratesWithBalance.reduce((s, l) => s + (l.interest_rate || 0) * l.current_balance, 0) /
      ratesWithBalance.reduce((s, l) => s + l.current_balance, 0)
    : 0;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8">${baseStyles}</head>
<body>
  <div class="container">
    <div class="header">
      <div class="phi-symbol">ϕ</div>
      <h1>בקשת ייעוץ — סקירת הלוואות</h1>
      <p>הלקוח ביקש לקבל ייעוץ על תיק ההלוואות שלו</p>
    </div>

    ${userBlock(user)}

    <div class="section">
      <h2>סיכום תיק (${loans.length} הלוואות)</h2>
      <div class="row">
        <div>
          <div class="label">יתרה כוללת</div>
          <div class="value">${formatILS(totalBalance)}</div>
        </div>
        <div>
          <div class="label">תשלום חודשי כולל</div>
          <div class="value">${formatILS(totalMonthly)}</div>
        </div>
        ${weightedRate > 0 ? `
        <div>
          <div class="label">ריבית ממוצעת משוקללת</div>
          <div class="value">${weightedRate.toFixed(2)}%</div>
        </div>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>פירוט הלוואות</h2>
      ${loans.map((l, i) => `
        <div class="item-card">
          <div class="title">${i + 1}. ${l.lender_name} — ${LOAN_TYPE_LABEL[l.loan_type] || l.loan_type}</div>
          <div class="row">
            ${l.loan_number ? `<div><div class="label">מס' הלוואה</div><div class="value" style="font-size:13px;">${l.loan_number}</div></div>` : ''}
            <div><div class="label">יתרה נוכחית</div><div class="value">${formatILS(l.current_balance)}</div></div>
            <div><div class="label">תשלום חודשי</div><div class="value">${formatILS(l.monthly_payment)}</div></div>
            ${l.interest_rate ? `<div><div class="label">ריבית</div><div class="value">${l.interest_rate}%</div></div>` : ''}
            ${l.remaining_payments ? `<div><div class="label">תשלומים נותרים</div><div class="value">${l.remaining_payments}</div></div>` : ''}
          </div>
          ${l.notes ? `<div style="margin-top:8px; color:#4C566A; font-size:13px;">${l.notes}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="footer">
      נשלח ממערכת Phi · להשיב ישירות ללקוח השב על אימייל זה
    </div>
  </div>
</body></html>`;
}

export async function sendLoansLeadEmail(user: UserLite, loans: LoanRow[]) {
  if (loans.length === 0) {
    return { sent: false, reason: 'no_loans' as const };
  }
  if (!isResendConfigured()) {
    return { sent: false, reason: 'not_configured' as const };
  }
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADVISOR_EMAIL,
    replyTo: user.email || undefined,
    subject: `בקשת ייעוץ הלוואות — ${user.name || 'לקוח'} (${loans.length} הלוואות)`,
    html: renderLoansEmail(user, loans),
  });
  if (error) {
    console.error('Resend send error (loans):', error);
    return { sent: false, reason: 'send_failed' as const, error };
  }
  return { sent: true as const };
}

// ─── Pensions ──────────────────────────────────────────────────────────────
export interface PensionRow {
  fund_name: string;
  fund_type: string;
  provider: string;
  current_balance: number | null;
  monthly_deposit: number | null;
  management_fee_percentage: number | null;
  deposit_fee_percentage: number | null;
  annual_return: number | null;
  active: boolean | null;
}

export interface InsightRow {
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
}

const FUND_TYPE_LABEL: Record<string, string> = {
  pension_fund: 'קרן פנסיה',
  provident_fund: 'קופת גמל',
  advanced_study_fund: 'קרן השתלמות',
  managers_insurance: 'ביטוח מנהלים',
  investment_provident: 'קופת גמל להשקעה',
};

function renderPensionsEmail(user: UserLite, plans: PensionRow[], insights: InsightRow[]): string {
  const totalBalance = plans.reduce((s, p) => s + (Number(p.current_balance) || 0), 0);
  const totalMonthlyDeposit = plans.reduce((s, p) => s + (Number(p.monthly_deposit) || 0), 0);
  const flagged = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8">${baseStyles}</head>
<body>
  <div class="container">
    <div class="header">
      <div class="phi-symbol">ϕ</div>
      <h1>בקשת ייעוץ — תיק חיסכון פנסיוני</h1>
      <p>הלקוח זיהה במערכת בעיות אפשריות בתיק וביקש ייעוץ</p>
    </div>

    ${userBlock(user)}

    <div class="section">
      <h2>סיכום תיק (${plans.length} תוכניות)</h2>
      <div class="row">
        <div>
          <div class="label">יתרה צבורה כוללת</div>
          <div class="value">${formatILS(totalBalance)}</div>
        </div>
        <div>
          <div class="label">הפקדה חודשית כוללת</div>
          <div class="value">${formatILS(totalMonthlyDeposit)}</div>
        </div>
      </div>
    </div>

    ${flagged.length > 0 ? `
    <div class="section">
      <h2>נושאים שדורשים תשומת לב (${flagged.length})</h2>
      ${flagged.map((ins) => `
        <div class="insight ${ins.severity}">
          <strong>${ins.title}</strong><br>
          <span style="opacity:0.85;">${ins.body}</span>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="section">
      <h2>פירוט תוכניות</h2>
      ${plans.map((p, i) => `
        <div class="item-card">
          <div class="title">${i + 1}. ${p.fund_name} — ${FUND_TYPE_LABEL[p.fund_type] || p.fund_type}</div>
          <div class="row">
            <div><div class="label">חברה מנהלת</div><div class="value" style="font-size:14px;">${p.provider}</div></div>
            <div><div class="label">יתרה</div><div class="value">${formatILS(Number(p.current_balance) || 0)}</div></div>
            <div><div class="label">הפקדה חודשית</div><div class="value">${formatILS(Number(p.monthly_deposit) || 0)}</div></div>
            ${p.management_fee_percentage != null ? `<div><div class="label">דמי ניהול מצבירה</div><div class="value">${Number(p.management_fee_percentage).toFixed(2)}%</div></div>` : ''}
            ${p.deposit_fee_percentage != null ? `<div><div class="label">דמי ניהול מהפקדה</div><div class="value">${Number(p.deposit_fee_percentage).toFixed(2)}%</div></div>` : ''}
            ${p.annual_return != null ? `<div><div class="label">תשואה שנתית</div><div class="value">${Number(p.annual_return).toFixed(2)}%</div></div>` : ''}
          </div>
          ${p.active === false ? `<div style="margin-top:8px; color:#7F1D1D; font-size:13px;">⚠ תוכנית מוקפאת / לא פעילה</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="footer">
      נשלח ממערכת Phi · להשיב ישירות ללקוח השב על אימייל זה
    </div>
  </div>
</body></html>`;
}

export async function sendPensionsLeadEmail(
  user: UserLite,
  plans: PensionRow[],
  insights: InsightRow[],
) {
  if (plans.length === 0) {
    return { sent: false, reason: 'no_plans' as const };
  }
  if (!isResendConfigured()) {
    return { sent: false, reason: 'not_configured' as const };
  }
  const resend = getResendClient();
  const flaggedCount = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning').length;
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADVISOR_EMAIL,
    replyTo: user.email || undefined,
    subject: `בקשת ייעוץ פנסיוני — ${user.name || 'לקוח'} (${flaggedCount} סימני אזהרה)`,
    html: renderPensionsEmail(user, plans, insights),
  });
  if (error) {
    console.error('Resend send error (pensions):', error);
    return { sent: false, reason: 'send_failed' as const, error };
  }
  return { sent: true as const };
}
