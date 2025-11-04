import { NextRequest, NextResponse } from 'next/server';
import { SmartIncomeCalculator } from '@/components/income/SmartIncomeCalculator';

/**
 * API Route: /api/income/calculate
 * חישובים בזמן אמת להכנסות
 * 
 * POST body:
 * {
 *   gross?: number;
 *   net?: number;
 *   actualBank?: number;
 *   pension?: number;
 *   advancedStudy?: number;
 *   otherDeductions?: number;
 *   employmentType?: 'employee' | 'self_employed' | 'freelance' | 'other';
 *   mode?: 'forward' | 'reverse' | 'smart';
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      gross,
      net,
      actualBank,
      pension,
      advancedStudy,
      otherDeductions,
      employmentType = 'employee',
      mode = 'smart',
    } = body;

    // בניית state
    const state = {
      gross: gross ?? null,
      net: net ?? null,
      actualBank: actualBank ?? null,
      pension: pension ?? null,
      advancedStudy: advancedStudy ?? null,
      otherDeductions: otherDeductions ?? null,
      employmentType,
    };

    // חישוב לפי מצב
    let result;
    switch (mode) {
      case 'forward':
        if (!state.gross) {
          return NextResponse.json(
            { error: 'חסר ברוטו לחישוב קדימה' },
            { status: 400 }
          );
        }
        result = SmartIncomeCalculator.calculateForward(state);
        break;

      case 'reverse':
        if (!state.actualBank) {
          return NextResponse.json(
            { error: 'חסר סכום בנק לחישוב הפוך' },
            { status: 400 }
          );
        }
        result = SmartIncomeCalculator.calculateReverse(state.actualBank, employmentType);
        break;

      case 'smart':
      default:
        result = SmartIncomeCalculator.smartFill(state);
        break;
    }

    // פירוט מלא אם יש ברוטו
    const detailed = state.gross
      ? SmartIncomeCalculator.calculateDetailed(state)
      : null;

    return NextResponse.json({
      success: true,
      result,
      detailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/income/calculate] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'שגיאה בחישוב',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: הצעות חישוב לפי ברוטו
 * Query params: ?gross=15000&employmentType=employee
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gross = parseFloat(searchParams.get('gross') || '0');
    const employmentType = (searchParams.get('employmentType') || 'employee') as any;

    if (!gross || gross <= 0) {
      return NextResponse.json(
        { error: 'חסר ברוטו תקין' },
        { status: 400 }
      );
    }

    const suggestions = SmartIncomeCalculator.suggestDeductions(gross, employmentType);
    
    return NextResponse.json({
      success: true,
      gross,
      suggestions,
    });
  } catch (error) {
    console.error('[/api/income/calculate] GET Error:', error);
    return NextResponse.json(
      { error: 'שגיאה בהצעות' },
      { status: 500 }
    );
  }
}

