/**
 * Cron Job: בדיקת יעדים יומית
 * 
 * Endpoint זה צריך להיקרא מדי יום (למשל ב-Vercel Cron או בכלי אחר)
 * 
 * דוגמה ל-vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/goals-check",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorAllUsersGoals } from '@/lib/goals/goals-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // בדוק authorization (Vercel Cron או API key)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[Goals Check] Starting daily goals monitoring...');
    const startTime = Date.now();
    
    // הרץ ניטור לכל המשתמשים
    const results = await monitorAllUsersGoals();
    
    const duration = Date.now() - startTime;
    
    // סיכום
    const summary = {
      total_users: results.length,
      total_alerts: results.reduce((sum, r) => sum + r.alerts.length, 0),
      total_recommendations: results.reduce((sum, r) => sum + r.recommendations.length, 0),
      high_priority_alerts: results.reduce(
        (sum, r) => sum + r.alerts.filter(a => a.priority === 'high').length,
        0
      ),
      actions_taken: results.reduce((sum, r) => sum + r.actions_taken.length, 0),
      duration_ms: duration,
    };
    
    console.log('[Goals Check] Completed:', summary);
    
    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('[Goals Check] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - בדיקה ידנית למשתמש בודד
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }
    
    const { monitorUserGoals } = await import('@/lib/goals/goals-monitor');
    const result = await monitorUserGoals(userId);
    
    return NextResponse.json({
      success: true,
      result,
    });
    
  } catch (error: any) {
    console.error('[Goals Check] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

