/**
 * API Endpoint למעקב אחר שינויים בהכנסה
 * להרצה דרך Vercel Cron או קריאה ידנית
 */

import { NextResponse } from 'next/server';
import { monitorRecentIncomeChanges } from '@/lib/goals/income-monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    // בדיקת Authentication (רק Vercel Cron או internal calls)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API] Starting income monitoring...');

    // הרץ מעקב
    await monitorRecentIncomeChanges();

    console.log('[API] Income monitoring completed');

    return NextResponse.json({
      success: true,
      message: 'Income monitoring completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error in income monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST endpoint למעקב ידני
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, phone } = body;

    if (!userId || !phone) {
      return NextResponse.json(
        { error: 'Missing userId or phone' },
        { status: 400 }
      );
    }

    const { detectIncomeChangeAndPropose } = await import('@/lib/goals/auto-adjust-handler');
    await detectIncomeChangeAndPropose(userId, phone);

    return NextResponse.json({
      success: true,
      message: 'Income check completed for user',
    });
  } catch (error) {
    console.error('[API] Error in manual income check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
