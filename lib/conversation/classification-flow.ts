/**
 * 🔄 Classification Flow Manager
 * מנהל את תזרים הסיווג בצורה חכמה וסדרתית:
 * 1. מסווג רק תנועות מהמסמך הנוכחי
 * 2. מזהה מסמכים חסרים
 * 3. מבקש מסמכים חסרים לפי עדיפות
 * 4. עובר לשלב הבא רק אחרי שכל המסמכים הועלו
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';

/**
 * Check if there are any pending missing documents
 * @returns Array of missing documents sorted by priority (highest first)
 */
export async function getPendingMissingDocuments(userId: string) {
  const supabase = createServiceClient();
  
  const { data: missingDocs, error } = await supabase
    .from('missing_documents')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('priority', { ascending: false }) // Highest priority first
    .order('created_at', { ascending: true }); // Oldest first within same priority
  
  if (error) {
    console.error('❌ Error fetching missing documents:', error);
    return [];
  }
  
  return missingDocs || [];
}

/**
 * Request the next missing document from the user
 */
export async function requestNextMissingDocument(userId: string, phone: string) {
  const missingDocs = await getPendingMissingDocuments(userId);
  
  if (missingDocs.length === 0) {
    // אין מסמכים חסרים - עוברים לשלב הבא!
    return { hasMoreDocuments: false };
  }
  
  const nextDoc = missingDocs[0];
  const greenAPI = getGreenAPIClient();
  
  // בנה הודעה מותאמת לפי סוג המסמך
  let message = `📋 *מסמך חסר*\n\n`;
  
  switch (nextDoc.document_type) {
    case 'credit':
      message += `💳 *דוח פירוט אשראי*\n\n`;
      if (nextDoc.card_last_4) {
        message += `כרטיס: ****${nextDoc.card_last_4}\n`;
      }
      if (nextDoc.period_start && nextDoc.period_end) {
        const startDate = new Date(nextDoc.period_start);
        const endDate = new Date(nextDoc.period_end);
        const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        const month = hebrewMonths[endDate.getMonth()];
        const year = endDate.getFullYear();
        message += `תקופה: ${month} ${year}\n`;
      }
      if (nextDoc.expected_amount) {
        message += `סכום חיוב: ${Math.abs(nextDoc.expected_amount).toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי את דוח האשראי של התקופה הזאת כדי לראות לאן הכסף הלך.`;
      break;
      
    case 'payslip':
      message += `💼 *תלוש משכורת*\n\n`;
      if (nextDoc.period_start) {
        const date = new Date(nextDoc.period_start);
        const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        const month = hebrewMonths[date.getMonth()];
        const year = date.getFullYear();
        message += `חודש: ${month} ${year}\n`;
      }
      if (nextDoc.expected_amount) {
        message += `משכורת משוערת: ${nextDoc.expected_amount.toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי תלוש כדי לראות ניכויים, פנסיה וקה"ש.`;
      break;
      
    case 'mortgage':
      message += `🏠 *דוח משכנתא*\n\n`;
      if (nextDoc.expected_amount) {
        message += `תשלום חודשי: ${nextDoc.expected_amount.toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי דוח משכנתא עדכני לראות קרן/ריבית ויתרת חוב.`;
      break;
      
    case 'loan':
      message += `💰 *דוח הלוואה*\n\n`;
      if (nextDoc.expected_amount) {
        message += `תשלום חודשי: ${nextDoc.expected_amount.toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי דוח הלוואה לראות מצב החוב.`;
      break;
      
    case 'insurance':
      message += `🛡️ *פוליסת ביטוח*\n\n`;
      if (nextDoc.expected_amount) {
        message += `תשלום חודשי: ${nextDoc.expected_amount.toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי את הפוליסה לראות כיסויים ותנאים.`;
      break;
      
    case 'pension':
      message += `🏦 *דוח פנסיה*\n\n`;
      if (nextDoc.expected_amount) {
        message += `הפקדה חודשית: ${nextDoc.expected_amount.toLocaleString('he-IL')} ₪\n`;
      }
      message += `\n📄 שלח לי דוח פנסיה לראות יתרה ותשואה.`;
      break;
      
    default:
      message += nextDoc.description || 'מסמך נדרש';
      message += `\n\n📄 שלח לי את המסמך.`;
  }
  
  message += `\n\n🔢 נשארו ${missingDocs.length} מסמכים לעיבוד.`;
  
  // Update classification_context to wait for this document
  const supabase = createServiceClient();
  await supabase
    .from('users')
    .update({
      classification_context: {
        waitingForDocument: nextDoc.document_type,
        waitingForDocumentId: nextDoc.id,
        waitingForCard: nextDoc.card_last_4,
      },
      onboarding_state: 'waiting_for_document' // חוזרים לstate של המתנה למסמך
    })
    .eq('id', userId);
  
  await greenAPI.sendMessage({
    phoneNumber: phone,
    message,
  });
  
  return {
    hasMoreDocuments: true,
    nextDocument: nextDoc,
  };
}

/**
 * Get transactions that are ready for classification (not waiting for missing documents)
 * Returns only transactions from documents that are NOT in missing_documents (or marked as 'uploaded'/'skipped')
 */
export async function getClassifiableTransactions(
  userId: string,
  type: 'income' | 'expense'
) {
  const supabase = createServiceClient();
  
  // Get all pending transactions of the requested type
  const { data: allTransactions } = await supabase
    .from('transactions')
    .select('id, amount, vendor, tx_date, type, expense_category, description, document_id')
    .eq('user_id', userId)
    .in('status', ['pending', 'proposed'])
    .eq('type', type)
    .order('tx_date', { ascending: false });
  
  if (!allTransactions || allTransactions.length === 0) {
    console.log(`📊 getClassifiableTransactions(${type}): 0 pending/proposed transactions`);
    return [];
  }
  
  console.log(`📊 getClassifiableTransactions(${type}): Found ${allTransactions.length} pending/proposed transactions`);
  
  // Get missing credit card documents
  const { data: missingCreditDocs } = await supabase
    .from('missing_documents')
    .select('card_last_4, document_type')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('document_type', 'credit');
  
  const missingCards = new Set(missingCreditDocs?.map(d => d.card_last_4) || []);
  console.log(`📋 Missing credit cards: ${Array.from(missingCards).join(', ') || 'none'}`);
  
  // Filter out transactions that are credit card charges waiting for detail
  const classifiableTransactions = allTransactions.filter(tx => {
    // Check if this is a credit card charge (חיוב לכרטיס אשראי)
    // רק תנועות שבאמת הן חיוב כרטיס - לא כל דבר עם 4 ספרות!
    const vendor = (tx.vendor || '').toLowerCase();
    const description = (tx.description || '').toLowerCase();
    const category = (tx.expense_category || '').toLowerCase();
    
    // זיהוי חיוב אשראי לפי:
    // 1. קטגוריה מכילה "חיוב כרטיס" או "חיוב אשראי"
    // 2. Vendor מכיל "חיוב" + "ויזה/מסטרקארד/כאל/מקס"
    // 3. Description מכיל "חיוב לכרטיס"
    const isCreditCharge = 
      category.includes('חיוב כרטיס') ||
      category.includes('חיוב אשראי') ||
      (vendor.includes('חיוב') && (
        vendor.includes('ויזה') || 
        vendor.includes('ויזא') ||
        vendor.includes('visa') ||
        vendor.includes('mastercard') ||
        vendor.includes('מסטרקארד') ||
        vendor.includes('כאל') ||
        vendor.includes('מקס') ||
        vendor.includes('ישראכרט') ||
        vendor.includes('לאומי קארד')
      )) ||
      description.includes('חיוב לכרטיס');
    
    if (!isCreditCharge) {
      // Not a credit charge - can classify
      return true;
    }
    
    // זה חיוב אשראי - חלץ מספר כרטיס
    const text = `${vendor} ${description}`;
    const cardMatch = text.match(/\d{4}(?!\d)/); // 4 ספרות שלא ממשיכות
    const starMatch = text.match(/\*{4}(\d{4})/); // ****1234
    const cardLast4 = starMatch ? starMatch[1] : (cardMatch ? cardMatch[0] : null);
    
    // If we're missing detail for this card - skip it
    if (cardLast4 && missingCards.has(cardLast4)) {
      console.log(`⏭️ Skipping credit charge for card ${cardLast4} - waiting for detail`);
      return false;
    }
    
    // Otherwise can classify (אין missing_document לכרטיס הזה)
    return true;
  });
  
  console.log(`✅ After filtering: ${classifiableTransactions.length} classifiable ${type} transactions`);
  
  return classifiableTransactions;
}

/**
 * Mark a missing document as uploaded when we receive it
 */
export async function markDocumentAsUploaded(
  userId: string,
  documentType: string,
  cardLast4?: string | null,
  uploadedDocumentId?: string
) {
  const supabase = createServiceClient();
  
  // Build query
  let query = supabase
    .from('missing_documents')
    .update({
      status: 'uploaded',
      uploaded_at: new Date().toISOString(),
      uploaded_document_id: uploadedDocumentId || null,
    })
    .eq('user_id', userId)
    .eq('document_type', documentType)
    .eq('status', 'pending');
  
  // Add card filter if provided
  if (cardLast4) {
    query = query.eq('card_last_4', cardLast4);
  }
  
  const { error } = await query;
  
  if (error) {
    console.error('❌ Error marking document as uploaded:', error);
  } else {
    console.log(`✅ Marked ${documentType}${cardLast4 ? ` (card ${cardLast4})` : ''} as uploaded`);
  }
}

/**
 * Check if we should continue to next phase or request more documents
 * Called after finishing classification of current batch
 */
export async function checkAndRequestMissingDocuments(userId: string, phone: string): Promise<boolean> {
  const missingDocs = await getPendingMissingDocuments(userId);
  
  if (missingDocs.length === 0) {
    // No missing documents - can proceed to next phase!
    return false;
  }
  
  // Request next document
  await requestNextMissingDocument(userId, phone);
  return true; // Still have documents to request
}
