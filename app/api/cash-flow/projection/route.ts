/**
 * GET /api/cash-flow/projection
 * תחזית תזרים מזומנים למשתמש
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';
import { projectCashFlow } from '@/lib/finance/cash-flow-projector';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClientServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // פרמטרים
    const searchParams = req.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    
    if (months < 1 || months > 24) {
      return NextResponse.json(
        { error: 'months must be between 1 and 24' },
        { status: 400 }
      );
    }
    
    // תחזית תזרים
    const analysis = await projectCashFlow(user.id, months);
    
    return NextResponse.json({
      success: true,
      data: analysis,
    });
    
  } catch (error) {
    console.error('Error in GET /api/cash-flow/projection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
