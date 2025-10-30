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
      .select('*')
      .eq('status', 'active');

    if (!patterns || patterns.length === 0) {
      return NextResponse.json({ success: true, patternsProcessed: 0 });
    }

    let updated = 0;
    const today = new Date();

    for (const pattern of patterns) {
      const nextExpected = new Date(pattern.next_expected);
      
      // If next_expected is in the past, calculate new next_expected
      if (nextExpected <= today) {
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
        
        // Check if payment was found in the tolerance window
        const toleranceStart = new Date(nextExpected);
        toleranceStart.setDate(toleranceStart.getDate() - (pattern.day_tolerance || 3));
        
        const toleranceEnd = new Date(nextExpected);
        toleranceEnd.setDate(toleranceEnd.getDate() + (pattern.day_tolerance || 3));
        
        const { data: matchingTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', pattern.user_id)
          .ilike('vendor', `%${pattern.vendor}%`)
          .gte('date', toleranceStart.toISOString().split('T')[0])
          .lte('date', toleranceEnd.toISOString().split('T')[0]);
        
        if (matchingTransactions && matchingTransactions.length > 0) {
          // Found matching transaction - update occurrence_count
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
          // No matching transaction - increment missed_count
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

