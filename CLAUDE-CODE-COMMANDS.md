# φ FinHealer — פקודות ליישום לקלוד קוד

## חשוב! קרא את SYSTEM-FLOW-v3.1.md לפני שמתחיל

כל הפקודות מתבססות על המסמך הזה. הוא ה-source of truth לארכיטקטורה.

---

## שלב 1: מנוע סיווג AI חדש (ai-classifier.ts)

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md בתיקיית הפרויקט — זה מסמך החזון המלא של המערכת.

צור קובץ חדש: lib/classification/ai-classifier.ts

זהו המנוע המרכזי החדש שמחליף את כל ה-classification flow הישן (שעובד תנועה-תנועה עם 50 הודעות וואטסאפ).

הפונקציה הראשית: classifyAllTransactions(userId: string)

מה היא עושה:
1. שולפת כל התנועות pending מ-Supabase (transactions table, status='pending', filter is_summary)
2. שולפת פרופיל המשתמש (users table — כולל classification_context שמכיל phi_profile ו-financial_dna)
3. שולפת כל ה-user_patterns של המשתמש

סדר הסיווג משתנה לפי בגרות (האם יש DNA פיננסי או לא):

אם אין DNA (חודש ראשון):
  שכבה 1: Gemini batch — שולח את כל התנועות ב-prompt אחד (ראה מבנה prompt במסמך). original_description עובר כמו שהוא בלי normalization!
  שכבה 2: מילון ישראלי HARD_RULES — validation בלבד. אם Gemini סיווג "רמי לוי = ביטוח" → המילון מתקן.

אם יש DNA (מחודש שני):
  שכבה 0: DNA פיננסי — השוואה מול template. תנועה שתואמת (vendor + amount range) → auto-confirm עם 0 API calls.
  שכבה 1: מילון ישראלי HARD_RULES — 200+ vendors ישראליים (רמי לוי=סופר, חברת חשמל=חשמל, פלאפון=סלולר וכו')
  שכבה 2: כללים אישיים מ-user_patterns (confidence >= 70% במקום 90% כמו היום)
  שכבה 3: Gemini batch — רק מה שנשאר. batches של עד 50 תנועות per prompt. ה-prompt כולל: כל התנועות שצריך לסווג, הפרופיל, מה כבר סווג (כקונטקסט), ורשימת כל הקטגוריות. מבנה ה-prompt המלא נמצא בסוף SYSTEM-FLOW-v3.1.md.

טיפול בזיכויים: סכום שלילי מ-vendor שכבר יש לו חיוב → לא הכנסה, אלא הפחתה מהקטגוריה המקורית.

טיפול במט"ח: מזהה USD/EUR/GBP ב-description, שומר original_amount + currency + exchange_rate + amount_ils.

הפונקציה מחזירה:
{
  classified: Array<{tx, category, confidence, source: 'dna'|'rules'|'personal'|'ai', reasoning?: string}>,
  unclassified: Array<tx>,
  summary: Record<string, {total: number, count: number, items: string[], refunds: number}>,
  highConfidence: Array<tx>,  // confidence >= 0.85
  lowConfidence: Array<tx>,   // confidence < 0.85 — "כדאי לבדוק"
}

הקובץ גם מכיל:
- HARD_RULES: Record<string, {category_id, category_name}> — מילון ישראלי קשיח. לפחות 200 vendors נפוצים. כולל: רשתות סופר (רמי לוי, שופרסל, ויקטורי, יוחננוף, אושר עד), חברות תקשורת (פלאפון, סלקום, פרטנר, HOT, בזק, yes), חברות ביטוח (מגדל, הראל, כלל, מנורה, AIG, שלמה), בנקים, חברות אשראי, רשתות דלק, וכו'.
- matchAgainstDNA(tx, dna): boolean — בודק אם תנועה תואמת ל-DNA (vendor + amount בטווח +-20%)
- buildBatchPrompt(transactions, userProfile, existingClassifications, categories): string — בונה את ה-prompt ל-Gemini לפי המבנה שבמסמך
- validateOCROutput(transactions): Array<{tx, flags: string[]}> — validation: סכום שלילי, מעל 50K, תאריך מחוץ לטווח

חשוב: קרא את lib/ai/gemini-client.ts ו-lib/finance/categories.ts ו-lib/finance/income-categories.ts הקיימים כדי להשתמש ב-types ובפונקציות הקיימות. השתמש ב-chatWithGeminiFlashMinimal עם responseMimeType: 'application/json'.
```

---

## שלב 2: Batch Classification Prompt (batch-classification-prompt.ts)

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלק "Gemini Batch Prompt — מבנה מלא".

צור קובץ חדש: lib/ai/batch-classification-prompt.ts

הקובץ מכיל שתי פונקציות:

1. buildSystemPrompt(): string
   מחזיר את ה-system prompt הקבוע לסיווג batch. כולל את כל הכללים:
   - רק קטגוריות מהרשימה
   - vendor עם סכומים שונים = מוצרים שונים
   - קונטקסט חשוב (אם יש ביטוח רכב מ-AIG, מגדל זה כנראה משהו אחר)
   - זיכוי = קטגוריה מקורית
   - חיוב אשראי כולל = is_credit_charge
   - הו"ק = הוראת קבע = fixed
   - original_description חשוב יותר מ-vendor
   - מט"ח = עסקת חו"ל
   - JSON בלבד, בלי markdown

2. buildUserPrompt(params): string
   params: {
     transactions: Array<{index, date, vendor, amount, original_description}>,
     userProfile: {employment, has_kids, has_vehicle, ...},
     existingClassifications: Array<{category_name, vendor, amount_avg}>,
     expenseCategories: CategoryDef[],  // מ-categories.ts
     incomeCategories: IncomeCategoryDef[]  // מ-income-categories.ts
   }

   בונה את ה-user prompt לפי המבנה שבמסמך:
   - פרופיל משתמש (עם confidence levels)
   - מה כבר מסווג (כקונטקסט)
   - רשימת תנועות לסיווג (index | date | vendor | amount | original_description)
   - רשימת קטגוריות הוצאה (id: name (group, type))
   - רשימת קטגוריות הכנסה
   - פורמט החזרה הצפוי

חשוב: ייבא את CATEGORIES מ-lib/finance/categories.ts ואת INCOME_CATEGORIES מ-lib/finance/income-categories.ts.
```

---

## שלב 3: עדכון Learning Engine

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלקים על DNA פיננסי, חתימה פיננסית, ולמידה מתיקונים.
קרא את lib/classification/learning-engine.ts הקיים.

ערוך את lib/classification/learning-engine.ts:

שינויים ב-thresholds:
- AUTO_CLASSIFY_THRESHOLD: 0.90 → 0.70
- SUGGEST_THRESHOLD: 0.70 → 0.50
- MIN_COUNT_FOR_AUTO: 3 → 1
- CONFIDENCE_ON_CORRECTION: 0.50 → 0.85 (תיקון ידני = ודאות גבוהה)
- CONFIDENCE_ON_FIRST_CLASSIFY: 0.60 → 0.75 (AI סיווג = ודאות סבירה)

שינוי ב-pattern_key:
במקום רק vendor מנורמל, הוסף financial signature:
pattern_key = normalizeVendor(vendor) + '|' + amountRange(amount)

amountRange:
  0-50 → 'micro'
  50-200 → 'small'
  200-500 → 'medium'
  500-1000 → 'large'
  1000-3000 → 'xlarge'
  3000+ → 'jumbo'

ככה "מגדל|small" (189₪ = ביטוח בריאות) ≠ "מגדל|xlarge" (1,200₪ = פנסיה)

הוסף פונקציות חדשות:

1. learnFromBatchClassification(userId, classifications: Array<{vendor, amount, category_id, category_name, source}>)
   - שומר את כל ה-patterns בבת אחת
   - משתמש ב-financial signature כ-pattern_key
   - confidence: 0.75 ל-AI classifications, 0.85 לתיקונים ידניים

2. learnFromCorrection(userId, vendor, amount, oldCategory, newCategory)
   - מעדכן את הכלל הישן (מוריד confidence ל-0.50)
   - יוצר כלל חדש עם confidence 0.85
   - משתמש ב-financial signature

3. buildFinancialDNA(userId): Promise<FinancialDNA>
   - שולף כל התנועות confirmed של 3 חודשים אחרונים
   - מקבץ לפי category + vendor
   - לכל קבוצה: ממוצע סכום, טווח סכום (min/max), ימים בחודש, תדירות
   - מחזיר JSON של ה-DNA (כמו בדוגמה במסמך)
   - שומר ב-classification_context.financial_dna

4. matchAgainstDNA(tx, dna): {matched: boolean, category?: string, confidence?: number}
   - בודק אם תנועה תואמת entry ב-DNA
   - vendor match (fuzzy) + amount בטווח +-20%
   - אם תואם → מחזיר category + confidence 0.95

שמור backward compatibility — הפונקציות הישנות (getSuggestion, learnFromConfirmation) עדיין עובדות.
```

---

## שלב 4: State חדש — Smart Classification

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלקים על שלב 2 (סיווג אוטומטי) ותיקון בוואטסאפ.
קרא את lib/conversation/states/classification.ts הקיים (זה ה-1,742 שורות שמחליפים).
קרא את lib/greenapi/client.ts כדי להבין את ה-API של GreenAPI (sendMessage, sendInteractiveButtons, sendList).

צור קובץ חדש: lib/conversation/states/smart-classification.ts

זה מחליף את classification.ts + classification_income + classification_expense ב-state אחד פשוט.

State: 'smart_classification'

פונקציה ראשית: handleSmartClassification(ctx: RouterContext, msg: string): Promise<RouterResult>

Flow:

1. אם המשתמש אומר "נמשיך"/"התחל"/"סווג" (או button start_classify):
   - שולח הודעה: "⏳ מעבד את הדוח..."
   - קורא ל-classifyAllTransactions(userId) מ-ai-classifier.ts
   - שומר כל הסיווגים ב-DB (transactions table — update status='confirmed', category, expense_category/income_category)
   - קורא ל-learnFromBatchClassification לשמור כללים
   - בונה הודעת סיכום עם confidence visual:

     "✅ קיבלתי! 47 תנועות:

     ✅ 42 — ודאות גבוהה:
     🛒 סופר: 3,015₪ (כולל זיכוי 85₪) | 🏠 דיור: 4,200₪ | 🚗 רכב: 1,800₪

     ⚠️ 5 — כדאי לבדוק:
     • מגדל 340₪ → ביטוח רכב
     • העברה 2,000₪ → חיסכון

     הכל נכון?"

   - שולח buttons: ["הכל נכון ✅", "תיקון 🔧"]
   - שומר ב-classification_context: summary, lowConfidence items

2. אם "הכל נכון" (או button approve_all):
   - מוודא כל התנועות confirmed
   - עובר ל-state הבא (behavior/goals/budget/monitoring — לפי data-gating)
   - סיימנו ב-2 הודעות!

3. אם "תיקון" (או button fix):
   - שולח list message עם קטגוריות (עד 8, לפי סכום יורד + "עוד...")
   - שומר ב-classification_context: mode='correction', step='category_select'

4. אם המשתמש בחר קטגוריה (callback מ-list):
   - מציג עד 10 תנועות בקטגוריה כ-list message
   - שומר: step='transaction_select', selected_category

5. אם בחר תנועה:
   - מציג 3 חלופות חכמות כ-buttons (מחושבות לפי קונטקסט — קטגוריות שיש להן vendors דומים, או קטגוריות באותה קבוצה) + button "אחר"
   - שומר: step='alternative_select', selected_transaction

6. אם בחר חלופה:
   - מעדכן תנועה ב-DB
   - קורא learnFromCorrection
   - שולח: "✅ עודכן! עוד תיקון?"
   - buttons: ["עוד תיקון", "סיימתי ✅"]

7. אם "אחר":
   - שולח: "כתבו שם קטגוריה (למשל: ביטוח בריאות, חיסכון, מתנה...)"
   - step='free_text_category'

8. אם free text:
   - מחפש התאמה ב-categories עם findBestMatch/findTopMatches
   - אם נמצא → מעדכן + לומד
   - אם לא → "לא מצאתי. נסו שם אחר?"

9. אם "סיימתי":
   - כמו "הכל נכון" — מאשר ועובר הלאה

חשוב:
- כל ה-buttons משתמשים ב-GreenAPI sendInteractiveButtons (עד 3 buttons) או sendList (עד 10 items עם sections)
- שמור את ה-state ב-classification_context (mode, step, selected_category, selected_transaction) עם merge
- אפס הקלדה מצד המשתמש (חוץ מ-"אחר")
- אל תשכח ניהול שגיאות — אם GreenAPI נכשל, fallback ל-sendMessage רגיל
```

---

## שלב 5: עדכון Router

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלק Migration.
קרא את lib/conversation/router.ts הקיים.

ערוך את lib/conversation/router.ts:

1. הוסף 'smart_classification' ל-UserState type union

2. הוסף feature flag check:
   const useNewClassifier = await isPhiBrainEnabled(ctx.userId);
   // בודק classification_context.phi_brain_enabled או ENV var

3. בכל מקום שמפנה ל-'classification' / 'classification_income' / 'classification_expense':
   if (useNewClassifier) {
     // נתב ל-handleSmartClassification
   } else {
     // שמור flow ישן כ-fallback
   }

4. עדכן את moveToNextPhase:
   אחרי smart_classification → בדוק data-gating:
   - 2+ חודשים + אין behavior insights → 'behavior'
   - 2+ חודשים + יש behavior + אין goals → 'goals_setup'
   - 3+ חודשים + יש goals + אין budget → 'budget'
   - יש budget → 'monitoring'

5. הוסף import של handleSmartClassification

חשוב: לא למחוק את הקוד הישן! הוא משמש כ-fallback. רק להוסיף routing חדש עם feature flag.
```

---

## שלב 6: OCR Validation

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלק OCR Validation.
קרא את lib/ai/gemini-client.ts — הפונקציה chatWithGeminiProVision שמעבדת מסמכים.

צור קובץ חדש: lib/classification/ocr-validator.ts

פונקציה: validateOCRTransactions(transactions, documentMetadata?)

בודק כל תנועה ומחזיר flags:

1. סכום שלילי → flag: 'refund' (לא שגיאה, אלא זיכוי)
2. סכום > 50,000₪ → flag: 'high_amount_review'
3. תאריך מחוץ לטווח הדוח (אם documentMetadata מכיל start_date/end_date) → flag: 'date_out_of_range'
4. vendor ריק → flag: 'missing_vendor'
5. סכום = 0 → flag: 'zero_amount'

פונקציה: validateDocumentTotals(transactions, reportedTotal?)
- אם יש סכום כולל מהדוח (reportedTotal) → משווה עם סכום כל התנועות
- פער > 5% → flag: 'total_mismatch'

פונקציה: detectDuplicateDocument(userId, fileHash, month, accountId?)
- בודק uploaded_statements אם hash קיים → return 'exact_duplicate'
- בודק אם יש מסמך אחר לאותו חודש + חשבון → return 'same_period'
- אחרת → return 'new'

מחזיר:
{
  validTransactions: Array<tx>,
  flaggedTransactions: Array<{tx, flags: string[]}>,
  documentStatus: 'new' | 'exact_duplicate' | 'same_period',
  totalMismatch: boolean
}

שלב את הפונקציה הזו ב-flow של עיבוד מסמכים — אחרי OCR ולפני classification.
```

---

## שלב 7: כפילות מסמכים

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלק "כפילות מסמכים — מניעה".

ערוך את ה-flow של עיבוד מסמכים (כנראה ב-lib/conversation/states/ או lib/services/) — מצא את המקום שמעבד מסמך חדש שהמשתמש שלח.

הוסף לפני עיבוד:
1. חשב SHA-256 hash של הקובץ (crypto.createHash('sha256'))
2. שמור hash ב-uploaded_statements.file_hash (צריך להוסיף עמודה)
3. לפני עיבוד: בדוק אם hash קיים
   - קיים → שלח "כבר קיבלתי את הדוח הזה ✅" ועצור
4. בדוק אם יש מסמך אחר לאותו חודש + חשבון:
   - קיים → שלח "כבר יש דוח ל[חודש] מ[בנק]. להחליף?"
   - buttons: ["כן, להחליף", "לא, בטל"]
   - אם כן → מחק תנועות ישנות של אותו document_id + עבד מחדש
```

---

## שלב 8: Reconciliation

```
קרא את הקובץ SYSTEM-FLOW-v3.1.md — חלק Reconciliation.
קרא את lib/conversation/classification-flow.ts — הפונקציה getClassifiableTransactions שמטפלת ב-credit charges.

צור קובץ חדש: lib/classification/reconciliation.ts

פונקציה: reconcileCreditCharges(userId)

1. שולף תנועות מסוג "חיוב אשראי כולל" מדוח הבנק:
   - מזהה לפי vendor שמכיל: ויזה, visa, mastercard, מסטרקארד, ישראכרט, כאל, cal, max
   - או original_description שמכיל "חיוב לכרטיס"

2. לכל חיוב כזה, מחפש דוח אשראי תואם ב-uploaded_statements:
   - התאמה לפי: סכום (tolerance 1₪), חודש חיוב, 4 ספרות אחרונות של כרטיס

3. אם נמצאה התאמה:
   - מסמן את חיוב הבנק כ-is_summary = true
   - מקשר את הפירוט לחיוב: transactions.parent_summary_id = חיוב הבנק

4. אם לא נמצאה התאמה:
   - מסמן כ-needs_detail = true
   - לא חוסם סיווג של שאר התנועות!

מחזיר:
{
  reconciled: number,        // כמה חיובי אשראי הותאמו
  needsDetail: Array<{amount, card_last4, charge_date}>,  // חסרים
  summary_ids: string[]      // IDs של תנועות שסומנו is_summary
}

הפעל את הפונקציה הזו אחרי כל עיבוד מסמך חדש, לפני הסיווג.
```

---

## סדר ביצוע מומלץ

1. **שלב 2** — Batch Prompt (אין תלויות)
2. **שלב 6** — OCR Validation (אין תלויות)
3. **שלב 3** — Learning Engine (מעדכן קיים)
4. **שלב 1** — AI Classifier (תלוי ב-2, 3, 6)
5. **שלב 7** — כפילויות (אין תלויות, אבל משתלב ב-flow)
6. **שלב 8** — Reconciliation (אין תלויות)
7. **שלב 4** — Smart Classification State (תלוי ב-1, 3)
8. **שלב 5** — Router Update (תלוי ב-4)

---

## הערות חשובות לקלוד קוד

- **לא למחוק קוד ישן!** classification.ts ו-learning-engine.ts נשארים כ-fallback.
- **Feature flag:** PHI_BRAIN_ENABLED — מתחיל כ-false, מפעילים בהדרגה.
- **original_description:** בכל מקום שנוגע בתנועות — לשמור ולהעביר את השדה הזה כמו שהוא. בלי normalization, בלי הסרת מספרים.
- **classification_context:** תמיד spread-merge, לא לדרוס!
- **tx_date לא date, phase לא current_phase, name לא full_name**
- **Supabase:** השתמש ב-createServiceClient() מהפרויקט הקיים.
- **GreenAPI:** השתמש ב-getGreenAPIClient() מהפרויקט הקיים.
- **קטגוריות:** ייבא מ-lib/finance/categories.ts ו-lib/finance/income-categories.ts
