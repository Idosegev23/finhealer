import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateUserPhase, shouldUpgradePhase, getPhaseName, getPhaseNumber } from '@/lib/utils/phase-calculator';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

/**
 * Cron job to update user phases based on their DATA SPAN (not time since registration)
 * 
 * This checks how much historical data each user has and upgrades their phase accordingly.
 * A user who uploads 6 months of bank statements on day 1 will immediately get access to
 * all advanced features!
 * 
 * Should run once daily (or after each document upload for immediate upgrade)
 * 
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-phases",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting phase update cron job...');

    const supabase = await createClient();

    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, phase')
      .eq('subscription_status', 'active');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('No active users found');
      return NextResponse.json({ message: 'No users to update' });
    }

    console.log(`Found ${users.length} active users`);

    const updates: Array<{
      userId: string;
      name: string;
      oldPhase: string;
      newPhase: string;
    }> = [];

    // Process each user
    for (const user of users) {
      try {
        const shouldUpgrade = await shouldUpgradePhase(user.id);
        
        if (shouldUpgrade) {
          const newPhase = await calculateUserPhase(user.id);
          const oldPhase = user.phase;

          // Update user phase
          const { error: updateError } = await supabase
            .from('users')
            .update({ phase: newPhase })
            .eq('id', user.id);

          if (updateError) {
            console.error(`Error updating user ${user.id}:`, updateError);
            continue;
          }

          updates.push({
            userId: user.id,
            name: user.name || user.email || 'Unknown',
            oldPhase,
            newPhase,
          });

          console.log(`✅ Updated ${user.name || user.email}: ${oldPhase} → ${newPhase}`);

          // TODO: Send WhatsApp notification about phase upgrade
          // await sendPhaseUpgradeNotification(user.id, newPhase);
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        continue;
      }
    }

    const summary = {
      totalUsers: users.length,
      updatedUsers: updates.length,
      updates,
      timestamp: new Date().toISOString(),
    };

    console.log('🎉 Phase update cron job completed:', summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

