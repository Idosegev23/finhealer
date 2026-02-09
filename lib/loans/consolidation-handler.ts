/**
 * Loan Consolidation Handler
 * מטפל בזיהוי הלוואות, יצירת בקשת איחוד, קבלת מסמכים ושליחת ליד לגדי
 */

import { createClientServerClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/greenapi/client';
import type { ConsolidationRequest, LoanDocument } from '@/types/loans';

interface DetectedLoan {
  id: string;
  creditor: string;
  balance: number;
  monthly_payment: number;
  interest_rate: number | null;
}

/**
 * זיהוי הלוואות במסמך שזה עתה עובד
 * מופעל אחרי document processing
 */
export async function detectLoansAndAsk(
  userId: string,
  phone: string,
  documentId: string
): Promise<void> {
  const supabase = await createClientServerClient();
  
  // שלוף את ההלוואות שזוהו במסמך
  const { data: loans, error } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)
    .eq('detected_from_document_id', documentId)
    .eq('status', 'active');
  
  if (error || !loans || loans.length === 0) {
    return; // אין הלוואות, המשך רגיל
  }
  
  // בדוק אם יש כבר בקשת איחוד פעילה
  const { data: existingRequest } = await supabase
    .from('loan_consolidation_requests')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['pending_documents', 'documents_received', 'sent_to_advisor'])
    .single();
  
  if (existingRequest) {
    return; // כבר יש בקשה פעילה
  }
  
  // חשב סך הכל
  const totalBalance = loans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
  const totalMonthly = loans.reduce((sum, loan) => sum + (loan.monthly_payment || 0), 0);
  
  // עדכן classification_context
  await supabase
    .from('users')
    .update({
      classification_context: {
        loanConsolidation: {
          pending: true,
          loans: loans.map(l => l.id),
          count: loans.length,
          total_balance: totalBalance,
          total_monthly: totalMonthly,
        }
      }
    })
    .eq('id', userId);
  
  // שלח הודעה למשתמש
  const message = buildConsolidationOfferMessage(loans.length, totalMonthly, totalBalance);
  await sendWhatsAppMessage(phone, message);
}

/**
 * בניית הודעת הצעה לאיחוד
 */
function buildConsolidationOfferMessage(count: number, monthly: number, balance: number): string {
  if (count === 1) {
    return `💳 שמתי לב שיש לך הלוואה עם תשלום חודשי של ${monthly.toLocaleString('he-IL')} ₪.

💰 רוצה שגדי, היועץ הפיננסי שלנו, יבדוק אם יש אפשרות לריבית טובה יותר?

הוא יכול לחסוך לך כסף! 💸

רק תשלח/י לי את פרטי ההלוואה (דוח/הסכם) ואני אעביר לו.

מעוניין/ת? (כן/לא)`;
  }
  
  return `💳 שמתי לב שיש לך ${count} הלוואות עם תשלום חודשי כולל של ${monthly.toLocaleString('he-IL')} ₪!

💡 *איחוד הלוואות יכול לחסוך לך כסף* - הפחתת ריבית וניהול קל יותר.

גדי, היועץ הפיננסי שלנו, יכול לבדוק את האפשרויות שלך בחינם! 🎯

רק תשלח/י לי את פרטי ההלוואות (דוחות/הסכמים) ואני אעביר לו.

מעוניין/ת? (כן/לא)`;
}

/**
 * טיפול בתשובת המשתמש
 */
export async function handleConsolidationResponse(
  userId: string,
  phone: string,
  response: 'yes' | 'no'
): Promise<string> {
  const supabase = await createClientServerClient();
  
  if (response === 'no') {
    // נקה את ה-context
    await supabase
      .from('users')
      .update({
        classification_context: {
          loanConsolidation: null
        }
      })
      .eq('id', userId);
    
    return '👍 בסדר גמור! אם תרצה/י בעתיד, תמיד אפשר לשאול אותי.\n\nבינתיים, אני ממשיך לעקוב אחרי התקציב שלך 📊';
  }
  
  // המשתמש אמר כן - צור בקשה
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();
  
  const context = user?.classification_context?.loanConsolidation;
  
  if (!context) {
    return '❌ משהו השתבש, נסה/י שוב מאוחר יותר.';
  }
  
  // צור בקשת איחוד
  const { data: request, error } = await supabase
    .from('loan_consolidation_requests')
    .insert({
      user_id: userId,
      loan_ids: context.loans,
      loans_count: context.count,
      total_monthly_payment: context.total_monthly,
      total_balance: context.total_balance,
      documents_needed: context.count,
      status: 'pending_documents',
    })
    .select()
    .single();
  
  if (error || !request) {
    console.error('Failed to create consolidation request:', error);
    return '❌ משהו השתבש, נסה/י שוב מאוחר יותר.';
  }
  
  // נקה את ה-pending flag
  await supabase
    .from('users')
    .update({
      classification_context: {
        loanConsolidation: {
          ...context,
          pending: false,
          request_id: request.id,
        }
      }
    })
    .eq('id', userId);
  
  return requestLoanDocuments(context.count);
}

/**
 * בקשת מסמכי הלוואות
 */
function requestLoanDocuments(count: number): string {
  return `מעולה! 🎉

כדי שגדי יוכל לבדוק, אני צריך את מסמכי ההלוואות (${count} מסמכים):
📄 דוחות/הסכמי הלוואה

אפשר לשלוח PDF, תמונה או קובץ Excel.

פשוט שלח/י לי את המסמכים אחד אחרי השני 📤`;
}

/**
 * קבלת מסמך הלוואה
 */
export async function receiveLoanDocument(
  userId: string,
  phone: string,
  fileUrl: string,
  fileName: string
): Promise<string> {
  const supabase = await createClientServerClient();
  
  // מצא את הבקשה הפעילה
  const { data: request, error } = await supabase
    .from('loan_consolidation_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending_documents')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !request) {
    return '❌ לא מצאתי בקשת איחוד פעילה.';
  }
  
  // הוסף מסמך
  const documents = (request.loan_documents as LoanDocument[]) || [];
  documents.push({
    filename: fileName,
    url: fileUrl,
    loan_id: '', // יעודכן מאוחר יותר אם צריך
    uploaded_at: new Date().toISOString(),
  });
  
  const documentsReceived = documents.length;
  const newStatus = documentsReceived >= request.documents_needed 
    ? 'documents_received' 
    : 'pending_documents';
  
  // עדכן בקשה
  await supabase
    .from('loan_consolidation_requests')
    .update({
      loan_documents: documents,
      documents_received: documentsReceived,
      status: newStatus,
    })
    .eq('id', request.id);
  
  // הודעה למשתמש
  if (newStatus === 'documents_received') {
    return `✅ קיבלתי את כל ${documentsReceived} המסמכים!

אני מעביר עכשיו את הבקשה לגדי 📨

הוא יבדוק את האפשרויות ויחזור אליך בהקדם (בדרך כלל תוך 24-48 שעות).

בינתיים, אני ממשיך לעקוב אחרי התקציב שלך 💪`;
  }
  
  return `✅ קיבלתי מסמך ${documentsReceived}/${request.documents_needed}!

עוד ${request.documents_needed - documentsReceived} מסמכים ואני מעביר לגדי 📄`;
}

/**
 * בדיקה אם יש בקשת איחוד פעילה
 */
export async function checkActiveConsolidationRequest(userId: string): Promise<boolean> {
  const supabase = await createClientServerClient();
  
  const { data } = await supabase
    .from('loan_consolidation_requests')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['pending_documents', 'documents_received', 'sent_to_advisor'])
    .single();
  
  return !!data;
}
