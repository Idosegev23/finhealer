/**
 * AI-First Classifier — v3.1
 *
 * Dynamic 4-layer classification engine:
 *
 * Month 1 (no history):
 *   Layer 1: Gemini batch (PRIMARY) — gets original_description as-is
 *   Layer 2: Israeli dictionary — validation only
 *
 * Month 2+ (has DNA):
 *   Layer 0: Financial DNA — auto-confirm recurring patterns (0 API calls)
 *   Layer 1: Israeli dictionary (200+ vendors)
 *   Layer 2: Personal rules (user corrections, confidence ≥ 70%)
 *   Layer 3: Gemini batch — only what's left (usually <20%)
 *
 * All layers pass original_description WITHOUT normalization.
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  normalizeVendorName,
  getFinancialSignature,
  matchAgainstDNA,
  learnFromBatchClassification,
  type FinancialDNA,
} from './learning-engine';
import { chatWithGeminiFlashMinimal } from '@/lib/ai/gemini-client';
import {
  buildSystemPrompt,
  buildUserPrompt,
  type TransactionForClassification,
  type UserProfileForPrompt,
  type ClassificationResult,
} from '@/lib/ai/batch-classification-prompt';
import { CATEGORIES } from '@/lib/finance/categories';

// ============================================================================
// Types
// ============================================================================

export interface ClassifiedTransaction {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category: string;
  expense_type?: 'fixed' | 'variable' | 'special';
  confidence: number;
  source: 'dna' | 'hard_rule' | 'personal' | 'ai';
  is_credit_charge?: boolean;
  is_refund?: boolean;
  reasoning?: string;
}

export interface ClassifyAllResult {
  classified: ClassifiedTransaction[];
  unclassified: Array<{ id: string; vendor: string; amount: number }>;
  summary: Record<string, { total: number; count: number; items: string[]; refunds: number }>;
  highConfidence: ClassifiedTransaction[];
  lowConfidence: ClassifiedTransaction[];
  stats: {
    total: number;
    dna: number;
    hardRules: number;
    personal: number;
    ai: number;
    unclassified: number;
    creditCharges: number;
    refunds: number;
  };
}

// ============================================================================
// Israeli Vendor Dictionary (Hard Rules)
// ============================================================================

const HARD_RULES: Record<string, { category: string; expense_type?: string; is_credit?: boolean }> = {
  // — סופרים —
  'רמי לוי': { category: 'קניות סופר', expense_type: 'variable' },
  'שופרסל': { category: 'קניות סופר', expense_type: 'variable' },
  'ויקטורי': { category: 'קניות סופר', expense_type: 'variable' },
  'מגה': { category: 'קניות סופר', expense_type: 'variable' },
  'יוחננוף': { category: 'קניות סופר', expense_type: 'variable' },
  'אושר עד': { category: 'קניות סופר', expense_type: 'variable' },
  'חצי חינם': { category: 'קניות סופר', expense_type: 'variable' },
  'סופר פארם': { category: 'קניות סופר', expense_type: 'variable' },
  'יש חסד': { category: 'קניות סופר', expense_type: 'variable' },
  'carrefour': { category: 'קניות סופר', expense_type: 'variable' },
  'קרפור': { category: 'קניות סופר', expense_type: 'variable' },
  'am:pm': { category: 'מזון ומשקאות', expense_type: 'variable' },
  'טיב טעם': { category: 'קניות סופר', expense_type: 'variable' },
  // — דלק —
  'סונול': { category: 'דלק', expense_type: 'variable' },
  'פז ': { category: 'דלק', expense_type: 'variable' },
  'דלק': { category: 'דלק', expense_type: 'variable' },
  'ten ': { category: 'דלק', expense_type: 'variable' },
  'דור אלון': { category: 'דלק', expense_type: 'variable' },
  'yellow': { category: 'דלק', expense_type: 'variable' },
  // — תקשורת —
  'פלאפון': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'סלקום': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'פרטנר': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'הוט מובייל': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'גולן טלקום': { category: 'טלפונים ניידים', expense_type: 'fixed' },
  'hot': { category: 'טלוויזיה (YES / HOT / סלקום)', expense_type: 'fixed' },
  'yes': { category: 'טלוויזיה (YES / HOT / סלקום)', expense_type: 'fixed' },
  'בזק': { category: 'אינטרנט ביתי', expense_type: 'fixed' },
  'בזק בינלאומי': { category: 'אינטרנט ביתי', expense_type: 'fixed' },
  // — מנויים דיגיטליים —
  'netflix': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'los gatos': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'spotify': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'stockholm se': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'apple.com': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  'disney': { category: 'מנויים דיגיטליים (נטפליקס ספוטיפיי)', expense_type: 'fixed' },
  // — מנויים עסקיים —
  'canva': { category: 'מנויים עסקיים (Canva ChatGPT Adobe וכו\')', expense_type: 'fixed' },
  'adobe': { category: 'מנויים עסקיים (Canva ChatGPT Adobe וכו\')', expense_type: 'fixed' },
  'chatgpt': { category: 'מנויים עסקיים (Canva ChatGPT Adobe וכו\')', expense_type: 'fixed' },
  'openai': { category: 'מנויים עסקיים (Canva ChatGPT Adobe וכו\')', expense_type: 'fixed' },
  // — שיווק —
  'facebk': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  'facebook': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  'google ads': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  'meta': { category: 'קמפיינים דיגיטליים', expense_type: 'variable' },
  // — בריאות —
  'מכבי': { category: 'קופת חולים', expense_type: 'fixed' },
  'כללית': { category: 'קופת חולים', expense_type: 'fixed' },
  'מאוחדת': { category: 'קופת חולים', expense_type: 'fixed' },
  'לאומית': { category: 'קופת חולים', expense_type: 'fixed' },
  // — כבישים —
  'כביש 6': { category: 'כביש 6 / כבישי אגרה', expense_type: 'variable' },
  'כביש שש': { category: 'כביש 6 / כבישי אגרה', expense_type: 'variable' },
  // — חניה —
  'פנגו': { category: 'חניה', expense_type: 'variable' },
  'סלופארק': { category: 'חניה', expense_type: 'variable' },
  'cellopark': { category: 'חניה', expense_type: 'variable' },
  'cello': { category: 'חניה', expense_type: 'variable' },
  // — חשבונות —
  'חברת חשמל': { category: 'חשמל לבית', expense_type: 'fixed' },
  'מקורות': { category: 'מים למגורים', expense_type: 'fixed' },
  'עין נטפים': { category: 'מים למגורים', expense_type: 'fixed' },
  'מי אביבים': { category: 'מים למגורים', expense_type: 'fixed' },
  'מי רמת גן': { category: 'מים למגורים', expense_type: 'fixed' },
  'סופרגז': { category: 'גז', expense_type: 'fixed' },
  'פזגז': { category: 'גז', expense_type: 'fixed' },
  'אמישראגז': { category: 'גז', expense_type: 'fixed' },
  // — מיסים —
  'ביטוח לאומי': { category: 'דמי ביטוח לאומי', expense_type: 'fixed' },
  'מס הכנסה': { category: 'מס הכנסה', expense_type: 'fixed' },
  'עיריית': { category: 'ארנונה למגורים', expense_type: 'fixed' },
  'ארנונה': { category: 'ארנונה למגורים', expense_type: 'fixed' },
  // — אשראי (is_summary) —
  'ויזה': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'visa': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'מסטרקארד': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'mastercard': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'ישראכרט': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'כאל': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'max ': { category: 'חיוב כרטיס אשראי', is_credit: true },
  'לאומי קארד': { category: 'חיוב כרטיס אשראי', is_credit: true },
  // — עמלות —
  'דמי כרטיס': { category: 'עמלות בנק פרטי', expense_type: 'fixed' },
  'עמלת': { category: 'עמלות בנק פרטי', expense_type: 'fixed' },
  // — ביגוד —
  'קסטרו': { category: 'ביגוד', expense_type: 'variable' },
  'h&m': { category: 'ביגוד', expense_type: 'variable' },
  'זארה': { category: 'ביגוד', expense_type: 'variable' },
  'fox': { category: 'ביגוד', expense_type: 'variable' },
  'גולף': { category: 'ביגוד', expense_type: 'variable' },
};

// ============================================================================
// Hard Rule Matching
// ============================================================================

function matchHardRule(vendor: string, originalDescription?: string): { category: string; expense_type?: string; is_credit?: boolean } | null {
  if (!vendor) return null;
  const lower = vendor.toLowerCase().trim();
  const desc = (originalDescription || '').toLowerCase().trim();

  // ── Transfer detection (before dictionary) ──
  // "העברה ל..." = outgoing transfer, "העברה מ..." = incoming transfer
  if (desc.startsWith('העברה ל') || desc.includes('העברה ל')) {
    return { category: 'העברה יוצאת', expense_type: 'variable' };
  }
  if (desc.startsWith('העברה מ') || desc.includes('העברה מ')) {
    return { category: 'העברה נכנסת', expense_type: 'variable' };
  }

  // ── Dictionary lookup ──
  for (const [key, rule] of Object.entries(HARD_RULES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return rule;
    }
  }
  return null;
}

// ============================================================================
// Personal Rule Matching (user_category_rules)
// ============================================================================

async function matchPersonalRule(
  userId: string,
  vendor: string,
  amount: number,
  supabase: any
): Promise<{ category: string; confidence: number } | null> {
  if (!vendor) return null;

  // Try financial signature first (more specific)
  const signature = getFinancialSignature(vendor, amount);
  const { data: sigMatch } = await supabase
    .from('user_category_rules')
    .select('category, confidence')
    .eq('user_id', userId)
    .eq('vendor_pattern', signature)
    .gte('confidence', 0.7)
    .limit(1)
    .maybeSingle();

  if (sigMatch) return { category: sigMatch.category, confidence: sigMatch.confidence || 0.85 };

  // Fall back to vendor name
  const vendorKey = normalizeVendorName(vendor);
  const { data: vendorMatch } = await supabase
    .from('user_category_rules')
    .select('category, confidence')
    .eq('user_id', userId)
    .ilike('vendor_pattern', `%${vendorKey}%`)
    .gte('confidence', 0.7)
    .order('confidence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (vendorMatch) return { category: vendorMatch.category, confidence: vendorMatch.confidence || 0.8 };

  return null;
}

// ============================================================================
// Gemini Batch Classification
// ============================================================================

async function classifyWithGemini(
  transactions: TransactionForClassification[],
  userProfile: UserProfileForPrompt,
  existingClassifications: Array<{ category_name: string; vendor: string; amount_avg: number }>
): Promise<ClassificationResult[]> {
  if (transactions.length === 0) return [];

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    transactions,
    userProfile,
    existingClassifications,
  });

  try {
    const response = await chatWithGeminiFlashMinimal(
      userPrompt,
      systemPrompt
    );

    const cleaned = response
      .replace(/```json?\s*/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return parsed.classifications || [];
  } catch (err) {
    console.error('[AI-Classifier] Gemini batch error:', err);
    return [];
  }
}

// ============================================================================
// Main: classifyAllTransactions
// ============================================================================

export async function classifyAllTransactions(userId: string): Promise<ClassifyAllResult> {
  const supabase = createServiceClient();

  // 1. Fetch pending transactions
  const { data: pending } = await supabase
    .from('transactions')
    .select('id, vendor, amount, tx_date, type, expense_category, income_category, category, original_description, expense_type')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .or('is_summary.is.null,is_summary.eq.false')
    .order('tx_date', { ascending: false });

  if (!pending || pending.length === 0) {
    return emptyResult();
  }

  // 2. Load user context
  const { data: user } = await supabase
    .from('users')
    .select('classification_context')
    .eq('id', userId)
    .single();

  const ctxData = user?.classification_context || {};
  const dna: FinancialDNA = ctxData.financial_dna || {};
  const hasDNA = Object.keys(dna).length > 5; // meaningful DNA
  const profile: UserProfileForPrompt = ctxData.phi_profile?.inferred || {};

  // 3. Load existing classifications for context
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('vendor, amount, expense_category, income_category, category')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .or('is_summary.is.null,is_summary.eq.false')
    .limit(50);

  const existingClassifications = (existingTx || [])
    .filter(tx => tx.expense_category || tx.income_category)
    .map(tx => ({
      category_name: tx.expense_category || tx.income_category || '',
      vendor: tx.vendor || '',
      amount_avg: Math.abs(Number(tx.amount) || 0),
    }));

  // ======================================================================
  // CLASSIFICATION — Dynamic layer order
  // ======================================================================

  const classified: ClassifiedTransaction[] = [];
  const needsGemini: TransactionForClassification[] = [];
  let dnaCount = 0, hardRuleCount = 0, personalCount = 0, creditCount = 0;

  for (const tx of pending) {
    const vendor = tx.vendor || '';
    const amount = Number(tx.amount) || 0;
    const existingCat = tx.expense_category || tx.income_category || tx.category || '';

    // === LAYER 0: DNA (month 2+ only) ===
    if (hasDNA) {
      const dnaMatch = matchAgainstDNA({ vendor, amount }, dna);
      if (dnaMatch.matched && dnaMatch.category) {
        classified.push(makeTx(tx, dnaMatch.category, dnaMatch.confidence!, 'dna', tx.expense_type));
        dnaCount++;
        continue;
      }
    }

    // === LAYER 1: Hard rules (+ transfer detection from original_description) ===
    const hardRule = matchHardRule(vendor, tx.original_description);
    if (hardRule) {
      if (hardRule.is_credit) {
        classified.push({ ...makeTx(tx, hardRule.category, 0.95, 'hard_rule'), is_credit_charge: true });
        creditCount++;
      } else {
        // In month 1, hard rules are VALIDATION only (Gemini is primary)
        if (hasDNA) {
          classified.push(makeTx(tx, hardRule.category, 0.95, 'hard_rule', hardRule.expense_type));
          hardRuleCount++;
        } else {
          // Month 1: still send to Gemini, but remember the hard rule for validation
          needsGemini.push(makeGeminiTx(tx, needsGemini.length));
        }
      }
      continue;
    }

    // === LAYER 2: Personal rules ===
    const personal = await matchPersonalRule(userId, vendor, amount, supabase);
    if (personal) {
      classified.push(makeTx(tx, personal.category, personal.confidence, 'personal', tx.expense_type));
      personalCount++;
      continue;
    }

    // === EXISTING OCR CATEGORY (non-generic) ===
    if (existingCat && !isGenericCategory(existingCat)) {
      classified.push(makeTx(tx, existingCat, 0.75, hasDNA ? 'hard_rule' : 'ai', tx.expense_type));
      hardRuleCount++;
      continue;
    }

    // === Needs Gemini ===
    needsGemini.push(makeGeminiTx(tx, needsGemini.length));
  }

  // ======================================================================
  // LAYER 3 (or LAYER 1 in month 1): Gemini Batch
  // ======================================================================

  let aiCount = 0, refundCount = 0;
  const unclassified: Array<{ id: string; vendor: string; amount: number }> = [];

  if (needsGemini.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < needsGemini.length; i += BATCH_SIZE) {
      const batch = needsGemini.slice(i, i + BATCH_SIZE);
      const results = await classifyWithGemini(batch, profile, existingClassifications);

      const resultMap = new Map<number, ClassificationResult>();
      for (const r of results) resultMap.set(r.transaction_index, r);

      for (const tx of batch) {
        const result = resultMap.get(tx.index);
        if (result && result.category_name) {
          // Month 1 validation: if hard rule disagrees with Gemini, trust hard rule for obvious cases
          const hardRule = matchHardRule(tx.vendor, tx.original_description);
          let finalCategory = result.category_name;
          let finalConfidence = result.confidence || 0.8;

          if (!hasDNA && hardRule && !hardRule.is_credit && hardRule.category !== result.category_name) {
            // Month 1: Gemini is PRIMARY. Hard rule corrects ONLY for gross errors (different group).
            // "רמי לוי = סופר" (food) but Gemini said "ביטוח" (insurance) → hard rule wins
            // "מגדל = ביטוח בריאות" but Gemini said "ביטוח חיים" → same group, trust Gemini
            const geminiCat = CATEGORIES.find(c => c.name === result.category_name);
            const hardRuleCat = CATEGORIES.find(c => c.name === hardRule.category);

            if (geminiCat && hardRuleCat && geminiCat.group !== hardRuleCat.group) {
              finalCategory = hardRule.category;
              finalConfidence = 0.95;
            }
            // Same group → trust Gemini's more specific classification
          }

          const isCreditCharge = result.is_credit_charge || finalCategory === 'חיוב כרטיס אשראי';
          if (isCreditCharge) creditCount++;
          if (result.is_refund) refundCount++;

          classified.push({
            id: tx.id,
            vendor: tx.vendor,
            amount: tx.amount,
            date: tx.date,
            type: result.is_refund ? 'income' : (pending.find(p => p.id === tx.id)?.type || 'expense'),
            category: finalCategory,
            expense_type: result.expense_type,
            confidence: finalConfidence,
            source: 'ai',
            is_credit_charge: isCreditCharge,
            is_refund: result.is_refund,
            reasoning: result.reasoning,
          });
          aiCount++;
        } else {
          unclassified.push({ id: tx.id, vendor: tx.vendor, amount: tx.amount });
        }
      }
    }
  }

  // Fallback unclassified → "אחר"
  for (const u of unclassified) {
    classified.push({
      id: u.id, vendor: u.vendor, amount: u.amount, date: '',
      type: 'expense', category: 'אחר', confidence: 0.3, source: 'ai',
    });
  }

  // ======================================================================
  // Build Result
  // ======================================================================

  const summary: Record<string, { total: number; count: number; items: string[]; refunds: number }> = {};
  const highConfidence: ClassifiedTransaction[] = [];
  const lowConfidence: ClassifiedTransaction[] = [];

  for (const tx of classified) {
    if (tx.is_credit_charge) continue;

    if (!summary[tx.category]) summary[tx.category] = { total: 0, count: 0, items: [], refunds: 0 };
    const s = summary[tx.category];

    if (tx.is_refund) {
      s.refunds += Math.abs(tx.amount);
      s.total -= Math.abs(tx.amount);
    } else {
      s.total += Math.abs(tx.amount);
    }
    s.count++;
    if (s.items.length < 3) s.items.push(tx.vendor);

    if (tx.confidence >= 0.85) highConfidence.push(tx);
    else lowConfidence.push(tx);
  }

  return {
    classified,
    unclassified,
    summary,
    highConfidence,
    lowConfidence,
    stats: {
      total: pending.length,
      dna: dnaCount,
      hardRules: hardRuleCount,
      personal: personalCount,
      ai: aiCount,
      unclassified: unclassified.length,
      creditCharges: creditCount,
      refunds: refundCount,
    },
  };
}

// ============================================================================
// Apply Classifications to DB
// ============================================================================

export async function applyClassifications(
  userId: string,
  classifications: ClassifiedTransaction[]
): Promise<number> {
  const supabase = createServiceClient();
  let applied = 0;

  for (const tx of classifications) {
    const updateData: any = {
      status: 'confirmed',
      auto_categorized: true,
      category: tx.category,
      updated_at: new Date().toISOString(),
    };

    if (tx.type === 'income') {
      updateData.income_category = tx.category;
    } else {
      updateData.expense_category = tx.category;
    }
    if (tx.expense_type) updateData.expense_type = tx.expense_type;
    if (tx.is_credit_charge) updateData.is_summary = true;
    if (tx.is_refund) updateData.type = 'income';

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', tx.id)
      .eq('user_id', userId);

    if (!error) applied++;
  }

  return applied;
}

// ============================================================================
// Learn from batch (delegates to learning engine)
// ============================================================================

export async function learnFromClassifications(
  userId: string,
  classifications: ClassifiedTransaction[]
): Promise<void> {
  const validForLearning = classifications.filter(
    tx => tx.vendor && tx.category !== 'אחר' && !tx.is_credit_charge
  );

  await learnFromBatchClassification(
    userId,
    validForLearning.map(tx => ({
      vendor: tx.vendor,
      amount: tx.amount,
      category_name: tx.category,
      source: tx.source,
    }))
  );
}

// ============================================================================
// Format for WhatsApp — with confidence visual
// ============================================================================

const EMOJIS: Record<string, string> = {
  'דיור': '🏠', 'מזון': '🛒', 'רכב': '🚗', 'תקשורת': '📱',
  'בריאות': '💊', 'ביטוחים': '🛡️', 'חינוך': '📚', 'בילויים': '🎭',
  'פיננסים': '🏦', 'מיסים': '📋', 'שיווק': '📣', 'משרד': '💼',
  'מנויים': '📺', 'שירותים': '🔧', 'אישי': '👤', 'מתנות': '🎁',
  'אחר': '📦',
};

function getEmoji(category: string): string {
  for (const [group, emoji] of Object.entries(EMOJIS)) {
    if (category.includes(group)) return emoji;
  }
  const cat = CATEGORIES.find(c => c.name === category);
  if (cat && EMOJIS[cat.group]) return EMOJIS[cat.group];
  return '📦';
}

export function formatSummaryForWhatsApp(result: ClassifyAllResult): string {
  const { summary, highConfidence, lowConfidence, stats } = result;

  let msg = `✅ *סיווגתי ${stats.total} תנועות!*\n\n`;

  // High confidence summary
  if (highConfidence.length > 0) {
    msg += `✅ ${highConfidence.length} — ודאות גבוהה:\n`;
    const sorted = Object.entries(summary)
      .filter(([, d]) => d.total > 0)
      .sort(([, a], [, b]) => b.total - a.total);

    for (const [cat, data] of sorted.slice(0, 8)) {
      const emoji = getEmoji(cat);
      const totalStr = Math.round(data.total).toLocaleString('he-IL');
      msg += `${emoji} ${cat}: ${totalStr} ₪`;
      if (data.refunds > 0) msg += ` (כולל זיכוי ${Math.round(data.refunds).toLocaleString('he-IL')}₪)`;
      msg += '\n';
    }
    if (sorted.length > 8) msg += `...ועוד ${sorted.length - 8} קטגוריות\n`;
  }

  // Low confidence items
  if (lowConfidence.length > 0) {
    msg += `\n⚠️ ${lowConfidence.length} — כדאי לבדוק:\n`;
    for (const tx of lowConfidence.slice(0, 5)) {
      msg += `  • ${tx.vendor} ${Math.abs(tx.amount).toLocaleString('he-IL')}₪ → ${tx.category}\n`;
    }
    if (lowConfidence.length > 5) msg += `  ...ועוד ${lowConfidence.length - 5}\n`;
  }

  if (stats.creditCharges > 0) msg += `\n💳 ${stats.creditCharges} חיובי אשראי (לא נספרים כפול)`;
  if (stats.refunds > 0) msg += `\n↩️ ${stats.refunds} זיכויים/החזרים`;

  msg += `\n\nהכל נכון? כתבו *"אישור"*\nלתיקון — *"תיקון"*`;

  return msg;
}

// ============================================================================
// Helpers
// ============================================================================

function makeTx(
  tx: any, category: string, confidence: number, source: ClassifiedTransaction['source'],
  expenseType?: string
): ClassifiedTransaction {
  return {
    id: tx.id,
    vendor: tx.vendor || '',
    amount: Number(tx.amount),
    date: tx.tx_date || '',
    type: tx.type || 'expense',
    category,
    expense_type: (expenseType || tx.expense_type || undefined) as any,
    confidence,
    source,
  };
}

function makeGeminiTx(tx: any, index: number): TransactionForClassification {
  return {
    index,
    id: tx.id,
    vendor: tx.vendor || 'לא ידוע',
    amount: Number(tx.amount),
    date: tx.tx_date || '',
    type: tx.type || 'expense',
    original_description: tx.original_description, // AS-IS, no normalization!
  };
}

function isGenericCategory(cat: string): boolean {
  return ['אחר', 'לא מסווג', 'שונות', 'הוצאה אחרת', 'הכנסה אחרת', 'חיוב אשראי', 'חיוב כרטיס אשראי'].includes(cat);
}

function emptyResult(): ClassifyAllResult {
  return {
    classified: [], unclassified: [], summary: {},
    highConfidence: [], lowConfidence: [],
    stats: { total: 0, dna: 0, hardRules: 0, personal: 0, ai: 0, unclassified: 0, creditCharges: 0, refunds: 0 },
  };
}
