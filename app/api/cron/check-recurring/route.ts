import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron Job: Check recurring patterns and update next_expected
 * Runs daily at midnight: 0 0 * * * (every day at 00:00)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [CRON] Checking recurring patterns...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active recurring patterns
    const { data: patterns } = await supabase
      .from('recurring_patterns')
      .select('id, user_id, vendor, amount, frequency, next_expected, day_tolerance, status, occurrence_count, missed_count')
      .eq('status', 'active');

    if (!patterns || patterns.length === 0) {
      return NextResponse.json({ success: true, patternsProcessed: 0 });
    }

    let updated = 0;
    const today = new Date();

    // 🚀 Batch load: find the widest tolerance window across all patterns
    // and load all potentially matching transactions in one query
    const pastPatterns = patterns.filter(p => new Date(p.next_expected) <= today);

    if (pastPatterns.length > 0) {
      // Find the widest date range needed
      const maxTolerance = Math.max(...pastPatterns.map(p => p.day_tolerance || 3));
      const earliestExpected = new Date(Math.min(...pastPatterns.map(p => new Date(p.next_expected).getTime())));
      earliestExpected.setDate(earliestExpected.getDate() - maxTolerance);
      const latestEnd = new Date(today);
      latestEnd.setDate(latestEnd.getDate() + maxTolerance);

      const userIds = Array.from(new Set(pastPatterns.map(p => p.user_id)));

      const { data: allMatchingTx } = await supabase
        .from('transactions')
        .select('id, tx_date, amount, vendor, user_id')
        .gte('tx_date', earliestExpected.toISOString().split('T')[0])
        .lte('tx_date', latestEnd.toISOString().split('T')[0])
        .in('user_id', userIds);

      const txList = allMatchingTx || [];

      for (const pattern of pastPatterns) {
        const nextExpected = new Date(pattern.next_expected);
        let newNextExpected = new Date(nextExpected);

        // Calculate based on frequency
        switch (pattern.frequency) {
          case 'weekly':
            newNextExpected.setDate(newNextExpected.getDate() + 7);
            break;
          case 'monthly':
            newNextExpected.setMonth(newNextExpected.getMonth() + 1);
            break;
          case 'quarterly':
            newNextExpected.setMonth(newNextExpected.getMonth() + 3);
            break;
          case 'yearly':
            newNextExpected.setFullYear(newNextExpected.getFullYear() + 1);
            break;
        }

        // Check if payment was found in the tolerance window (in memory)
        const tolerance = pattern.day_tolerance || 3;
        const toleranceStart = new Date(nextExpected);
        toleranceStart.setDate(toleranceStart.getDate() - tolerance);
        const toleranceEnd = new Date(nextExpected);
        toleranceEnd.setDate(toleranceEnd.getDate() + tolerance);
        const tolStartStr = toleranceStart.toISOString().split('T')[0];
        const tolEndStr = toleranceEnd.toISOString().split('T')[0];

        const vendorLower = (pattern.vendor || '').toLowerCase();
        const matchingTransactions = txList.filter(tx =>
          tx.user_id === pattern.user_id &&
          tx.tx_date >= tolStartStr &&
          tx.tx_date <= tolEndStr &&
          (tx.vendor || '').toLowerCase().includes(vendorLower)
        );

        if (matchingTransactions.length > 0) {
          await supabase
            .from('recurring_patterns')
            .update({
              last_occurrence: today.toISOString().split('T')[0],
              next_expected: newNextExpected.toISOString().split('T')[0],
              occurrence_count: pattern.occurrence_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pattern.id);

          updated++;
        } else {
          await supabase
            .from('recurring_patterns')
            .update({
              next_expected: newNextExpected.toISOString().split('T')[0],
              missed_count: pattern.missed_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pattern.id);

          updated++;
        }
      }
    }

    console.log(`✅ [CRON] Updated ${updated} recurring patterns`);

    return NextResponse.json({
      success: true,
      patternsProcessed: updated,
    });
  } catch (error: any) {
    console.error('❌ [CRON] Check recurring failed:', error);
    return NextResponse.json(
      { error: 'Failed to check recurring patterns', details: error.message },
      { status: 500 }
    );
  }
}

