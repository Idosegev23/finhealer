/**
 * Behavior Analysis API - Phase 2
 * 
 * GET /api/behavior - Get behavior analysis for current user
 * POST /api/behavior - Run new analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runFullAnalysis, type BehaviorAnalysisResult } from '@/lib/analysis/behavior-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/behavior
 * Returns the latest behavior analysis for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Run analysis
    const analysis = await runFullAnalysis(user.id, 3);
    
    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[/api/behavior GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get behavior analysis' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/behavior
 * Run a new behavior analysis
 * 
 * Body: { periodMonths?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse body
    const body = await request.json().catch(() => ({}));
    const periodMonths = body.periodMonths || 3;
    
    // Run analysis
    const analysis = await runFullAnalysis(user.id, periodMonths);
    
    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[/api/behavior POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run behavior analysis' },
      { status: 500 }
    );
  }
}

/**
 * Type export for frontend use
 */
export type { BehaviorAnalysisResult };

