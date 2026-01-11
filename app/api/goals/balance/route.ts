/**
 * API Route: /api/goals/balance
 * 
 * מחשב הקצאות אופטימליות ליעדים
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  calculateOptimalAllocations,
  saveAllocationHistory,
  applyAllocations,
} from '@/lib/goals/goals-balancer';
import type { GoalAllocationInput } from '@/types/goals';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, monthlyIncome, fixedExpenses, minimumLivingBudget, applyChanges = false } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }
    
    // בדוק הרשאות
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // ודא שהמשתמש מבקש נתונים שלו בלבד
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // הכן קלט
    const input: GoalAllocationInput = {
      userId,
      monthlyIncome,
      fixedExpenses,
      minimumLivingBudget,
    };
    
    // הרץ אלגוריתם
    const result = await calculateOptimalAllocations(input);
    
    // אם מבוקש - החל שינויים
    if (applyChanges && result.allocations.length > 0) {
      await applyAllocations(result.allocations);
      await saveAllocationHistory(
        userId,
        result.allocations,
        'manual_calculation'
      );
    }
    
    return NextResponse.json({
      success: true,
      result,
      applied: applyChanges,
    });
    
  } catch (error: any) {
    console.error('Error in /api/goals/balance:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - קבלת הקצאות נוכחיות
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }
    
    // בדוק הרשאות
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // שלוף יעדים עם הקצאות נוכחיות
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true });
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      goals,
    });
    
  } catch (error: any) {
    console.error('Error in GET /api/goals/balance:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

