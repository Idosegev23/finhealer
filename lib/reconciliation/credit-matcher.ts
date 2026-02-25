/**
 * Credit Card Reconciliation Matcher
 * 
 * מתאים בין תנועות סיכום של כרטיסי אשראי בדוח בנק 
 * לבין הפירוט המלא מדוח האשראי, ומוחק את הכפילויות.
 * 
 * לוגיקה:
 * 1. כשמעבדים דוח אשראי - מחפשים תנועת summary תואמת בבנק
 * 2. התאמה לפי: סכום (±2%) ותאריך (±7 ימים)
 * 3. מוחקים את תנועת הסיכום ומקשרים את הפירוט למסמך הבנק
 */

/**
 * התאמה בין תנועות סיכום בבנק לפירוט באשראי
 */
export async function matchCreditTransactions(
  supabase: any,
  userId: string,
  documentId: string,
  documentType: string
) {
  // אם זה דוח אשראי שזה עתה עובד
  if (documentType.includes('credit')) {
    console.log('🔗 Starting credit card reconciliation...');
    await matchAndDeleteSummaries(supabase, userId, documentId);
  }
}

/**
 * מחפש ומוחק תנועות סיכום שמתאימות לפירוט האשראי
 */
async function matchAndDeleteSummaries(
  supabase: any, 
  userId: string, 
  creditDocId: string
) {
  try {
    // 1. קבל את המסמך של דוח האשראי
    const { data: creditDoc, error: docError } = await supabase
      .from('uploaded_statements')
      .select('extracted_data')
      .eq('id', creditDocId)
      .single();
    
    if (docError || !creditDoc) {
      console.error('Error fetching credit document:', docError);
      return;
    }
    
    // 2. חלץ billing_info מהמסמך
    const billingInfo = creditDoc.extracted_data?.billing_info;
    
    if (!billingInfo || !billingInfo.next_billing_date || !billingInfo.next_billing_amount) {
      console.log('⚠️  No billing_info found in credit document - cannot match');
      return;
    }
    
    console.log(`💳 Billing info:`, billingInfo);
    const { next_billing_date, next_billing_amount, card_last_digits } = billingInfo;
    
    // המר תאריך מ-DD/MM/YYYY ל-YYYY-MM-DD
    const dateParts = next_billing_date.split('/');
    const billingDateISO = dateParts.length === 3 
      ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
      : null;
    
    if (!billingDateISO) {
      console.error('⚠️  Invalid billing date format:', next_billing_date);
      return;
    }
    
    console.log(`🔍 Looking for bank charge: Date=${billingDateISO}, Amount~${next_billing_amount} ₪, Card=${card_last_digits}`);
    
    // 3. חפש חיוב בדוח בנק שתואם
    // טווח: ±2% מהסכום, ±1 יום מתאריך החיוב
    const tolerance = next_billing_amount * 0.02; // 2%
    const minAmount = next_billing_amount - tolerance;
    const maxAmount = next_billing_amount + tolerance;
    
    // טווח תאריכים: ±1 יום (לפעמים יש הבדל קטן)
    const billingDate = new Date(billingDateISO);
    const minDate = new Date(billingDate);
    minDate.setDate(minDate.getDate() - 1);
    const maxDate = new Date(billingDate);
    maxDate.setDate(maxDate.getDate() + 1);
    
    console.log(`🔍 Searching: ${minAmount.toFixed(2)}-${maxAmount.toFixed(2)} ₪, ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    
    // חפש חיובי כרטיס אשראי בטווח הזה
    const { data: potentialMatches, error: searchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('amount', minAmount)
      .lte('amount', maxAmount)
      .gte('tx_date', minDate.toISOString().split('T')[0])
      .lte('tx_date', maxDate.toISOString().split('T')[0]);
    
    if (searchError) {
      console.error('Error searching for matches:', searchError);
      return;
    }
    
    if (!potentialMatches || potentialMatches.length === 0) {
      console.log('⚠️  No matching charge found in bank statement - might be uploaded later');
      return;
    }
    
    console.log(`✅ Found ${potentialMatches.length} potential match(es)`);
    
    // 4. סנן רק חיובי כרטיס אשראי שמכילים את המספר הנכון
    const creditCardMatches = potentialMatches.filter((tx: any) => {
      const isCardCharge = (
        tx.vendor?.includes('ויזא') || 
        tx.vendor?.includes('ויזה') || 
        tx.vendor?.includes('כרטיס') ||
        tx.vendor?.toLowerCase().includes('visa') ||
        tx.category === 'כרטיס אשראי'
      );
      
      // אם יש מספר כרטיס - ודא שתואם
      if (card_last_digits && tx.vendor) {
        return isCardCharge && tx.vendor.includes(card_last_digits);
      }
      
      return isCardCharge;
    });
    
    if (creditCardMatches.length === 0) {
      console.log('⚠️  Found transactions in range but none are credit card charges');
      return;
    }
    
    console.log(`💳 Found ${creditCardMatches.length} credit card charge(s) matching criteria`);
    
    // 5. בחר את ההתאמה הכי טובה (לפי הפרש סכום)
    let bestMatch = creditCardMatches[0];
    let bestDiff = Math.abs(parseFloat(bestMatch.amount) - next_billing_amount);
    
    for (const match of creditCardMatches) {
      const diff = Math.abs(parseFloat(match.amount) - next_billing_amount);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = match;
      }
    }
    
    console.log(`🎯 Best match: ${bestMatch.vendor} - ${bestMatch.amount} ₪ (diff: ${bestDiff.toFixed(2)} ₪)`);
    
    // 6. סמן את החיוב כ-summary וקשר את הפירוט
    const { error: updateSummaryError } = await supabase
      .from('transactions')
      .update({ is_summary: true })
      .eq('id', bestMatch.id);
    
    if (updateSummaryError) {
      console.error('Error marking as summary:', updateSummaryError);
      return;
    }
    
    // 7. מחק את תנועת הסיכום
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', bestMatch.id);
    
    if (deleteError) {
      console.error('Error deleting summary:', deleteError);
      return;
    }
    
    console.log(`🗑️  Deleted summary transaction: ${bestMatch.id}`);
    
    // 8. קבל את התנועות מדוח האשראי וקשר אותן למסמך הבנק
    const { data: creditTransactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('document_id', creditDocId);
    
    if (creditTransactions && creditTransactions.length > 0) {
      const { error: linkError } = await supabase
        .from('transactions')
        .update({
          linked_document_id: bestMatch.document_id,
          reconciliation_status: 'matched'
        })
        .eq('document_id', creditDocId);
      
      if (linkError) {
        console.error('Error linking credit transactions:', linkError);
      } else {
        console.log(`✅ Reconciliation complete! Deleted summary, linked ${creditTransactions.length} detail transactions`);
      }
    }
    
  } catch (error) {
    console.error('Error in matchAndDeleteSummaries:', error);
    // Don't throw - this is optional reconciliation
  }
}

