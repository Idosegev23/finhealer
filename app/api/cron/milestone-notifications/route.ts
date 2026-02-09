/**
 * GET /api/cron/milestone-notifications
 * Cron Job - שליחת הודעות חגיגה על אבני דרך
 * רץ יומית בצהריים
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMilestoneNotifications } from '@/lib/goals/milestone-notifier';

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
    
    console.log('[Cron] Starting milestone notifications...');
    
    await sendMilestoneNotifications();
    
    console.log('[Cron] Milestone notifications completed');
    
    return NextResponse.json({
      success: true,
      message: 'Milestone notifications sent successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error in milestone notifications cron:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
