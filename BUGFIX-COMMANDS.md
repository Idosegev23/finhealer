# φ FinHealer — פקודות תיקון באגים

## חשוב! קרא את SYSTEM-FLOW-v3.1.md לפני שמתחיל

כל התיקונים מתבססים על v3.1. 8 בעיות שנמצאו ב-code review.

---

## באג 1 (קריטי): reconciliation.ts — is_summary filter שבור

```
קרא את lib/classification/reconciliation.ts

הבעיה: שורה 42 — `eq('is_summary', false)` מסנן החוצה תנועות שכבר סומנו כ-summary.
אבל אנחנו מחפשים חיובי אשראי כוללים שעוד לא סומנו — הם צריכים להיות null או false.

בנוסף: ה-matching (שורות 83-88) בודק רק סכום כולל של כל התנועות באותו חודש מול חיוב אשראי.
אבל אם יש 2 כרטיסי אשראי באותו חודש, הסכום הכולל לא יתאים לאף אחד מהם.

תקן:

1. שורה 42: החלף `eq('is_summary', false)` ב-`or('is_summary.is.null,is_summary.eq.false')`
   — ככה גם null וגם false יתפסו.

2. הוסף matching לפי card_last4:
   - חלץ 4 ספרות אחרונות מ-vendor או original_description של חיוב הבנק
   - חפש תנועות אשראי שה-document שלהן קשור לאותו כרטיס
   - אם אין 4 ספרות → fallback ל-matching לפי סכום בלבד (כמו עכשיו)

3. שנה את ה-matching logic:
   - במקום להשוות סכום כל התנועות באותו חודש לחיוב,
     קבץ קודם לפי document_id (כל דוח אשראי = קבוצה נפרדת)
   - לכל קבוצה → חשב סכום → השווה לחיובי האשראי
   - התאמה = סכום ±1₪ + אותו חודש
```

---

## באג 2 (קריטי): smart-classification.ts — sendListMessage לא קיים

```
קרא את lib/greenapi/client.ts

הבעיה: smart-classification.ts קורא ל-greenAPI.sendListMessage() (שורות 297, 358)
אבל ה-GreenAPI client לא מכיל את ה-method הזה — יש רק sendMessage ו-sendInteractiveButtons.

תקן:

הוסף ל-GreenAPIClient ב-lib/greenapi/client.ts method חדש:

async sendListMessage({ phoneNumber, message, buttonText, title, footer, sections }: {
  phoneNumber: string;
  message: string;
  buttonText: string;
  title?: string;
  footer?: string;
  sections: Array<{
    title: string;
    rows: Array<{
      rowId: string;
      title: string;
      description?: string;
    }>;
  }>;
}) {
  const url = `${this.baseUrl}/sendListMessage/${this.token}`;
  const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

  const payload: any = {
    chatId: `${normalizedPhone}@c.us`,
    message,
    buttonText,
    sections,
  };
  if (title) payload.title = title;
  if (footer) payload.footer = footer;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.error) {
      // Fallback to regular message if list not supported
      return this.sendMessage({ phoneNumber, message });
    }
    return data;
  } catch (err) {
    // Fallback
    return this.sendMessage({ phoneNumber, message });
  }
}

בדוק גם ב-GreenAPI documentation את ה-endpoint הנכון ל-list messages — אולי הוא sendList במקום sendListMessage.
```

---

## באג 3 (קריטי): learning-engine.ts — dual storage

```
קרא את lib/classification/learning-engine.ts

הבעיה: יש שתי מערכות מקבילות:
- user_patterns (הישנה) — שורות 207-238, נכתב ב-learnFromConfirmation
- user_category_rules (החדשה) — שורות 710-742, נכתב ב-learnFromBatchClassification

ai-classifier.ts קורא מ-user_category_rules (שורה 206)
אבל autoClassifyTransactions הישן קורא מ-user_patterns (שורה 331)

אם משתמש מסווג דרך flow חדש → נשמר ב-user_category_rules
אם הוא חוזר ל-flow הישן (fallback) → לא רואה את מה שלמד

תקן:

ב-learnFromBatchClassification (שורות 692-742), הוסף כתיבה גם ל-user_patterns:

אחרי ה-upsert ל-user_category_rules, הוסף:
  // Sync to user_patterns for backward compatibility
  const normalizedVendor = normalizeVendorName(c.vendor);
  await supabase
    .from('user_patterns')
    .upsert({
      user_id: userId,
      pattern_type: 'vendor_category',
      pattern_key: normalizedVendor,
      pattern_value: {
        category_name: c.category_name,
      },
      confidence_score: confidence,
      learned_from_count: 1,
      auto_apply: confidence >= AUTO_CLASSIFY_THRESHOLD,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id,pattern_type,pattern_key' })
    .select();

עשה אותו דבר ב-learnFromCorrectionV2 (שורות 747-798).

ככה שתי המערכות תמיד מסונכרנות.
```

---

## באג 4 (חשוב): learning-engine.ts — confidence 0.60 במקום 0.75

```
קרא את lib/classification/learning-engine.ts

הבעיה: שורה 233 — כשנוצר pattern חדש ב-learnFromConfirmation:
  confidence_score: 0.60  // מתחילים ב-60%

אבל לפי v3.1, AI classification חדש צריך להתחיל ב-0.75 (CONFIDENCE_ON_FIRST_CLASSIFY).

תקן:

שורה 233: החלף `confidence_score: 0.60` ב-`confidence_score: CONFIDENCE_ON_FIRST_CLASSIFY`

גם: עדכן את ה-comment בשורה 196 — הוא אומר "תיקון - הורדה ל-50%" אבל הערך האמיתי הוא 0.85.
שנה ל: "תיקון ידני - confidence גבוה (0.85) כי המשתמש אמר מפורש"
```

---

## באג 5 (חשוב): ai-classifier.ts — Month 1 hard rule priority

```
קרא את lib/classification/ai-classifier.ts

הבעיה: שורות 399-407 — בחודש ראשון, אם Gemini סיווג X אבל hard rule אומר Y, hard rule מנצח תמיד.

אבל לפי v3.1: בחודש ראשון, Gemini הוא PRIMARY, hard rules הם VALIDATION בלבד.
Hard rule צריך לתקן את Gemini רק כשה-vendor הוא 100% ברור (סופר, חשמל, ארנונה)
ולא כשה-vendor עמום (מגדל, הפניקס, כלל — שיכולים להיות הרבה דברים).

תקן:

שורות 399-407: שנה את הלוגיקה ל:

// Month 1 validation: hard rule corrects Gemini ONLY for unambiguous vendors
const hardRule = matchHardRule(tx.vendor);
let finalCategory = result.category_name;
let finalConfidence = result.confidence || 0.8;

if (!hasDNA && hardRule && !hardRule.is_credit) {
  // Only override Gemini if hard rule category is VERY different
  // (different group entirely, not just different subcategory)
  const geminiCat = CATEGORIES.find(c => c.name === result.category_name);
  const hardRuleCat = CATEGORIES.find(c => c.name === hardRule.category);

  if (geminiCat && hardRuleCat && geminiCat.group !== hardRuleCat.group) {
    // Different group — hard rule is probably right (e.g. "רמי לוי" = סופר, not ביטוח)
    finalCategory = hardRule.category;
    finalConfidence = 0.95;
  }
  // Same group — trust Gemini's more specific classification
}

ככה Gemini נשאר primary, hard rule מתקן רק טעויות גסות (קבוצה שונה לגמרי).
```

---

## באג 6 (ניקיון): @ts-nocheck בשני קבצים

```
קרא את lib/conversation/states/smart-classification.ts ו-lib/conversation/router.ts

הבעיה: שני הקבצים מתחילים ב-// @ts-nocheck, מה שמדלג על TypeScript checking.
אלה הקבצים הכי קריטיים — באגים של types לא יתגלו.

תקן:

1. הסר את // @ts-nocheck משני הקבצים

2. תקן את ה-type errors שיצוצו. סביר שתצטרך:
   - להוסיף type ל-RouterResult (כנראה חסר newState type)
   - להוסיף 'smart_classification' ל-UserState union type ב-shared.ts
   - להוסיף types ל-classification_context JSONB fields
   - לתקן any types ב-smart-classification.ts (sc.result?.classified)

3. ודא ש-tsc --noEmit עובר בלי שגיאות על שני הקבצים
```

---

## באג 7 (ניקיון): Comments מיושנים

```
קרא את lib/classification/learning-engine.ts

הבעיה: ה-comments בתחילת הקובץ (שורות 1-11) עדיין מתארים את הלוגיקה הישנה:
  "confidence >= 90% → סיווג אוטומטי"
  "confidence < 70% → שואלים בלי הצעה"
  "כל תיקון מוריד ל-50%"

אבל הערכים החדשים הם:
  70% auto, 50% suggest, תיקון = 85%

תקן:

עדכן את ה-comment בראש הקובץ:
/**
 * Learning Engine v3.1 — מנוע למידה אוטומטית לסיווג תנועות
 *
 * לוגיקה:
 * - confidence >= 70% → סיווג אוטומטי (לא שואלים)
 * - confidence 50-69% → מציעים + שואלים
 * - confidence < 50% → שואלים בלי הצעה
 *
 * כל אישור מעלה את ה-confidence ב-10%
 * תיקון ידני = confidence 85% (המשתמש אמר מפורש מה זה)
 * AI classification ראשוני = 75%
 *
 * Financial Signature: vendor + amount range כמפתח
 * "מגדל|small" (189₪) ≠ "מגדל|xlarge" (1,200₪)
 */
```

---

## באג 8 (חשוב): reconciliation.ts — חסר document-based grouping

```
קרא את lib/classification/reconciliation.ts

הבעיה נוספת: שורות 73-81 שולפות כל תנועות confirmed באותו חודש.
אבל זה כולל גם תנועות מדוח הבנק עצמו, לא רק מדוחות אשראי.
ככה הסכום תמיד יהיה גדול מחיוב האשראי.

תקן:

צריך לסנן רק תנועות שהגיעו מדוח אשראי (לא מדוח בנק).

הוסף join עם uploaded_statements כדי לזהות את סוג המסמך:

// Get credit card detail transactions (from CC statements only)
const { data: ccStatements } = await supabase
  .from('uploaded_statements')
  .select('id')
  .eq('user_id', userId)
  .eq('document_type', 'credit')
  .eq('status', 'completed');

const ccStatementIds = (ccStatements || []).map(s => s.id);

if (ccStatementIds.length === 0) {
  // No CC statements uploaded — can't reconcile
  needsDetail.push({...});
  continue;
}

const { data: ccDetails } = await supabase
  .from('transactions')
  .select('id, amount, document_id')
  .eq('user_id', userId)
  .eq('status', 'confirmed')
  .or('is_summary.is.null,is_summary.eq.false')
  .in('document_id', ccStatementIds)
  .gte('tx_date', `${chargeMonth}-01`)
  .lte('tx_date', `${chargeMonth}-31`);

// Group by document_id (each CC statement = separate group)
const groups = new Map<string, number>();
for (const tx of ccDetails || []) {
  const docId = tx.document_id || 'unknown';
  groups.set(docId, (groups.get(docId) || 0) + Math.abs(Number(tx.amount)));
}

// Find a group that matches the charge amount
let matched = false;
for (const [docId, groupSum] of groups) {
  if (Math.abs(groupSum - chargeAmount) <= 1) {
    // Match!
    matched = true;
    break;
  }
}

ככה ה-reconciliation משווה חיוב אשראי בבנק רק מול תנועות מדוח האשראי הרלוונטי.
```

---

## סדר ביצוע מומלץ

1. **באג 2** — sendListMessage (בלי זה ה-button flow שבור)
2. **באג 1 + 8** — reconciliation (שני התיקונים ביחד)
3. **באג 3** — dual storage sync
4. **באג 4** — confidence 0.60 → 0.75
5. **באג 5** — month 1 hard rule priority
6. **באג 6** — הסרת @ts-nocheck
7. **באג 7** — comments

---

## בדיקה אחרי תיקונים

אחרי כל התיקונים, ודא:

1. `npx tsc --noEmit` עובר בלי שגיאות
2. הרץ את ה-flow עם משתמש חדש (אין DNA, אין rules):
   - העלה דוח → ודא ש-Gemini primary + hard rules validation
   - ודא שסיכום מוצג עם confidence split
   - ודא ש-buttons עובדים (list message + interactive buttons)
3. הרץ עם משתמש ותיק (יש DNA):
   - ודא ש-DNA שכבה 0 תופס recurring
   - ודא ש-corrections נשמרים בשתי הטבלאות
4. ודא reconciliation:
   - העלה דוח בנק + דוח אשראי לאותו חודש
   - ודא שחיוב האשראי בבנק סומן is_summary
   - ודא שאין כפל ספירה בסיכום
