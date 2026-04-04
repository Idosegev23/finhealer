import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron Job: Refresh materialized views
 * Runs every 6 hours (00:00, 06:00, 12:00, 18:00)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [CRON] Refreshing materialized views...');
    
    const supabase = createServiceClient();

    const views = ['monthly_snapshots', 'user_current_state'];
    const results: Record<string, boolean> = {};

    for (const view of views) {
      try {
        // Refresh materialized view concurrently
        const { error } = await supabase.rpc('refresh_materialized_view', {
          view_name: view,
        });

        if (error) {
          // Try direct SQL if RPC doesn't exist
          const { error: sqlError } = await supabase.rpc('execute_sql', {
            sql: `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};`,
          });

          if (sqlError) {
            console.warn(`⚠️ Failed to refresh ${view}:`, sqlError);
            results[view] = false;
          } else {
            console.log(`✅ Refreshed ${view}`);
            results[view] = true;
          }
        } else {
          console.log(`✅ Refreshed ${view}`);
          results[view] = true;
        }
      } catch (error) {
        console.error(`Failed to refresh ${view}:`, error);
        results[view] = false;
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('❌ [CRON] Refresh views failed:', error);
    return NextResponse.json(
      { error: 'Failed to refresh views', details: error.message },
      { status: 500 }
    );
  }
}

