/**
 * Lead Generator for Loan Consolidation
 * בונה ליד מלא ושולח לגדי (היועץ הפיננסי)
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { ConsolidationLeadData } from '@/types/loans';
import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors
function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-build');
}

/**
 * בניית נתוני ליד מלאים
 */
export async function buildLeadData(requestId: string): Promise<ConsolidationLeadData | null> {
  const supabase = createServiceClient();
  
  // שלוף את הבקשה
  const { data: request, error: requestError } = await supabase
    .from('loan_consolidation_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  
  if (requestError || !request) {
    console.error('Failed to fetch consolidation request:', requestError);
    return null;
  }
  
  // שלוף את המשתמש
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('name, full_name, email, phone, monthly_income')
    .eq('id', request.user_id)
    .single();
  
  if (userError || !user) {
    console.error('Failed to fetch user:', userError);
    return null;
  }
  
  // שלוף את ההלוואות
  const { data: loans, error: loansError } = await supabase
    .from('loans')
    .select('*')
    .in('id', request.loan_ids);
  
  if (loansError || !loans) {
    console.error('Failed to fetch loans:', loansError);
    return null;
  }
  
  // חשב φ Score
  const { data: phiScore } = await supabase
    .rpc('calculate_financial_health', { p_user_id: request.user_id });
  
  // חשב הוצאות חודשיות
  const { data: expenses } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', request.user_id)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .gte('tx_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  
  const monthlyExpenses = expenses?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  // בנה את הליד
  const leadData: ConsolidationLeadData = {
    user_id: request.user_id,
    user_name: user.name || user.full_name || 'לא צוין',
    user_email: user.email || '',
    user_phone: user.phone || '',
    
    request_id: request.id,
    loans_count: request.loans_count,
    total_monthly_payment: request.total_monthly_payment,
    total_balance: request.total_balance,
    
    loans: loans.map(loan => ({
      id: loan.id,
      creditor: loan.creditor || 'לא צוין',
      balance: loan.current_balance || 0,
      monthly_payment: loan.monthly_payment || 0,
      interest_rate: loan.interest_rate,
      remaining_months: loan.remaining_months,
    })),
    
    documents: request.loan_documents as any[] || [],
    
    monthly_income: user.monthly_income || 0,
    monthly_expenses: monthlyExpenses,
    phi_score: phiScore || 0,
    
    created_at: request.created_at,
  };
  
  return leadData;
}

/**
 * יצירת Email HTML לגדי
 */
function generateLeadEmail(lead: ConsolidationLeadData): string {
  const savingsPotential = lead.total_monthly_payment * 0.15; // הערכה של 15% חיסכון
  
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Heebo', Arial, sans-serif;
      background-color: #ECEFF4;
      padding: 20px;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #2E3440 0%, #4C566A 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .phi-symbol {
      font-family: Georgia, serif;
      font-size: 48px;
      color: #A96B48;
    }
    .section {
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 1px solid #D8DEE9;
    }
    .label {
      color: #4C566A;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .value {
      color: #2E3440;
      font-size: 18px;
      font-weight: 700;
    }
    .loan-card {
      background: #ECEFF4;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .highlight {
      background: #A96B48;
      color: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      font-size: 20px;
      font-weight: 700;
    }
    .documents {
      background: #8FBCBB;
      color: white;
      padding: 10px;
      border-radius: 6px;
    }
    .documents a {
      color: white;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="phi-symbol">φ</div>
      <h1>ליד חדש - איחוד הלוואות</h1>
      <p>מערכת Phi - The Golden Ratio of Your Money</p>
    </div>
    
    <div class="section">
      <h2>📋 פרטי לקוח</h2>
      <div class="label">שם:</div>
      <div class="value">${lead.user_name}</div>
      
      <div class="label" style="margin-top: 10px;">טלפון:</div>
      <div class="value">${lead.user_phone}</div>
      
      <div class="label" style="margin-top: 10px;">אימייל:</div>
      <div class="value">${lead.user_email || 'לא צוין'}</div>
    </div>
    
    <div class="section">
      <h2>💰 מצב פיננסי</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div class="label">הכנסה חודשית:</div>
          <div class="value">${lead.monthly_income.toLocaleString('he-IL')} ₪</div>
        </div>
        <div>
          <div class="label">הוצאות חודשיות:</div>
          <div class="value">${lead.monthly_expenses.toLocaleString('he-IL')} ₪</div>
        </div>
        <div>
          <div class="label">ציון φ:</div>
          <div class="value">${lead.phi_score}/100</div>
        </div>
        <div>
          <div class="label">נטו:</div>
          <div class="value">${(lead.monthly_income - lead.monthly_expenses).toLocaleString('he-IL')} ₪</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>🏦 הלוואות לאיחוד (${lead.loans_count})</h2>
      ${lead.loans.map((loan, idx) => `
        <div class="loan-card">
          <div style="font-weight: 700; margin-bottom: 10px;">הלוואה ${idx + 1}: ${loan.creditor}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <span style="color: #4C566A;">יתרה:</span>
              <strong>${loan.balance.toLocaleString('he-IL')} ₪</strong>
            </div>
            <div>
              <span style="color: #4C566A;">תשלום חודשי:</span>
              <strong>${loan.monthly_payment.toLocaleString('he-IL')} ₪</strong>
            </div>
            ${loan.interest_rate ? `
            <div>
              <span style="color: #4C566A;">ריבית:</span>
              <strong>${loan.interest_rate}%</strong>
            </div>
            ` : ''}
            ${loan.remaining_months ? `
            <div>
              <span style="color: #4C566A;">חודשים נותרים:</span>
              <strong>${loan.remaining_months}</strong>
            </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="highlight">
      סה״כ תשלום חודשי: ${lead.total_monthly_payment.toLocaleString('he-IL')} ₪<br>
      סה״כ יתרה: ${lead.total_balance.toLocaleString('he-IL')} ₪<br>
      <span style="font-size: 16px; opacity: 0.9;">חיסכון פוטנציאלי: ~${savingsPotential.toLocaleString('he-IL')} ₪/חודש</span>
    </div>
    
    <div class="section" style="margin-top: 25px;">
      <h2>📄 מסמכים (${lead.documents.length})</h2>
      <div class="documents">
        ${lead.documents.map((doc, idx) => `
          <div style="margin-bottom: 5px;">
            ${idx + 1}. <a href="${doc.url}" target="_blank">${doc.filename}</a>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #D8DEE9; border-radius: 8px;">
      <strong>🔗 לינק לבקשה במערכת:</strong><br>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/consolidation/${lead.request_id}" 
         style="color: #2E3440; font-size: 14px;">
        ${process.env.NEXT_PUBLIC_BASE_URL}/admin/consolidation/${lead.request_id}
      </a>
    </div>
    
    <div style="margin-top: 20px; text-align: center; color: #4C566A; font-size: 14px;">
      נוצר ב-${new Date(lead.created_at).toLocaleString('he-IL')}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * שליחת Email לגדי דרך Resend
 */
export async function sendLeadToAdvisor(requestId: string): Promise<boolean> {
  try {
    // בנה את הליד
    const leadData = await buildLeadData(requestId);
    
    if (!leadData) {
      console.error('Failed to build lead data');
      return false;
    }
    
    // צור Email HTML
    const emailHtml = generateLeadEmail(leadData);
    
    // שלח דרך Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: 'Phi System <phi@finhealer.com>',
      to: process.env.ADVISOR_EMAIL || 'gadi@finhealer.com',
      subject: `🎯 ליד חדש - איחוד ${leadData.loans_count} הלוואות - ${leadData.user_name}`,
      html: emailHtml,
      replyTo: leadData.user_email || undefined,
    });
    
    if (error) {
      console.error('Failed to send email:', error);
      return false;
    }
    
    console.log('Lead email sent successfully:', data);
    
    // עדכן סטטוס בקשה
    const supabase = createServiceClient();
    await supabase
      .from('loan_consolidation_requests')
      .update({
        status: 'sent_to_advisor',
        lead_sent_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    
    return true;
  } catch (error) {
    console.error('Error in sendLeadToAdvisor:', error);
    return false;
  }
}

/**
 * שמירת ליד ב-Admin Dashboard
 */
export async function saveLeadToAdmin(requestId: string): Promise<void> {
  // This is already handled by the loan_consolidation_requests table
  // Just log for analytics
  console.log(`Lead saved to admin dashboard: ${requestId}`);
}
