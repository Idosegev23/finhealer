import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, findBestMatch } from '@/lib/finance/categories';

/**
 * POST /api/transactions/reclassify
 *
 * Re-classifies transactions that have bad/generic/missing categories.
 * Step 1: Local keyword matching (instant, free)
 * Step 2: Gemini AI for remaining unknowns (if available)
 */

const META_CATEGORIES = new Set([
  'חיוב כרטיס אשראי', 'חיוב אשראי', 'חיוב כרטיס',
  'העברה יוצאת', 'העברה נכנסת', 'משיכת מזומן',
  'עמלות בנק', 'עמלות כרטיס אשראי',
  'לא מסווג', 'אחר', 'שונות', 'הוצאה אחרת',
  'הכנסה אחרת', 'השקעות',
]);

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all expense transactions with bad/missing categories
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, vendor, expense_category, category, amount, description, original_description')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('status', 'confirmed');

    if (error) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ total: 0, updated: 0 });
    }

    // Find transactions needing reclassification
    const needsReclassify = transactions.filter(tx => {
      const cat = tx.expense_category || tx.category || '';
      return !cat || META_CATEGORIES.has(cat);
    });

    let updated = 0;
    const batchUpdates: Array<{ id: string; expense_category: string; category: string; expense_type: string }> = [];

    // Step 1: Local keyword matching
    for (const tx of needsReclassify) {
      const searchText = [tx.vendor, tx.description, tx.original_description]
        .filter(Boolean)
        .join(' ');

      if (!searchText.trim()) continue;

      const match = findBestMatch(searchText);
      if (match) {
        batchUpdates.push({
          id: tx.id,
          expense_category: match.name,
          category: match.name,
          expense_type: match.type,
        });
      }
    }

    // Step 2: Try Gemini for remaining unknowns
    const stillUnknown = needsReclassify.filter(
      tx => !batchUpdates.some(u => u.id === tx.id)
    );

    if (stillUnknown.length > 0) {
      try {
        const aiResults = await reclassifyWithAI(stillUnknown);
        batchUpdates.push(...aiResults);
      } catch (aiErr) {
        console.warn('[reclassify] AI fallback failed:', aiErr);
        // Continue with local results only
      }
    }

    // Apply updates
    for (const update of batchUpdates) {
      const { error: updateErr } = await supabase
        .from('transactions')
        .update({
          expense_category: update.expense_category,
          category: update.category,
          expense_type: update.expense_type,
          auto_categorized: true,
        })
        .eq('id', update.id)
        .eq('user_id', user.id);

      if (!updateErr) updated++;
    }

    return NextResponse.json({
      total: needsReclassify.length,
      updated,
      localMatches: batchUpdates.length - (stillUnknown.length > 0 ? batchUpdates.filter(u => stillUnknown.some(s => s.id === u.id)).length : 0),
    });
  } catch (err) {
    console.error('Reclassify error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Reclassify unknowns using Gemini AI
 */
async function reclassifyWithAI(
  transactions: Array<{ id: string; vendor: string | null; description: string | null; amount: number }>
): Promise<Array<{ id: string; expense_category: string; category: string; expense_type: string }>> {
  const { chatWithGeminiFlash } = await import('@/lib/ai/gemini-client');

  // Build category list for prompt
  const categoryList = CATEGORIES
    .map(c => `- ${c.name} (${c.group}, ${c.type})`)
    .join('\n');

  // Batch transactions (max 30 at a time)
  const batch = transactions.slice(0, 30);
  const txList = batch
    .map((tx, i) => `${i + 1}. vendor="${tx.vendor || '?'}", amount=${tx.amount}, desc="${tx.description || ''}"`)
    .join('\n');

  const prompt = `סווג את התנועות הבאות לקטגוריות מהרשימה.
החזר JSON array בלבד, בפורמט:
[{"index": 1, "category": "שם הקטגוריה המדויק", "type": "fixed|variable|special"}]

רשימת קטגוריות מותרות:
${categoryList}

תנועות לסיווג:
${txList}

אם לא בטוח, החזר null עבור category.
החזר JSON בלבד ללא markdown.`;

  const response = await chatWithGeminiFlash(prompt, 'אתה מסווג הוצאות מקצועי.', '');

  try {
    // Parse JSON from response
    const jsonStr = response.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const results: Array<{ index: number; category: string | null; type: string }> = JSON.parse(jsonStr);

    return results
      .filter(r => r.category)
      .map(r => {
        const tx = batch[r.index - 1];
        if (!tx) return null;
        // Verify category exists in our list
        const validCat = CATEGORIES.find(c => c.name === r.category);
        if (!validCat) return null;
        return {
          id: tx.id,
          expense_category: validCat.name,
          category: validCat.name,
          expense_type: validCat.type,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  } catch {
    console.warn('[reclassify] Failed to parse AI response');
    return [];
  }
}
