/**
 * GET /api/cron/savings-sync
 * Cron Job - סנכרון יתרות חשבונות חיסכון ליעדים
 * רץ יומית בלילה
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncSavingsToGoals } from '@/lib/goals/savings-sync';

export async function GET(req: NextRequest) {
  try {
    // בדיקת אימות (Vercel Cron Secret)
    const authHeader = req.headers.get('authorization');
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Cron] Starting savings sync...');
    
    await syncSavingsToGoals();
    
    console.log('[Cron] Savings sync completed');
    
    return NextResponse.json({
      success: true,
      message: 'Savings sync completed successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error in savings sync cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
