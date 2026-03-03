/**
 * Loan Consolidation Handler
 * מטפל ביצירת בקשת איחוד, קבלת מסמכים ושליחת ליד לגדי
 *
 * הערה: זיהוי הלוואות מתבצע ב-phi-router.ts (detectLoansFromClassifiedTransactions)
 * אחרי שלב הגדרת מטרות - לא באמצע הסיווג.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { LoanDocument } from '@/types/loans';

/**
 * טיפול בתשובת המשתמש להצעת איחוד
 */
export async function handleConsolidationResponse(
  userId: string,
  phone: string,
  response: 'yes' | 'no'
): Promise<string> {
  const supabase = createServiceClient();

  if (response === 'no') {
    // נקה את ה-loanConsolidation מה-context (בלי לדרוס שאר ה-context)
    const { data: existingUser } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userId)
      .single();

    const existingContext = existingUser?.classification_context || {};
    const { loanConsolidation, ...restContext } = existingContext as any;

    await supabase
      .from('users')
      .update({
        classification_context: Object.keys(restContext).length > 0 ? restContext : null
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

  // נקה את ה-pending flag (מזג context קיים)
  const fullContext = user?.classification_context || {};
  await supabase
    .from('users')
    .update({
      classification_context: {
        ...fullContext,
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
  const supabase = createServiceClient();

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
    loan_id: '',
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
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('loan_consolidation_requests')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['pending_documents', 'documents_received', 'sent_to_advisor'])
    .single();

  return !!data;
}
