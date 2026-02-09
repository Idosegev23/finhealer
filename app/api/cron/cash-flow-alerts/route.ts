/**
 * GET /api/cron/cash-flow-alerts
 * Cron Job - בדיקת תזרים שלילי ושליחת התראות
 * רץ יומית בבוקר
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkNegativeCashFlow } from '@/lib/finance/cash-flow-alerts';

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
    
    console.log('[Cron] Starting cash flow alerts check...');
    
    await checkNegativeCashFlow();
    
    console.log('[Cron] Cash flow alerts check completed');
    
    return NextResponse.json({
      success: true,
      message: 'Cash flow alerts checked successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error in cash flow alerts cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
