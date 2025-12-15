/**
 * API Route: Export Transactions to Excel
 * GET /api/export/transactions?start=2025-01-01&end=2025-12-31
 */

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { exportTransactionsToExcel, createExcelResponse } from '@/lib/export/excel-exporter';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    
    // בדוק אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // קרא פרמטרים
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    let dateRange;
    if (startParam && endParam) {
      dateRange = {
        start: new Date(startParam),
        end: new Date(endParam),
      };
    }
    
    // ייצא לאקסל
    const buffer = await exportTransactionsToExcel(user.id, dateRange);
    
    // צור שם קובץ
    const today = new Date().toISOString().split('T')[0];
    const filename = `phi-transactions-${today}.xlsx`;
    
    return createExcelResponse(buffer, filename);
    
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

