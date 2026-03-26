# FinHealer — Production Readiness Plan
## מ-MVP לאלפי משתמשים

> מסמך זה מתעדף את השינויים הנדרשים להכנת המערכת לסקייל.
> כל פאזה עומדת בפני עצמה — אפשר לשחרר אחרי כל אחת.

---

## פאזה 0 — חובה לפני Scale (שבוע 1-2)

### 0.1 מיזוג טבלאות Patterns → מקור אמת אחד
**בעיה:** `user_patterns` ו-`user_category_rules` מאחסנות אותו מידע. כל כתיבה עושה 3-4 queries עם sync ביניהן. מספיק ש-query אחד נכשל → inconsistency שקט.

**פתרון:**
```
1. Migration script: העתק הכל מ-user_patterns → user_category_rules
2. עדכן את autoClassifyTransactions (הקוד הישן) לקרוא מ-user_category_rules
3. הסר את כל ה-sync writes ל-user_patterns מ-learnFromBatchClassification ו-learnFromCorrectionV2
4. צור view או alias זמני על user_patterns שמצביע ל-user_category_rules (למקרה שיש קוד נוסף)
5. אחרי שבוע — מחק את user_patterns
```

**פקודה לקלוד קוד:**
```
Search the entire codebase for any reference to "user_patterns" table.
List every file and line. Then create a migration plan that:
1. Creates a Supabase migration to copy all data from user_patterns to user_category_rules (mapping pattern_key → vendor_pattern, pattern_value.category_name → category, confidence_score → confidence)
2. Updates every file that reads from user_patterns to read from user_category_rules instead
3. Removes all dual-write code (lines that write to user_patterns as "sync")
4. Does NOT delete the user_patterns table yet — just stops using it
```

### 0.2 פיצול route.ts (2,826 שורות → pipeline)
**בעיה:** קובץ אחד שמטפל ב-OCR, validation, classification, reconciliation, duplicates, והתראות. אם step 4 נופל, steps 1-3 הולכים לפח. אין retry, אין visibility.

**פתרון — Pipeline Architecture:**
```
app/api/documents/process/route.ts          → orchestrator בלבד (~200 שורות)
lib/pipeline/step-1-ocr.ts                  → OCR extraction
lib/pipeline/step-2-validate.ts             → validation + anomaly flags
lib/pipeline/step-3-classify.ts             → 4-layer classification
lib/pipeline/step-4-reconcile.ts            → CC reconciliation
lib/pipeline/step-5-notify.ts               → WhatsApp summary

lib/pipeline/types.ts                       → PipelineContext, StepResult
lib/pipeline/runner.ts                      → executeStep with try/catch, logging, status tracking
```

כל step:
- מקבל `PipelineContext` (userId, documentId, transactions[])
- מחזיר `StepResult` עם status: 'success' | 'failed' | 'skipped'
- כותב status ל-DB: `document_pipeline_status` (document_id, step_name, status, error, started_at, completed_at)
- Step שנופל → השאר ממשיכים (classify יכול לעבוד גם אם reconcile נכשל)

**פקודה לקלוד קוד:**
```
Refactor app/api/documents/process/route.ts into a pipeline architecture:

1. Create lib/pipeline/types.ts with:
   - PipelineContext: { userId, documentId, transactions, metadata }
   - StepResult: { status: 'success'|'failed'|'skipped', data?, error?, durationMs }
   - PipelineStep: (ctx: PipelineContext) => Promise<StepResult>

2. Create lib/pipeline/runner.ts:
   - executePipeline(steps: PipelineStep[], ctx) — runs steps sequentially
   - Each step wrapped in try/catch with timing
   - Failed step logs error but doesn't stop pipeline (unless critical)
   - Returns full pipeline report

3. Extract these from route.ts into separate step files:
   - lib/pipeline/step-1-ocr.ts (OCR extraction logic)
   - lib/pipeline/step-2-validate.ts (validation + anomaly detection)
   - lib/pipeline/step-3-classify.ts (calls classifyAllTransactions)
   - lib/pipeline/step-4-reconcile.ts (CC reconciliation)
   - lib/pipeline/step-5-notify.ts (WhatsApp notification)

4. Rewrite route.ts to just:
   - Parse request
   - Build PipelineContext
   - Call executePipeline with all steps
   - Return response

Keep ALL existing business logic — just reorganize it into steps.
Do NOT change any classification, reconciliation, or notification logic.
```

### 0.3 Gemini Output Validation
**בעיה:** אם Gemini מחזיר שטויות (80% "אחר", אותה קטגוריה על הכל, קטגוריות שלא קיימות), הכל נכתב ל-DB ונלמד כ-personal rule. ב-scale — disaster.

**פתרון — הוסף validation layer ב-ai-classifier.ts אחרי parse של Gemini response:**
```typescript
function validateGeminiOutput(results: GeminiResult[], categories: Category[]): {
  valid: GeminiResult[];
  rejected: GeminiResult[];
  warnings: string[];
} {
  const validCategoryNames = new Set(categories.map(c => c.name));
  const warnings: string[] = [];

  // Check 1: Invalid category names
  const withValidCategories = results.filter(r => {
    if (!validCategoryNames.has(r.category_name)) {
      warnings.push(`Unknown category "${r.category_name}" for vendor "${r.vendor}"`);
      return false;
    }
    return true;
  });

  // Check 2: Suspiciously uniform classification (>60% same category, excluding credit charges)
  const nonCredit = withValidCategories.filter(r => !r.is_credit_charge);
  if (nonCredit.length > 5) {
    const categoryCounts = new Map<string, number>();
    nonCredit.forEach(r => categoryCounts.set(r.category_name, (categoryCounts.get(r.category_name) || 0) + 1));
    const maxCount = Math.max(...categoryCounts.values());
    if (maxCount / nonCredit.length > 0.6) {
      warnings.push(`Gemini classified ${maxCount}/${nonCredit.length} as same category — suspicious`);
      // Don't reject, but lower confidence
      withValidCategories.forEach(r => r.confidence = Math.min(r.confidence || 0.8, 0.6));
    }
  }

  // Check 3: Too many "אחר" (>40%)
  const otherCount = withValidCategories.filter(r => r.category_name === 'אחר').length;
  if (withValidCategories.length > 5 && otherCount / withValidCategories.length > 0.4) {
    warnings.push(`${otherCount}/${withValidCategories.length} classified as "אחר" — Gemini may have failed`);
  }

  return { valid: withValidCategories, rejected: results.filter(r => !withValidCategories.includes(r)), warnings };
}
```

**פקודה לקלוד קוד:**
```
In lib/classification/ai-classifier.ts, add a validateGeminiOutput function
that runs AFTER parsing Gemini's response and BEFORE writing to DB.

Checks:
1. Category name exists in CATEGORIES list → reject if not
2. If >60% of non-credit transactions got same category → lower all confidence to 0.6
3. If >40% classified as "אחר" → add warning, lower confidence to 0.5
4. If confidence returned by Gemini is >0.99 → cap at 0.95 (Gemini tends to be overconfident)

Log all warnings. Don't block the pipeline — just adjust confidence down so
these transactions go to manual review instead of auto-classification.
```

---

## פאזה 1 — Observability (שבוע 2-3)

### 1.1 Structured Logging
**בעיה:** כרגע ה-logging הוא `console.log` עם אימוג'ים. אצל 2,000 משתמשים — בלתי ניתן לחיפוש.

**פתרון:**
```
1. צור lib/logger.ts — wrapper מעל console שמוסיף:
   - userId, documentId, step, timestamp
   - log levels: debug, info, warn, error
   - JSON format לחיפוש ב-Vercel logs

2. החלף כל console.log/error בפרויקט ב-logger calls
```

### 1.2 Classification Metrics Dashboard
**בעיה:** אין visibility על איכות הסיווג. אתה לא יודע כמה אחוז מהמשתמשים מתקנים, איזה קטגוריות Gemini טועה בהן, או מתי ה-DNA מתחיל לעבוד.

**פתרון:**
```
טבלת Supabase: classification_metrics
- user_id, month, total_transactions
- auto_classified_count, manual_review_count, correction_count
- layer_hits: { dna: N, hard_rules: N, personal: N, ai: N }
- avg_confidence, gemini_api_calls
- top_corrections: [{ from: "ביטוח", to: "בריאות", count: 3 }]
```

### 1.3 Error Alerting
**פתרון פשוט:**
```
כל error ב-pipeline → כותב ל-Supabase טבלת system_errors
Cron job (או Vercel cron) פעם בשעה בודק אם יש errors חדשים
אם יש — שולח הודעת WhatsApp לאדמין (לך)
```

---

## פאזה 2 — Resilience (שבוע 3-4)

### 2.1 Retry Logic עם Exponential Backoff
```typescript
// lib/pipeline/retry.ts
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 }
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
```

שימוש: Gemini API calls, Supabase writes, GreenAPI sends.

### 2.2 Rate Limiting ל-Gemini
**בעיה:** 2,000 משתמשים × 47 transactions כל אחד = batch prompts מרובים. Gemini rate limits → 429 errors → classification fails.

**פתרון:**
```
lib/ai/rate-limiter.ts
- Queue של Gemini requests
- Max N concurrent requests (start with 5)
- Respect Gemini's rate limit headers
- Retry on 429 with backoff
```

### 2.3 Graceful Degradation
```
אם Gemini לא זמין:
→ Hard rules + personal rules עדיין עובדים
→ שאר → "ממתין לסיווג" (לא "אחר"!)
→ כשחוזר → batch classify את הממתינים
```

---

## פאזה 3 — Scale Prep (שבוע 4-6)

### 3.1 Database Indexes
```sql
-- Queries שרצות הכי הרבה:
CREATE INDEX idx_transactions_user_pending ON transactions(user_id) WHERE status = 'pending';
CREATE INDEX idx_user_category_rules_lookup ON user_category_rules(user_id, vendor_pattern);
CREATE INDEX idx_uploaded_statements_user ON uploaded_statements(user_id, status);
CREATE INDEX idx_transactions_document ON transactions(document_id);
```

### 3.2 Batch Sizes
```
כרגע: כל התנועות ב-prompt אחד ל-Gemini.
בעיה: 200 תנועות → prompt ענק → slow response / token limit.
פתרון: chunks של 30 תנועות, parallel requests (with rate limit).
```

### 3.3 Tests לסיווג
**בעיה:** אין test אחד על המערכת החדשה (smart-classification, ai-classifier, learning-engine, reconciliation). יש tests ישנים על classification-flow שכנראה שבורים.

**פתרון — קובץ test אחד מינימלי שמכסה את הקריטי:**
```
tests/lib/classification/ai-classifier.test.ts
- matchHardRule: vendor ידוע → מחזיר category נכון
- matchHardRule: vendor לא ידוע → null
- Month 1 logic: Gemini + hard rule same group → trust Gemini
- Month 1 logic: Gemini + hard rule different group → trust hard rule
- validateGeminiOutput: invalid category → rejected

tests/lib/classification/learning-engine.test.ts
- getFinancialSignature: amount ranges correct
- learnFromBatchClassification: writes to user_category_rules
- learnFromCorrectionV2: lowers old confidence, creates new at 0.85

tests/lib/classification/reconciliation.test.ts
- filters out is_summary transactions
- matches within ±1₪ tolerance
- groups by document_id
```

---

## פאזה 4 — Growth Features (שבוע 6+)

### 4.1 Classification Cache
```
Redis/Supabase cache:
- Key: financial_signature (vendor|amount_range)
- Value: category + confidence
- TTL: 30 days
- Hit rate target: 70%+ after month 3

כל classification → check cache first → skip DB query entirely
```

### 4.2 Multi-Tenant DNA Sharing (אופציונלי)
```
כש-1,000 משתמשים מסווגים "רמי לוי" כ"מזון",
משתמש חדש לא צריך Gemini בכלל בשביל רמי לוי.

Global DNA: aggregated patterns שלפחות 20 משתמשים הסכימו עליהם.
Privacy: רק category name, לא amounts או user data.
```

### 4.3 Webhook Queue
```
במקום GreenAPI calls ישירים:
→ Queue (Supabase + cron, או Inngest, או QStash)
→ Retry on failure
→ Rate limit per user (silence rules)
→ Dedup (אותה הודעה פעמיים)
```

---

## סדר עדיפויות — TL;DR

| # | משימה | אימפקט | מאמץ | חובה לפני scale? |
|---|--------|--------|------|-------------------|
| 0.1 | מיזוג טבלאות | 🔴 קריטי | קטן | ✅ כן |
| 0.2 | פיצול route.ts | 🔴 קריטי | בינוני | ✅ כן |
| 0.3 | Gemini validation | 🔴 קריטי | קטן | ✅ כן |
| 1.1 | Structured logging | 🟠 גבוה | קטן | ✅ כן |
| 1.2 | Metrics dashboard | 🟠 גבוה | בינוני | מומלץ |
| 2.1 | Retry logic | 🟠 גבוה | קטן | ✅ כן |
| 2.2 | Gemini rate limiting | 🟠 גבוה | קטן | ✅ כן |
| 2.3 | Graceful degradation | 🟡 בינוני | קטן | מומלץ |
| 3.1 | DB indexes | 🟠 גבוה | קטן | ✅ כן |
| 3.2 | Batch sizes | 🟡 בינוני | קטן | מומלץ |
| 3.3 | Tests | 🟠 גבוה | בינוני | ✅ כן |
| 4.1 | Cache | 🟡 בינוני | בינוני | לא |
| 4.2 | Global DNA | 🟢 נמוך | גבוה | לא |
| 4.3 | Webhook queue | 🟡 בינוני | בינוני | מומלץ |

---

## באגים — סטטוס

| # | באג | סטטוס |
|---|-----|-------|
| 1 | reconciliation.ts is_summary filter | ✅ תוקן |
| 2 | sendListMessage missing | ✅ תוקן |
| 3 | dual storage sync | ✅ תוקן (workaround — פאזה 0.1 מסיר לגמרי) |
| 4 | confidence 0.60 | ✅ תוקן |
| 5 | Month 1 hard rule priority | ✅ תוקן |
| 6 | @ts-nocheck | ✅ תוקן |
| 7 | outdated comments | ✅ תוקן |
| 8 | reconciliation scope | ✅ תוקן |
